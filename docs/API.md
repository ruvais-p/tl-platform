# Tella Platform API

Version: `v1` · Base URL: `http://127.0.0.1:8000/api/v1/`

Django is the source of truth. Moodle and other clients consume this API and must not implement authorization, enrollment, progress, or scoring rules locally.

For step-by-step data creation with Next.js/API examples, see [DATA_ENTRY_GUIDE.md](DATA_ENTRY_GUIDE.md).

## Conventions

- IDs are UUIDs unless noted otherwise; timestamps are ISO-8601 UTC.
- Send JSON with `Content-Type: application/json`.
- Authenticated requests use `Authorization: Bearer <access-token>`.
- Collections currently return JSON arrays (pagination is not enabled yet).
- `404` is also used for inaccessible objects to avoid resource-discovery leaks.
- Errors use DRF's `detail` field; validation errors may return field-keyed arrays.

```json
{"detail": "You are not enrolled in this course."}
```

## Authentication

### Login

`POST /auth/login/`

```json
{"email": "student@example.com", "password": "your-password"}
```

Returns `access` and `refresh`. Access tokens default to 15 minutes; refresh tokens default to seven days and rotate with blacklist protection.

### Refresh and logout

- `POST /auth/refresh/` with `{"refresh":"<refresh-token>"}`.
- `POST /auth/logout/` (Bearer token required) with the same refresh payload. Returns `204` and blacklists the token.

### Current user

`GET /auth/me/` (Bearer token required)

```json
{"id":"<uuid>","email":"teacher@example.com","username":"teacher","first_name":"Ada","last_name":"Lovelace","display_name":"Ada Lovelace","is_active":true,"is_superuser":false,"date_joined":"2026-08-28T10:00:00Z","groups":["TEACHER"],"permissions":["accounts.view_user"]}
```

### Staff account and role management

Authorized staff use these endpoints:

| Operation | Route | Required authority |
| --- | --- | --- |
| List/create accounts | `GET`/`POST /auth/users/` | `accounts.manage_users`; creation also requires `accounts.add_user` |
| Read/update account | `GET`/`PATCH /auth/users/{id}/` | `accounts.manage_users`; updates also require `accounts.change_user` |
| List roles | `GET /auth/groups/` | `accounts.manage_users` |
| Replace role permissions | `PATCH /auth/groups/{id}/permissions/` | `accounts.manage_permissions` |
| Permission catalog | `GET /auth/permissions/` | `accounts.manage_permissions` |
| Staff dashboard totals | `GET /auth/staff-summary/` | Authenticated; response is filtered by effective permissions |

User writes accept `email`, `username`, names, optional `is_active`, role names in `groups`, and a password (required on create and optional on update). Password validation uses Django’s configured validators. Only permission administrators may assign `SUPER_ADMIN` or update an account that already holds that protected role.

### Moodle exchange

`POST /auth/moodle/exchange/` is an unauthenticated signed bridge. Request fields: `moodle_user_id`, `email`, optional names, Unix `timestamp`, and HMAC-SHA256 `signature`. Sign `{moodle_user_id}|{lowercase_email}|{timestamp}` with `MOODLE_SSO_SECRET`; timestamps older than five minutes are rejected. Django creates/resolves an `ExternalUserMapping` (`MOODLE`) and returns JWTs plus the user.

## Authorization

Roles are Django Groups: `SUPER_ADMIN`, `ADMIN`, `ACADEMIC_MANAGER`, `CONTENT_MANAGER`, `TEACHER`, and `STUDENT`. `StudentGroup` is a separate class/cohort model. Students see only published curriculum for active, unexpired enrollments pinned to the requested CourseVersion. Teachers see only students in assigned StudentGroups. Sensitive writes are checked by API permissions and domain services.

## Curriculum

Hierarchy: `Program → Course → CourseVersion → Chapter → Subtopic → LearningActivity`.

All resources use standard collection `GET`/`POST` and detail `GET`/`PUT`/`PATCH`/`DELETE`, subject to permissions.

| Resource | Routes and actions | Key fields |
| --- | --- | --- |
| Programs | `/programs/`, `/programs/{id}/` | `name`, unique `code`, `description`, `grade`, `status`, nested courses |
| Courses | `/courses/`, `/courses/{id}/`; `/courses/{id}/chapters/`, `/publish/`, `/duplicate/` | `program`, `name`, unique `code`, `status`, `display_order`, nested versions |
| Versions | `/course-versions/`, `/course-versions/{id}/`; `POST /{id}/reorder_chapters/` | unique `(course, version_number)`, `name`, `status`, `published_at` |
| Chapters | `/chapters/`, `/chapters/{id}/`; `/subtopics/`, `/reorder_subtopics/` | `course_version`, title/slug/number, `completion_rule`, nested subtopics |
| Subtopics | `/subtopics/`, `/subtopics/{id}/`; `/activities/`, `/reorder_activities/` | `chapter`, title/slug, objectives, nested activities |
| Activities | `/activities/`, `/activities/{id}/` | `subtopic`, `activity_type`, title, required flag, completion rule, status, nested read-only `experiment` |

