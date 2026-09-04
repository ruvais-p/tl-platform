# Phase 1 — Backend Foundation (Django)

**Goal:** Establish the Django project structure, custom user model, core domain models adapted from the PRD for skill-enhancement / workshop use, REST API skeleton, and CORS configuration so the Moodle plugin can communicate securely.

**Key adaptation from PRD:**  
Because the product is skill-enhancement modules rather than full degree programmes, the hierarchy is lightly simplified while remaining extensible:

```
Program (e.g. “Business Mathematics Skill Path”)
  └── Course / Module (e.g. “Multivariable Modelling Workshop”)
        └── Chapter (logical grouping, optional)
              └── LearningActivity (type = INTERACTIVE_WORKSHOP | EXPERIMENT | …)
```

Student progress, enrolments and assessments still follow the PRD pattern.

## 1.1 Project Settings Essentials

In `tella_backend/settings.py` (or split settings):

- Use custom user model from day one (`AUTH_USER_MODEL = 'accounts.User'`).
- PostgreSQL as default database.
- `django-cors-headers` with a restrictive allow-list (Moodle origin only in production).
- Django REST Framework with Token or JWT authentication (JWT preferred for SSO later).
- `MEDIA_ROOT` / `MEDIA_URL` prepared for object storage later.
- Time zone Europe/Zagreb or UTC; language en + future hr.

## 1.2 Custom User Model (`accounts/models.py`)

Follow PRD section 7 exactly:

- UUID primary key
- Email as unique identifier
- Standard name fields, is_active, is_staff, timestamps
- Use `AbstractBaseUser` + `PermissionsMixin`

Roles table (or Django Groups + custom Role model) with codes:

- SUPER_ADMIN
- ADMIN
- CONTENT_MANAGER
- ACADEMIC_MANAGER
- TEACHER
- STUDENT

## 1.3 Core Curriculum Models (minimum viable for workshops)

Implement at least:

- `Program`
- `Course` (maps to a skill module)
- `CourseVersion` (recommended even for workshops)
- `Chapter` (optional grouping)
- `Subtopic`
- `LearningActivity` with `activity_type` choices that include:
  - `INTERACTIVE_WORKSHOP`
  - `EXPERIMENT`
  - `CONCEPT_VIDEO`
  - `OBSERVE_LEARN_PRACTICE`
  - future types from PRD

- `ActivityContent` (JSONB for flexible config) or specialised tables
- `Experiment` / `WorkshopConfig` table that stores the seven input fields + labels for the multivariate workshop (see Phase 2)

Student side:

- `Enrollment`
- `CourseProgress`, `ChapterProgress`, `SubtopicProgress`, `ActivityProgress`
- `AssessmentAttempt` / `AssessmentAnswer` (for later quizzes)

Media:

- `MediaAsset` (ready for S3/CDN)

## 1.4 REST API Skeleton

Under `/api/v1/`:

- Authentication endpoints (login, token refresh, Moodle SSO exchange – stub for now)
- `GET /programs/`, `GET /courses/{id}/` (full nested structure for the Moodle plugin)
- `GET /activities/{id}/` (returns configuration needed by the workshop JS)
- `POST /progress/` (upsert activity progress)
- `POST /workshop-models/` (save learner’s current business numbers – see Phase 2 data shape)
- `GET /workshop-models/{id}/`

Use DRF ViewSets + Serializers. All responses must be JSON and must not leak internal mathematical names.

## 1.5 Staff administration

Expose permission-checked JSON endpoints and implement the corresponding Next.js staff screens so Content Managers can:

- Create a Program → Course → LearningActivity of type INTERACTIVE_WORKSHOP
- Attach a WorkshopConfig (the seven numbers + product labels)
- Publish / unpublish

Django remains API-only. Operational reports and compatibility records also live in the permission-aware Next.js workspace.

## 1.6 Acceptance Criteria

- [ ] `python manage.py migrate` succeeds with zero errors
- [ ] Custom User model is the only user model
- [ ] A Content Manager can create a Course containing one INTERACTIVE_WORKSHOP activity via the Next.js staff workspace
- [ ] `GET /api/v1/courses/{id}/` returns a nested JSON structure consumable by the Moodle plugin
- [ ] CORS allows the local Moodle origin
- [ ] All models use UUID primary keys and proper timestamps

Proceed to Phase 2 only after the above are green.
