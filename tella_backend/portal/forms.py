from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, Permission
from django.utils.text import slugify
import uuid

from assessments.models import LearningCheck, Question
from content.models import ActivityContent, Experiment, PracticeSet, Video
from curriculum.models import Chapter, Course, CourseVersion, LearningActivity, Program, Subtopic
from media_library.models import MediaAsset
from students.models import Enrollment, StudentGroup

User = get_user_model()


class ProgramForm(forms.ModelForm):
    class Meta:
        model = Program
        fields = ("name", "code", "description", "grade", "status")


class CourseForm(forms.ModelForm):
    class Meta:
        model = Course
        fields = ("program", "name", "code", "description", "status", "display_order")


class CourseVersionForm(forms.ModelForm):
    class Meta:
        model = CourseVersion
        fields = ("course", "version_number", "name", "status")


class ChapterForm(forms.ModelForm):
    require_subtopics = forms.BooleanField(
        label="Require all required subtopics",
        required=False,
        initial=True,
        help_text="Every required subtopic must be completed.",
    )
    require_case_study = forms.BooleanField(
        label="Require case study",
        required=False,
        help_text="The chapter case study must be completed.",
    )
    require_learning_check = forms.BooleanField(
        label="Require learning check",
        required=False,
        help_text="The learner must pass the learning check.",
    )
    learning_check_pass_percentage = forms.IntegerField(
        label="Learning check pass percentage",
        min_value=0,
        max_value=100,
        required=False,
        initial=70,
        help_text="Minimum score from 0 to 100.",
    )

    class Meta:
        model = Chapter
        fields = ("course_version", "title", "slug", "description", "chapter_number", "estimated_minutes", "is_required", "status", "display_order")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        rule = self.instance.completion_rule if self.instance and self.instance.pk else {}
        self.fields["require_subtopics"].initial = rule.get("required_subtopics", True)
        self.fields["require_case_study"].initial = rule.get("case_study_required", False)
        self.fields["require_learning_check"].initial = rule.get("learning_check_required", False)
        self.fields["learning_check_pass_percentage"].initial = rule.get("learning_check_pass_percentage", 70)

    def save(self, commit=True):
        self.instance.completion_rule = {
            "required_subtopics": self.cleaned_data.get("require_subtopics", False),
            "case_study_required": self.cleaned_data.get("require_case_study", False),
            "learning_check_required": self.cleaned_data.get("require_learning_check", False),
            "learning_check_pass_percentage": self.cleaned_data.get("learning_check_pass_percentage") or 70,
        }
        return super().save(commit=commit)


class SubtopicForm(forms.ModelForm):
    slug = forms.SlugField(required=False, help_text="Optional URL-friendly name. Leave blank to generate it from the title.")
    learning_objectives_text = forms.CharField(
        label="Learning objectives", required=False,
        widget=forms.Textarea(attrs={"rows": 4, "placeholder": "One objective per line\nSolve one-variable equations\nCheck a solution"}),
        help_text="Enter one learner outcome per line. These are stored as a JSON list automatically.",
    )

    class Meta:
        model = Subtopic
        fields = ("chapter", "title", "slug", "description", "estimated_minutes", "display_order", "is_required", "status")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        objectives = self.instance.learning_objectives if self.instance and self.instance.pk else []
        self.fields["learning_objectives_text"].initial = "\n".join(str(item) for item in (objectives or []))

    def clean_slug(self):
        return self.cleaned_data.get("slug") or slugify(self.cleaned_data.get("title", ""))

    def save(self, commit=True):
        raw = self.cleaned_data.get("learning_objectives_text", "")
        self.instance.learning_objectives = [line.strip() for line in raw.splitlines() if line.strip()]
        return super().save(commit=commit)


class LearningActivityForm(forms.ModelForm):
    class Meta:
        model = LearningActivity
        fields = ("subtopic", "activity_type", "title", "description", "display_order", "is_required", "estimated_minutes", "completion_rule", "status")


