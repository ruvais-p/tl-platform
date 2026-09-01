import tempfile

from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework.test import APITestCase

from accounts.constants import GroupName
from media_library.models import MediaAsset


@override_settings(MEDIA_ROOT=tempfile.mkdtemp())
class MediaUploadTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.manager = get_user_model().objects.create_user(email="media@example.com", password="test-pass-123")
        group, _ = Group.objects.get_or_create(name=GroupName.CONTENT_MANAGER)
        group.permissions.add(Permission.objects.get(codename="add_mediaasset"))
        cls.manager.groups.add(group)

    def setUp(self):
        self.client.force_authenticate(self.manager)

    def test_authorized_content_role_can_upload_concept_video(self):
        upload = SimpleUploadedFile("concept.mp4", b"video-bytes", content_type="video/mp4")
        response = self.client.post("/api/v1/media-assets/", {"upload": upload}, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        asset = MediaAsset.objects.get(pk=response.data["id"])
        self.assertEqual(asset.uploaded_by, self.manager)
        self.assertEqual(asset.file_type, "VIDEO")
        self.assertEqual(asset.mime_type, "video/mp4")
        self.assertEqual(asset.file_size, 11)
        self.assertTrue(asset.file.name.startswith("tella/video/"))

    def test_non_video_upload_is_rejected(self):
        upload = SimpleUploadedFile("notes.txt", b"not a video", content_type="text/plain")
        response = self.client.post("/api/v1/media-assets/", {"upload": upload}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertIn("upload", response.data)
