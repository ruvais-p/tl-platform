import logging
from dataclasses import dataclass

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from curriculum.models import PublishStatus
from students.models import Enrollment

from .grounding import build_grounded_prompt, select_context_chunks, validate_grounded_reply
from .models import CourseChatMessage, CourseChatSession, CourseChatbotConfig
from .provider import MathTutorProviderError, ask_math_tutor

logger = logging.getLogger(__name__)


class ChatAccessError(Exception):
    pass


class ChatProviderUnavailable(Exception):
    pass


@dataclass(frozen=True)
class ChatResult:
    session_id: str
    reply: str
    grounded: bool
    citations: list[dict[str, str]]


def save_chatbot_config(*, actor, instance=None, **data):
    if not actor.has_perm("tutoring.manage_course_chatbot"):
        raise PermissionError("Missing tutoring.manage_course_chatbot permission.")
    with transaction.atomic():
        if instance is None:
            config = CourseChatbotConfig(updated_by=actor, **data)
        else:
            config = CourseChatbotConfig.objects.select_for_update().get(pk=instance.pk)
            old_context = config.approved_context
            old_enabled = config.is_enabled
            for field, value in data.items():
                setattr(config, field, value)
            if config.approved_context != old_context or config.is_enabled != old_enabled:
                config.context_revision += 1
            config.updated_by = actor
        config.full_clean()
        config.save()
        if instance is not None and config.context_revision != instance.context_revision:
            CourseChatSession.objects.filter(course_version=config.course_version, is_active=True).update(is_active=False)
        return config


def _active_enrollment(*, student, course_id):
    return Enrollment.objects.select_related("course__program", "course_version").filter(
        student=student,
        course_id=course_id,
        status=Enrollment.Status.ACTIVE,
        course__status=PublishStatus.PUBLISHED,
        course__program__status=PublishStatus.PUBLISHED,
        course_version__status=PublishStatus.PUBLISHED,
    ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).first()


def chatbot_available_for(*, student, course_id) -> bool:
    enrollment = _active_enrollment(student=student, course_id=course_id)
    if not enrollment:
        return False
    return CourseChatbotConfig.objects.filter(
        course_version=enrollment.course_version,
        is_enabled=True,
    ).exclude(approved_context="").exists()


@transaction.atomic
def send_course_chat(*, student, course_id, message: str, session_id=None) -> ChatResult:
    enrollment = _active_enrollment(student=student, course_id=course_id)
    if not enrollment:
        raise ChatAccessError
    try:
        config = CourseChatbotConfig.objects.get(
            course_version=enrollment.course_version,
            is_enabled=True,
        )
    except CourseChatbotConfig.DoesNotExist as exc:
        raise ChatAccessError from exc
    if not config.approved_context.strip():
        raise ChatAccessError

    if session_id:
        try:
            session = CourseChatSession.objects.select_for_update().get(
                pk=session_id,
                student=student,
                course_version=enrollment.course_version,
                context_revision=config.context_revision,
                is_active=True,
            )
        except CourseChatSession.DoesNotExist as exc:
            raise ChatAccessError from exc
    else:
        session = CourseChatSession.objects.create(
            student=student,
            course_version=enrollment.course_version,
            context_revision=config.context_revision,
        )

    recent = list(session.messages.order_by("-created_at")[:settings.COURSE_CHAT_HISTORY_MESSAGES])
    history = [{"role": row.role, "content": row.content} for row in reversed(recent)]
    chunks = select_context_chunks(config.approved_context, message, history)

    grounded = False
    citations: list[dict[str, str]] = []
    reply = settings.COURSE_CHAT_REFUSAL
    if chunks:
        try:
            prompt = build_grounded_prompt(chunks, history, message)
            raw_reply = ask_math_tutor(prompt)
        except (MathTutorProviderError, ValueError) as exc:
            logger.warning(
                "course_chat_provider_failure session=%s version=%s code=%s",
                session.id,
                enrollment.course_version_id,
                getattr(exc, "code", "request_too_large"),
            )
            raise ChatProviderUnavailable from exc
        validated = validate_grounded_reply(raw_reply, chunks)
        if validated is not None:
            reply = validated.answer
            citations = validated.citations
            grounded = True

    CourseChatMessage.objects.create(session=session, role=CourseChatMessage.Role.USER, content=message)
    CourseChatMessage.objects.create(
        session=session,
        role=CourseChatMessage.Role.ASSISTANT,
        content=reply,
        citations=citations,
    )
    session.save(update_fields=["updated_at"])
    logger.info(
        "course_chat_complete session=%s version=%s grounded=%s chunks=%s",
        session.id,
        enrollment.course_version_id,
        grounded,
        ",".join(chunk.chunk_id for chunk in chunks),
    )
    return ChatResult(str(session.id), reply, grounded, citations)

