from rest_framework import serializers

from .models import MediaAsset


class MediaAssetSerializer(serializers.ModelSerializer):
    upload = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = MediaAsset
        fields = (
            "id", "file_name", "file", "upload", "file_type", "mime_type", "file_size", "storage_path",
            "cdn_url", "duration_seconds", "uploaded_by", "created_at", "status",
        )
        read_only_fields = ("file", "uploaded_by", "created_at")
        extra_kwargs = {
            "file_name": {"required": False}, "file_type": {"required": False},
            "mime_type": {"required": False}, "file_size": {"required": False},
            "storage_path": {"required": False},
        }

    def validate_upload(self, value):
        if value.size > 500 * 1024 * 1024:
            raise serializers.ValidationError("Video files must be 500 MB or smaller.")
        content_type = (getattr(value, "content_type", "") or "").lower()
        if content_type and not content_type.startswith("video/"):
            raise serializers.ValidationError("Upload a supported video file.")
        return value

    def validate(self, attrs):
        upload = attrs.get("upload")
        if upload:
            attrs["file_name"] = upload.name
            attrs["file_type"] = "VIDEO"
            attrs["mime_type"] = getattr(upload, "content_type", "") or "application/octet-stream"
            attrs["file_size"] = upload.size
            attrs["status"] = MediaAsset.Status.READY
            # The model's FileField supplies the final storage name after save.
        elif not self.instance:
            required = ("file_name", "file_type", "mime_type", "storage_path")
            missing = [field for field in required if not attrs.get(field)]
            if missing:
                raise serializers.ValidationError({field: "Provide this metadata or upload a video file." for field in missing})
        return attrs

    def validate_file_size(self, value):
        if value < 0:
            raise serializers.ValidationError("File size cannot be negative.")
        return value