Statuses: `DRAFT`, `IN_REVIEW`, `APPROVED`, `PUBLISHED`, `ARCHIVED`. Publishing never exposes draft records to students.

## Content and media

| Resource | Route | Core fields |
| --- | --- | --- |
| Activity content | `/activity-content/` | `activity`, `content_type`, flexible `content` JSON |
| Videos | `/videos/` | media/thumbnail, title, duration, transcript, captions, completion percentage (default 90) |
| Experiments | `/experiments/` | activity, type (`HTML_INTERACTIVE`, `EMBEDDED`, `SIMULATION`, `QUESTION_BASED`), instructions, declarative runtime `configuration`, optional external URL |
| Practice sets/items | `/practice-sets/`, `/practice-items/` | ordered video/question/practice sequence |
| Media assets | `/media-assets/` | multipart `upload` or storage metadata; read-only playback `public_url`; CDN URL; status |

Multipart uploads are stored through Django's configured storage backend. In the local demo, `public_url` points to Django's development media route; production deployments should use object storage/CDN delivery.

When `configuration.renderer` is present, `schema_version` must be `1`. Installed renderer names are `geogebra`, `graphspace`, and `placeholder`; unknown extension fields are preserved. A GeoGebra definition requires either `renderer_config.material_id` or a validated `renderer_config.workspace`. A GraphSpace definition launches the bundled tool at `/graphspace/index_3.html` and requires administrator-authored `heading` and `message` fields. The current structured GeoGebra workspace type is `linear_programming`; its posted variable, objective, constraint, and axis data is interpreted by both the Next.js and Moodle adapters. Legacy question-based configuration without a renderer remains accepted but is not mounted by the generic Moodle experiment runner.

## Students and enrollment

| Resource | Routes | Rules |
| --- | --- | --- |
| Students | `/students/`, `/students/{id}/` | Teachers see assigned-cohort students; students see themselves |
| Student groups | `/student-groups/`, `/student-groups/{id}/` | Cohort name/code/grade/year/teacher/status |
| Teachers | `/teachers/` | Active users eligible for optional student-group teacher assignment |
| Memberships | `/student-group-members/`, `/student-group-members/{id}/`; `POST /student-groups/{id}/members/` | Unique `(student_group, student)`; body `{"student":"<uuid>"}` |
| Enrollments | `/enrollments/`, `/enrollments/{id}/` | Exact CourseVersion; `ACTIVE`, `COMPLETED`, `SUSPENDED`, `EXPIRED`, `CANCELLED` |
| Assignments | `/course-assignments/`, `/course-assignments/{id}/` | Exactly one of `student_group` or `student`; atomic enrollment creation |

`GET /course-assignments/?student_group=<uuid>` safely filters the caller's already-scoped assignment queryset. A successful assignment creation may include `enrollment_outcome` with `created`, `existing`, and `targeted` counts. Active group assignments are also applied atomically when a student joins later. A conflicting active enrollment in another version of the same course rolls back the membership or assignment operation. Removing a group membership does not cancel or delete existing enrollments.
| LMS mappings | `/external-user-mappings/`, `/external-user-mappings/{id}/` | Unique `(provider, external_user_id)` |

```json
{"student":"<user-uuid>","course":"<course-uuid>","course_version":"<version-uuid>","status":"ACTIVE","expires_at":null}
```

## Progress

Progress is persisted and propagated: `ActivityProgress → SubtopicProgress → ChapterProgress → CourseProgress`.

| Method | Route | Description |
| --- | --- | --- |
| `GET` | `/me/progress/` | Current user's course snapshots |
| `GET` | `/me/activity-progress/` | Current user's activity rows; optional `?course={course_id}` filter |
| `GET` | `/me/courses/{course_id}/progress/` | Course snapshot |
| `GET` | `/me/chapters/{chapter_id}/progress/` | Chapter snapshot |
| `GET` | `/me/activities/{activity_id}/progress/` | Activity snapshot |
| `POST` | `/activities/{activity_id}/start/` | Start enrolled activity |
| `POST` | `/activities/{activity_id}/progress/` | Record percentage/time/metadata |
| `POST` | `/activities/{activity_id}/complete/` | Complete server-side |

```json
{"progress_percentage":75,"time_spent_seconds":420,"metadata":{"player":"moodle"}}
```

Percentages must be 0–100. Writes require an active, unexpired, exact-version enrollment and use transactions/row locks. Legacy workshop clients may continue using `POST /progress/` with `activity`, `status`, `extra`, and `event`.

## Course chatbot

