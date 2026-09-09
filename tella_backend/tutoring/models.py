import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from curriculum.models import CourseVersion


class TimestampedUUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class CourseChatbotConfig(TimestampedUUIDModel):
    course_version = models.OneToOneField(
        CourseVersion, on_delete=models.CASCADE, related_name="chatbot_config"
    )
    is_enabled = models.BooleanField(default=False, db_index=True)
    approved_context = models.TextField(blank=True)
    context_revision = models.PositiveIntegerField(default=1)
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="chatbot_configs_updated",
    )

    class Meta:
        ordering = ["course_version__course__name", "-course_version__version_number"]
        permissions = [("manage_course_chatbot", "Can manage course chatbot configuration")]

    def clean(self):
        if self.is_enabled and not self.approved_context.strip():
            raise ValidationError({"approved_context": "Approved context is required before enabling the chatbot."})


class CourseChatSession(TimestampedUUIDModel):
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="course_chat_sessions"
    )
    course_version = models.ForeignKey(
        CourseVersion, on_delete=models.PROTECT, related_name="chat_sessions"
    )
    context_revision = models.PositiveIntegerField()
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["student", "course_version", "is_active"], name="chat_sess_student_ver_idx"),
        ]


class CourseChatMessage(models.Model):
    class Role(models.TextChoices):
        USER = "USER", "User"
        ASSISTANT = "ASSISTANT", "Assistant"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session = models.ForeignKey(CourseChatSession, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=12, choices=Role.choices)
    content = models.TextField()
    citations = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["session", "created_at"], name="chat_msg_session_created_idx")]
