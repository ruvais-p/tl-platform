from functools import wraps

from django.contrib.auth import get_user_model
from django.contrib.auth.views import redirect_to_login
from django.contrib.auth.models import Group
from django.core.exceptions import PermissionDenied
from django.db.models import Count
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_http_methods

from accounts.constants import GroupName, PROTECTED_GROUPS
from accounts.services import assign_group
from assessments.models import LearningCheck, Question
from content.models import ActivityContent, Experiment, PracticeSet, Video
from curriculum.models import Chapter, Course, CourseVersion, LearningActivity, Program, Subtopic
from media_library.models import MediaAsset
from progress.models import CourseProgress
from students.models import Enrollment, StudentGroup

from .forms import (ActivityContentForm, ChapterForm, CourseForm, CourseVersionForm, EnrollmentForm, ExperimentForm,
                    GroupPermissionsForm, LearningActivityForm, LearningCheckForm, MediaAssetForm,
                    PracticeSetForm, ProgramForm, QuestionForm, StudentGroupForm, SubtopicForm,
                    UserGroupForm, VideoForm)

User = get_user_model()


def portal_permission(permission):
    def decorator(view):
        @wraps(view)
        def wrapped(request, *args, **kwargs):
            if not request.user.is_authenticated:
                return redirect_to_login(request.get_full_path(), "/admin/login/")
            if not request.user.has_perm(permission):
                raise PermissionDenied
            return view(request, *args, **kwargs)
        return wrapped
    return decorator