class ActivityContentForm(forms.ModelForm):
    class Meta:
        model = ActivityContent
        fields = ("activity", "content_type", "content")


class VideoForm(forms.ModelForm):
    class Meta:
        model = Video
        fields = ("activity", "media_asset", "thumbnail", "title", "description", "duration_seconds", "transcript", "captions", "completion_percentage")


class ExperimentForm(forms.ModelForm):
    class Meta:
        model = Experiment
        fields = ("activity", "experiment_type", "instructions", "configuration", "external_url")


class PracticeSetForm(forms.ModelForm):
    class Meta:
        model = PracticeSet
        fields = ("activity", "title", "description", "passing_score", "display_order")


class MediaAssetForm(forms.ModelForm):
    upload = forms.FileField(
        required=False,
        help_text="Upload an MP4, WebM, or Ogg video (maximum 500 MB). Metadata is filled automatically.",
        widget=forms.ClearableFileInput(attrs={"accept": "video/mp4,video/webm,video/ogg"}),
    )

    class Meta:
        model = MediaAsset
        fields = ("upload", "file_name", "file_type", "mime_type", "file_size", "storage_path", "cdn_url", "duration_seconds", "status")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name in ("file_name", "file_type", "mime_type", "file_size", "storage_path", "status"):
            self.fields[name].required = False

    def clean_upload(self):
        upload = self.cleaned_data.get("upload")
        if not upload:
            return upload
        if upload.size > 500 * 1024 * 1024:
            raise forms.ValidationError("Video files must be 500 MB or smaller.")
        if (getattr(upload, "content_type", "") or "").lower() not in {"video/mp4", "video/webm", "video/ogg"}:
            raise forms.ValidationError("Upload an MP4, WebM, or Ogg video.")
        return upload

    def clean(self):
        cleaned = super().clean()
        if not cleaned.get("upload") and not self.instance.pk:
            for name in ("file_name", "file_type", "mime_type", "storage_path"):
                if not cleaned.get(name):
                    self.add_error(name, "Provide this metadata or upload a video file.")
        return cleaned

    def save(self, commit=True):
        upload = self.cleaned_data.get("upload")
        if upload:
            self.instance.file = upload
            self.instance.file_name = upload.name
            self.instance.file_type = "VIDEO"
            self.instance.mime_type = upload.content_type
            self.instance.file_size = upload.size
            self.instance.status = MediaAsset.Status.READY
            self.instance.storage_path = f"upload-pending/{uuid.uuid4().hex}"
        asset = super().save(commit=commit)
        if commit and upload:
            asset.storage_path = asset.file.name
            asset.cdn_url = asset.file.url
            asset.save(update_fields=("storage_path", "cdn_url"))
        return asset


class StudentGroupForm(forms.ModelForm):
    class Meta:
        model = StudentGroup
        fields = ("name", "code", "grade", "academic_year", "teacher", "status")


class EnrollmentForm(forms.ModelForm):
    class Meta:
        model = Enrollment
        fields = ("student", "course", "course_version", "status", "expires_at")


class QuestionForm(forms.ModelForm):
    class Meta:
        model = Question
        fields = ("question_type", "question_text", "explanation", "difficulty", "marks", "subject", "grade", "status", "metadata")


class LearningCheckForm(forms.ModelForm):
    class Meta:
        model = LearningCheck
        fields = ("chapter", "title", "instructions", "passing_score", "max_attempts", "time_limit_minutes", "randomize_questions", "status")


class UserGroupForm(forms.Form):
    group = forms.ModelChoiceField(queryset=Group.objects.all())
    action = forms.ChoiceField(choices=(("add", "Add"), ("remove", "Remove")))


class GroupPermissionsForm(forms.Form):
    permissions = forms.ModelMultipleChoiceField(queryset=Permission.objects.select_related("content_type").order_by("content_type__app_label", "codename"), required=False, widget=forms.CheckboxSelectMultiple)
