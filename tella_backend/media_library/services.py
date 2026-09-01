from django.core.exceptions import PermissionDenied
import uuid

from .models import MediaAsset


def create_media_asset(*, actor, **data) -> MediaAsset:
    if not actor.has_perm("media_library.add_mediaasset"):
        raise PermissionDenied("You cannot create media assets.")
    upload = data.pop("upload", None)
    if upload:
        data["storage_path"] = f"upload-pending/{uuid.uuid4().hex}"
    asset = MediaAsset(uploaded_by=actor, **data)
    if upload:
        asset.file = upload
        asset.save()
        asset.storage_path = asset.file.name
        asset.cdn_url = asset.file.url
        asset.save(update_fields=("storage_path", "cdn_url"))
        return asset
    asset.save()
    return asset