def portal_login_required(view):
    @wraps(view)
    def wrapped(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect_to_login(request.get_full_path(), "/admin/login/")
        return view(request, *args, **kwargs)
    return wrapped


def dashboard(request):
    if not request.user.is_authenticated:
        return redirect_to_login(request.get_full_path(), "/admin/login/")
    return render(request, "admin_portal/dashboard.html", {
        "counts": {"programs": Program.objects.count(), "courses": Course.objects.count(), "students": User.objects.filter(groups__name=GroupName.STUDENT).distinct().count(), "enrollments": Enrollment.objects.count(), "progress": CourseProgress.objects.count()},
    })


def _crud(model, form_class, permission, title, resource, request, pk=None):
    if not request.user.has_perm(permission):
        raise PermissionDenied
    instance = get_object_or_404(model, pk=pk) if pk else None
    if request.method == "POST":
        form = form_class(request.POST, request.FILES, instance=instance)
        if form.is_valid():
            obj = form.save(commit=False)
            if hasattr(obj, "created_by") and not obj.created_by_id:
                obj.created_by = request.user
            if hasattr(obj, "updated_by"):
                obj.updated_by = request.user
            if hasattr(obj, "uploaded_by") and not obj.uploaded_by_id:
                obj.uploaded_by = request.user
            obj.save()
            if isinstance(obj, MediaAsset) and obj.file and obj.storage_path.startswith("upload-pending/"):
                obj.storage_path = obj.file.name
                obj.cdn_url = obj.file.url
                obj.save(update_fields=("storage_path", "cdn_url"))
            return redirect("portal-list", resource=resource)
    else:
        initial = {"activity": request.GET.get("activity")} if request.GET.get("activity") and "activity" in form_class.base_fields else None
        form = form_class(instance=instance, initial=initial)
    return render(request, "admin_portal/form.html", {"form": form, "title": title, "object": instance})


RESOURCES = {
    "programs": (Program, ProgramForm, "curriculum.add_program", "curriculum.view_program", "Program"),
    "courses": (Course, CourseForm, "curriculum.add_course", "curriculum.view_course", "Course"),
    "course-versions": (CourseVersion, CourseVersionForm, "curriculum.add_courseversion", "curriculum.view_courseversion", "Course Version"),
    "chapters": (Chapter, ChapterForm, "curriculum.add_chapter", "curriculum.view_chapter", "Chapter"),
    "subtopics": (Subtopic, SubtopicForm, "curriculum.add_subtopic", "curriculum.view_subtopic", "Subtopic"),
    "activities": (LearningActivity, LearningActivityForm, "curriculum.add_learningactivity", "curriculum.view_learningactivity", "Learning Activity"),
    "activity-content": (ActivityContent, ActivityContentForm, "content.add_activitycontent", "content.view_activitycontent", "Activity Content"),
    "videos": (Video, VideoForm, "content.add_video", "content.view_video", "Video"),
    "experiments": (Experiment, ExperimentForm, "content.add_experiment", "content.view_experiment", "Experiment"),
    "practice-sets": (PracticeSet, PracticeSetForm, "content.add_practiceset", "content.view_practiceset", "Practice Set"),
    "media-assets": (MediaAsset, MediaAssetForm, "media_library.add_mediaasset", "media_library.view_mediaasset", "Media Asset"),
    "student-groups": (StudentGroup, StudentGroupForm, "students.manage_student_groups", "students.view_studentgroup", "Student Group"),
    "enrollments": (Enrollment, EnrollmentForm, "students.manage_students", "students.view_enrollment", "Enrollment"),
    "questions": (Question, QuestionForm, "assessments.add_question", "assessments.view_question", "Question"),
    "learning-checks": (LearningCheck, LearningCheckForm, "assessments.add_learningcheck", "assessments.view_learningcheck", "Learning Check"),
}


@portal_login_required
def resource_list(request, resource):
    if resource not in RESOURCES:
        raise PermissionDenied
    model, form_class, permission, view_permission, title = RESOURCES[resource]
    if not request.user.has_perm(view_permission):
        raise PermissionDenied
    rows = model.objects.all()[:100]
    fields = [f.name for f in model._meta.fields if f.name not in {"id", "created_at", "updated_at"}]
    rows = [{"id": row.pk, "values": [getattr(row, field) for field in fields]} for row in rows]
    return render(request, "admin_portal/object_list.html", {"title": title, "resource": resource, "rows": rows, "fields": fields})


@portal_login_required
def resource_create(request, resource):
    if resource not in RESOURCES:
        raise PermissionDenied
    model, form_class, permission, _view_permission, title = RESOURCES[resource]
    return _crud(model, form_class, permission, title, resource, request)


@portal_login_required
def resource_edit(request, resource, pk):
    if resource not in RESOURCES:
        raise PermissionDenied
    model, form_class, permission, _view_permission, title = RESOURCES[resource]
    return _crud(model, form_class, permission.replace("add_", "change_"), title, resource, request, pk=pk)


@portal_login_required
def activity_detail(request, pk):
    if not request.user.has_perm("curriculum.view_learningactivity"):
        raise PermissionDenied
    activity = get_object_or_404(
        LearningActivity.objects.select_related("subtopic__chapter__course_version__course")
        .prefetch_related("content", "video", "experiment", "practice_set__items"), pk=pk,
    )
    return render(request, "admin_portal/activity_detail.html", {"activity": activity})


@portal_permission("accounts.view_user")
def user_access(request, user_id):
    if not request.user.has_perm("accounts.manage_users"):
        raise PermissionDenied
    target = get_object_or_404(User, pk=user_id)
    form = UserGroupForm(request.POST or None)
    if request.method == "POST" and form.is_valid():
        group = form.cleaned_data["group"]
        if form.cleaned_data["action"] == "add":
            assign_group(actor=request.user, user=target, group=group)
        elif group.name not in PROTECTED_GROUPS or request.user.has_perm("accounts.manage_permissions"):
            target.groups.remove(group)
        return redirect("portal-user-access", user_id=target.pk)
    return render(request, "admin_portal/user_access.html", {"target": target, "form": form})


@portal_permission("accounts.manage_users")
def users_access(request):
    query = request.GET.get("q", "").strip()
    users = User.objects.prefetch_related("groups").order_by("email")
    if query:
        users = users.filter(email__icontains=query)
    return render(request, "admin_portal/users.html", {"users": users[:200], "query": query})


@portal_permission("accounts.manage_permissions")
def groups_access(request):
    groups = Group.objects.prefetch_related("permissions", "user_set").all()
    return render(request, "admin_portal/groups.html", {"groups": groups})


@portal_permission("accounts.manage_permissions")
@require_http_methods(["GET", "POST"])
def group_permissions(request, group_id):
    group = get_object_or_404(Group, pk=group_id)
    form = GroupPermissionsForm(request.POST or None, initial={"permissions": group.permissions.all()})
    if request.method == "POST" and form.is_valid():
        group.permissions.set(form.cleaned_data["permissions"])
        return redirect("portal-groups")
    return render(request, "admin_portal/group_permissions.html", {"group": group, "form": form})