Authorized academic/content managers configure one chatbot per exact course version through `GET`/`POST /course-chatbot-configs/` and `GET`/`PATCH`/`PUT /course-chatbot-configs/{id}/`. Filtering by `?course_version={version_id}` is supported. These routes require `tutoring.manage_course_chatbot`; students cannot read them. Enabling requires non-blank `approved_context`, and every saved change increments `context_revision` and invalidates older sessions.

Learner course payloads contain only `chatbot_available`. They never contain the approved context, provider key, prompt, or configuration audit metadata.

An enrolled student sends a turn to `POST /courses/{course_id}/chat/`:

```json
{"message":"Explain the Pythagorean theorem.","session_id":"<optional-platform-session-uuid>"}
```

A grounded result has this shape:

```json
{
  "session_id":"<platform-session-uuid>",
  "reply":"For a right triangle, a squared plus b squared equals c squared.",
  "grounded":true,
  "citations":[{"chunk_id":"C1","excerpt":"a squared plus b squared equals c squared"}]
}
```

The course ID resolves the student's active, unexpired enrollment and its exact published version; clients do not submit a version. Unknown, inaccessible, disabled, mismatched, or stale sessions return `404` without contacting the provider. Unsupported questions and responses that fail exact evidence validation return the configured refusal with `grounded: false`. Provider transport/authentication/malformed-response failures return `503` with error code `TUTOR_UNAVAILABLE`; chat throttling returns `429`.

Django calls the Math Tutor `/api/ask` service with the server-only `MATH_TUTOR_API_KEY`. Configure request, context, provider, history, chunk, timeout, throttle, and retention limits through the `COURSE_CHAT_*` and `MATH_TUTOR_*` environment variables shown in `tella_backend/.env.example`. Do not expose the key through `NEXT_PUBLIC_*`, logs, or browser responses. Rotate it through the backend secret store and restart backend instances.

Chat messages are not grading/progress data. Metadata-only operational logs omit questions, answers, context, prompts, and credentials. Schedule `python manage.py purge_course_chat` at least daily; it deletes sessions and cascade-deletes messages after `COURSE_CHAT_RETENTION_DAYS`. Each provider request sends selected approved context plus bounded recent conversation, so production enablement requires confirmation of the provider's processing, retention, and training terms. The supplied API reference does not define those terms.

## Assessments

| Operation | Route |
| --- | --- |
| Question bank/options | `/questions/`, `/question-options/` |
| Case studies/links | `/case-studies/`, `/case-study-questions/` |
| Learning checks/question links | `/learning-checks/`, `/learning-check-questions/` |
| Start attempt | `POST /learning-checks/{id}/start/` |
| Submit attempt | `POST /learning-checks/{id}/submit/` |
| Own results | `GET /learning-checks/{id}/results/` |

Question types: `MCQ`, `MULTI_SELECT`, `TRUE_FALSE`, `NUMERIC`, `SHORT_TEXT`, `LONG_TEXT`, `MATH_EXPRESSION`.

```json
{"attempt_id":"<attempt-uuid>","answers":[{"question":"<question-uuid>","answer":"<option-uuid>"}],"time_spent_seconds":95}
```

The server verifies question membership, enrollment, ownership, publication, and `max_attempts`; calculates marks/pass-fail from canonical data; ignores client scores; and updates chapter learning-check progress. Student learning-check responses intentionally omit answer metadata, option correctness, and explanations before submission.

## Staff reports and operations

The Next.js staff workspace consumes these permission-checked endpoints. Read-only records are scoped to all students, an assigned cohort, or the signed-in student according to the caller's progress permissions.

| Resource | Route | Supported operations |
| --- | --- | --- |
| Activity progress | `/activity-progress-records/` | `GET` collection/detail |
| Assessment attempts and answers | `/assessment-attempts/`, `/assessment-answers/` | `GET` collection/detail |
| Point events and badge awards | `/point-events/`, `/badge-awards/` | `GET` collection/detail |
| Career opportunities | `/career-opportunities/` | Standard model-permission CRUD |
| Legacy activity attempts | `/legacy-assessment-attempts/` | `GET` collection/detail |
| Workshop configuration | `/workshop-configs/` | Standard model-permission CRUD |
| Saved workshop models | `/staff-workshop-models/` | `GET` collection/detail |

Writes require the corresponding standard Django model permission (`add_*`, `change_*`, or `delete_*`); reads require `view_*`. These routes are administrative APIs, not Django-rendered pages.

## Workshop compatibility

`GET/POST /workshop-models/` and `GET/PUT/PATCH /workshop-models/{id}/` remain as legacy backend compatibility endpoints, but the generic Moodle experiment runner does not call them. `GET /gamification/me/`, `GET /career/opportunities/`, and public `GET /health/` also remain available.

## Status codes and client rules

`200` success · `201` created · `204` no content · `400` validation/domain error · `401` missing/invalid JWT · `403` authenticated but unauthorized · `404` missing or intentionally hidden resource.

Clients must use `/api/v1/`, treat IDs as opaque, send JWTs, never calculate authoritative scores/progress, and never assume course access without a valid enrollment.
