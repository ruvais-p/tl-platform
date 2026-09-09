from django.conf import settings
from rest_framework import serializers

from .models import CourseChatbotConfig


class CourseChatbotConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = CourseChatbotConfig
        fields = (
            "id", "course_version", "is_enabled", "approved_context", "context_revision",
            "updated_by", "created_at", "updated_at",
        )
        read_only_fields = ("context_revision", "updated_by", "created_at", "updated_at")

    def validate_approved_context(self, value):
        if len(value) > settings.COURSE_CHAT_CONTEXT_MAX_CHARS:
            raise serializers.ValidationError(
                f"Approved context cannot exceed {settings.COURSE_CHAT_CONTEXT_MAX_CHARS} characters."
            )
        return value.strip()

    def validate(self, attrs):
        current_context = self.instance.approved_context if self.instance else ""
        current_enabled = self.instance.is_enabled if self.instance else False
        context = attrs.get("approved_context", current_context)
        enabled = attrs.get("is_enabled", current_enabled)
        if enabled and not context.strip():
            raise serializers.ValidationError({"approved_context": "Approved context is required before enabling the chatbot."})
        return attrs


class CourseChatRequestSerializer(serializers.Serializer):
    message = serializers.CharField(trim_whitespace=True)
    session_id = serializers.UUIDField(required=False, allow_null=True)

    def validate_message(self, value):
        if len(value) > settings.COURSE_CHAT_MESSAGE_MAX_CHARS:
            raise serializers.ValidationError(
                f"Message cannot exceed {settings.COURSE_CHAT_MESSAGE_MAX_CHARS} characters."
            )
        return value
