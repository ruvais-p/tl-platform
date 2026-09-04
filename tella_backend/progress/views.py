from django.db import models, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import viewsets

from accounts.constants import GroupName
from accounts.permissions import HasModelPermission
from curriculum.models import LearningActivity
from .models import (
    ActivityProgress,
    AssessmentAttempt,
    BadgeAward,
    CareerOpportunity,
    PointEvent,
)
from students.models import Enrollment
from .serializers import (
    ActivityProgressSerializer,
    BadgeAwardSerializer,
    CareerOpportunitySerializer,
    PointEventSerializer,
    ProgressUpsertSerializer,
    StaffActivityProgressSerializer,
    StaffBadgeAwardSerializer,
    StaffCareerOpportunitySerializer,
    StaffLegacyAssessmentAttemptSerializer,
    StaffPointEventSerializer,
)
from .services import ProgressService

EVENT_BADGES = {
    PointEvent.Reason.REACH_PEAK: BadgeAward.Code.FIRST_PEAK,
    PointEvent.Reason.EXPLORE_SLOPES: BadgeAward.Code.SLOPE_READER,
    PointEvent.Reason.EXPORT_REPORT: BadgeAward.Code.BUSINESS_OPTIMISER,
}


def _ensure_enrollment(user, activity):
    course = activity.subtopic.chapter.course_version.course
    enrollment = Enrollment.objects.filter(
        student=user, course=course,
        course_version=activity.subtopic.chapter.course_version,
        status=Enrollment.Status.ACTIVE,
    ).filter(
        models.Q(expires_at__isnull=True) | models.Q(expires_at__gt=timezone.now())
    ).first()
    if enrollment is None:
        raise PermissionDenied("An active enrollment for this course version is required.")
    return enrollment


def _award_event(user, activity, event_code):
    if not event_code:
        return None, None
    try:
        reason = PointEvent.Reason(event_code)
    except ValueError:
        return None, None
    points, _ = PointEvent.objects.get_or_create(
        user=user,
        activity=activity,
        reason=reason,
        defaults={"points": PointEvent.POINTS[reason]},
    )
    badge = None
    badge_code = EVENT_BADGES.get(reason)
    if badge_code:
        badge, _ = BadgeAward.objects.get_or_create(
            user=user, activity=activity, code=badge_code
        )
    if reason == PointEvent.Reason.REACH_PEAK:
        BadgeAward.objects.get_or_create(
            user=user, activity=activity, code=BadgeAward.Code.BUSINESS_OPTIMISER
        )
    return points, badge


class ProgressUpsertView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ProgressUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        activity = LearningActivity.objects.filter(id=data["activity"]).first()
        if not activity:
            return Response({"detail": "Activity not found."}, status=status.HTTP_404_NOT_FOUND)

        with transaction.atomic():
            enrollment = _ensure_enrollment(request.user, activity)
            progress = ProgressService.record_activity_progress(
                student=request.user, activity=activity,
                progress_percentage=data.get("progress_percentage", 100 if data.get("status") == "completed" else 0),
                time_spent_seconds=data.get("time_spent_seconds", 0),
                status="COMPLETED" if data.get("status") == "completed" else None,
                enrollment=enrollment,
            )
            extra = progress.extra or {}
            incoming = data.get("extra") or {}
            extra.update(incoming)
            progress.extra = extra
            progress.status = data.get("status") or progress.status
            if progress.status == "completed" and not progress.completed_at:
                progress.completed_at = timezone.now()
            progress.save()
            awarded_points, awarded_badge = _award_event(
                request.user, activity, data.get("event")
            )

        payload = ActivityProgressSerializer(progress).data
        payload["points"] = PointEventSerializer(awarded_points).data if awarded_points else None
        payload["badge"] = BadgeAwardSerializer(awarded_badge).data if awarded_badge else None
        return Response(payload)


class ActivityProgressActionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, activity_id, action):
        activity = LearningActivity.objects.filter(id=activity_id).select_related("subtopic__chapter__course_version__course").first()
        if activity is None:
            return Response({"detail": "Activity not found."}, status=404)
        action_payload = request.data.copy()
        action_payload["activity"] = str(activity_id)
        serializer = ProgressUpsertSerializer(data=action_payload)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if action == "start":
            data["progress_percentage"] = max(0, data.get("progress_percentage", 0))
            data["status"] = "IN_PROGRESS"
        elif action == "complete":
            data["progress_percentage"] = 100
            data["status"] = "COMPLETED"
        else:
            data["status"] = data.get("status")
        progress = ProgressService.record_activity_progress(
            student=request.user, activity=activity,
            progress_percentage=data.get("progress_percentage", 0),
            time_spent_seconds=data.get("time_spent_seconds", 0),
            status=data.get("status"), metadata=data.get("metadata"),
        )
        return Response(ActivityProgressSerializer(progress).data)


class GamificationMeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        points = PointEvent.objects.filter(user=request.user)
        badges = BadgeAward.objects.filter(user=request.user)
        total = sum(p.points for p in points)
        return Response(
            {
                "total_points": total,
                "events": PointEventSerializer(points, many=True).data,
                "badges": BadgeAwardSerializer(badges, many=True).data,
            }
        )


class CareerOpportunityListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = CareerOpportunity.objects.filter(is_published=True)
        return Response(CareerOpportunitySerializer(qs, many=True).data)


def visible_staff_activity_progress(user):
    queryset = ActivityProgress.objects.select_related(
        "enrollment__student", "enrollment__course", "activity"
    )
    if user.has_perm("progress.view_all_student_progress"):
        return queryset
    if user.has_perm("progress.view_assigned_student_progress"):
        return queryset.filter(
            enrollment__student__student_group_memberships__student_group__teacher=user
        ).distinct()
    if user.groups.filter(name=GroupName.STUDENT).exists():
        return queryset.filter(enrollment__student=user)
    return queryset.none()


class ActivityProgressStaffViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ActivityProgress.objects.all()
    serializer_class = StaffActivityProgressSerializer
    permission_classes = [IsAuthenticated, HasModelPermission]

    def get_queryset(self):
        return visible_staff_activity_progress(self.request.user).order_by(
            "-updated_at"
        )


class PointEventStaffViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PointEvent.objects.select_related("user", "activity")
    serializer_class = StaffPointEventSerializer
    permission_classes = [IsAuthenticated, HasModelPermission]


class BadgeAwardStaffViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = BadgeAward.objects.select_related("user", "activity")
    serializer_class = StaffBadgeAwardSerializer
    permission_classes = [IsAuthenticated, HasModelPermission]


class CareerOpportunityStaffViewSet(viewsets.ModelViewSet):
    queryset = CareerOpportunity.objects.all()
    serializer_class = StaffCareerOpportunitySerializer
    permission_classes = [IsAuthenticated, HasModelPermission]


class LegacyAssessmentAttemptStaffViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AssessmentAttempt.objects.select_related("user", "activity")
    serializer_class = StaffLegacyAssessmentAttemptSerializer
    permission_classes = [IsAuthenticated, HasModelPermission]
