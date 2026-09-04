from rest_framework import serializers

from .models import (
    ActivityProgress, AssessmentAttempt, BadgeAward, CareerOpportunity,
    ChapterProgress, CourseProgress, PointEvent, SubtopicProgress,
)


class ActivityProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityProgress
        fields = (
            "id",
            "activity",
            "status",
            "progress_percentage",
            "time_spent_seconds",
            "started_at",
            "last_accessed_at",
            "attempt_count",
            "metadata",
            "extra",
            "completed_at",
            "updated_at",
        )
        read_only_fields = ("id", "completed_at", "updated_at", "started_at", "last_accessed_at")


class SubtopicProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubtopicProgress
        fields = tuple(field.name for field in SubtopicProgress._meta.fields)


class ChapterProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChapterProgress
        fields = tuple(field.name for field in ChapterProgress._meta.fields)


class CourseProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseProgress
        fields = tuple(field.name for field in CourseProgress._meta.fields)


class ProgressUpsertSerializer(serializers.Serializer):
    activity = serializers.UUIDField()
    progress_percentage = serializers.DecimalField(min_value=0, max_value=100, max_digits=5, decimal_places=2, required=False)
    time_spent_seconds = serializers.IntegerField(min_value=0, required=False, default=0)
    metadata = serializers.JSONField(required=False, default=dict)
    status = serializers.CharField(required=False, default="in_progress")
    extra = serializers.JSONField(required=False, default=dict)
    event = serializers.CharField(required=False, allow_blank=True)


class PointEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = PointEvent
        fields = ("id", "reason", "points", "created_at")


class BadgeAwardSerializer(serializers.ModelSerializer):
    label = serializers.CharField(source="get_code_display", read_only=True)

    class Meta:
        model = BadgeAward
        fields = ("id", "code", "label", "created_at")


class CareerOpportunitySerializer(serializers.ModelSerializer):
    class Meta:
        model = CareerOpportunity
        fields = ("id", "title", "kind", "summary", "url")


class StaffActivityProgressSerializer(serializers.ModelSerializer):
    student_email = serializers.EmailField(
        source="enrollment.student.email", read_only=True
    )
    course_name = serializers.CharField(
        source="enrollment.course.name", read_only=True
    )
    activity_title = serializers.CharField(source="activity.title", read_only=True)

    class Meta:
        model = ActivityProgress
        fields = tuple(field.name for field in ActivityProgress._meta.fields) + (
            "student_email",
            "course_name",
            "activity_title",
        )
        read_only_fields = fields


class StaffPointEventSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    activity_title = serializers.CharField(source="activity.title", read_only=True)

    class Meta:
        model = PointEvent
        fields = tuple(field.name for field in PointEvent._meta.fields) + (
            "user_email",
            "activity_title",
        )
        read_only_fields = fields


class StaffBadgeAwardSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    activity_title = serializers.CharField(source="activity.title", read_only=True)
    label = serializers.CharField(source="get_code_display", read_only=True)

    class Meta:
        model = BadgeAward
        fields = tuple(field.name for field in BadgeAward._meta.fields) + (
            "user_email",
            "activity_title",
            "label",
        )
        read_only_fields = fields


class StaffCareerOpportunitySerializer(serializers.ModelSerializer):
    class Meta:
        model = CareerOpportunity
        fields = "__all__"
        read_only_fields = ("id", "created_at", "updated_at")


class StaffLegacyAssessmentAttemptSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)
    activity_title = serializers.CharField(source="activity.title", read_only=True)

    class Meta:
        model = AssessmentAttempt
        fields = tuple(field.name for field in AssessmentAttempt._meta.fields) + (
            "user_email",
            "activity_title",
        )
        read_only_fields = fields
