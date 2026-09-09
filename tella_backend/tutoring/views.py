from rest_framework import mixins, status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from accounts.permissions import IsStudent

from . import services
from .models import CourseChatbotConfig
from .permissions import CanManageCourseChatbot
from .serializers import CourseChatRequestSerializer, CourseChatbotConfigSerializer


class CourseChatThrottle(UserRateThrottle):
    scope = "course_chat"


class CourseChatbotConfigViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    permission_classes = [IsAuthenticated, CanManageCourseChatbot]
    serializer_class = CourseChatbotConfigSerializer
    queryset = CourseChatbotConfig.objects.select_related("course_version", "updated_by")

    def get_queryset(self):
        queryset = super().get_queryset()
        if course_version := self.request.query_params.get("course_version"):
            queryset = queryset.filter(course_version_id=course_version)
        return queryset

    def perform_create(self, serializer):
        serializer.instance = services.save_chatbot_config(actor=self.request.user, **serializer.validated_data)

    def perform_update(self, serializer):
        serializer.instance = services.save_chatbot_config(
            actor=self.request.user, instance=self.get_object(), **serializer.validated_data
        )


class CourseChatView(APIView):
    permission_classes = [IsAuthenticated, IsStudent]
    throttle_classes = [CourseChatThrottle]

    def post(self, request, course_id):
        serializer = CourseChatRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            result = services.send_course_chat(
                student=request.user,
                course_id=course_id,
                message=serializer.validated_data["message"],
                session_id=serializer.validated_data.get("session_id"),
            )
        except services.ChatAccessError:
            return Response({"detail": "Course chatbot not found."}, status=status.HTTP_404_NOT_FOUND)
        except services.ChatProviderUnavailable:
            return Response(
                {"error": {"code": "TUTOR_UNAVAILABLE", "message": "Tutor temporarily unavailable.", "details": {}}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        return Response({
            "session_id": result.session_id,
            "reply": result.reply,
            "grounded": result.grounded,
            "citations": result.citations,
        })
