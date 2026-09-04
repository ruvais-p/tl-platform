from django.conf import settings
from django.test import SimpleTestCase


class BackendSurfaceTests(SimpleTestCase):
    def test_django_is_api_only(self):
        self.assertNotIn("portal", settings.INSTALLED_APPS)
        self.assertNotIn("django.contrib.admin", settings.INSTALLED_APPS)
        self.assertNotIn("django.contrib.sessions", settings.INSTALLED_APPS)
        self.assertNotIn("django.contrib.messages", settings.INSTALLED_APPS)
        self.assertNotIn("django.contrib.staticfiles", settings.INSTALLED_APPS)
        self.assertEqual(settings.TEMPLATES, [])
        self.assertEqual(
            settings.REST_FRAMEWORK["DEFAULT_RENDERER_CLASSES"],
            ("rest_framework.renderers.JSONRenderer",),
        )
        self.assertEqual(self.client.get("/manage/").status_code, 404)
        self.assertEqual(self.client.get("/admin/").status_code, 404)

    def test_health_endpoint_remains_available(self):
        response = self.client.get("/api/v1/health/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"ok": True})
