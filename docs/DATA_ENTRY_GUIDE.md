# Tella Data Entry and Creation Guide

This guide explains how an administrator creates platform data in the correct dependency order. Use the permission-aware Next.js staff workspace for day-to-day administration, or the versioned REST API for imports and integrations.

## 1. Prepare the environment

From `tella_backend/`:

```bash
python manage.py migrate
python manage.py setup_groups
python manage.py createsuperuser
python manage.py runserver 0.0.0.0:8000
```

Start the Next.js application and sign in at `http://localhost:3000/login`. A Django superuser may sign in without an additional group assignment. Django exposes only the JSON backend at `/api/v1/`; all staff web workflows live in Next.js.

For API entry, obtain a token first:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/auth/login/ \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"your-password"}'
```

Set the returned token for subsequent requests:

```bash
export TOKEN='<access-token>'
```

PowerShell:

```powershell
$TOKEN = '<access-token>'
```

Every reference to `<uuid>` below must be replaced with an ID returned by an earlier request. Never invent IDs or rely on database integer IDs.

## 2. Create users and access roles

Create users through an authorized provisioning workflow, then run `setup_groups` after migrations. Assign one or more Django Groups:

```text
SUPER_ADMIN
ADMIN
ACADEMIC_MANAGER
CONTENT_MANAGER
TEACHER
STUDENT
```

Next.js: `/access`. Authorized administrators can create or edit accounts and assign ordinary roles. Only permission administrators can grant `SUPER_ADMIN` or edit role permissions; ordinary `ADMIN` accounts cannot edit protected accounts.

Students and teachers must belong to the corresponding Django Group before they are used in enrollments or StudentGroups.

## 3. Create the curriculum

Create records in this order:

```text
Program
  → Course
    → CourseVersion
      → Chapter
        → Subtopic
          → LearningActivity
```

### 3.1 Program

Next.js: `/manage/programs` (also linked from `/courses`).

API: `POST /api/v1/programs/`

```json
{
  "name": "Grade 9 Mathematics",
  "code": "grade-9-mathematics",
  "description": "Core mathematics curriculum.",
  "grade": "9",
  "status": "DRAFT"
}
```

`code` is globally unique. Use `DRAFT` while authoring.

### 3.2 Course

Next.js: `/courses`

API: `POST /api/v1/courses/`

```json
{
  "program": "<program-uuid>",
  "name": "Grade 9 Mathematics",
  "code": "math-9",
  "description": "Mathematics course",
  "status": "DRAFT",
  "display_order": 0
}
```

The program must already exist. `code` is globally unique.

### 3.3 Course version

Next.js: open a course from `/courses` and add a version in its structure editor.

API: `POST /api/v1/course-versions/`

```json
{
  "course": "<course-uuid>",
  "version_number": 2026,
  "name": "2026 Curriculum",
  "status": "DRAFT"
}
```

The `(course, version_number)` pair is unique. Enrollments always point to a specific version; publish new versions instead of rewriting historical progress.

### 3.4 Chapter, subtopic, activity

Next.js: open a course from `/courses`. The editor exposes create, edit, and ordering controls only when the signed-in role has the corresponding Django permission.

Chapter: `POST /api/v1/chapters/`

```json
{
  "course_version": "<version-uuid>", "title": "Algebra", "slug": "algebra",
  "description": "Introduction to algebra.", "chapter_number": 1,
  "estimated_minutes": 90, "is_required": true, "status": "DRAFT",
  "display_order": 0,
  "completion_rule": {"required_subtopics": true, "learning_check_required": true}
}
```

Subtopic: `POST /api/v1/subtopics/`

```json
{
  "chapter": "<chapter-uuid>", "title": "Linear equations", "slug": "linear-equations",
  "description": "Solve one-variable equations.", "learning_objectives": ["Isolate a variable"],
  "estimated_minutes": 30, "display_order": 0, "is_required": true, "status": "DRAFT"
}
```

Activity: `POST /api/v1/activities/`

```json
{
  "subtopic": "<subtopic-uuid>", "activity_type": "CONCEPT_VIDEO",
  "title": "Solving equations", "description": "Watch and practise.",
  "display_order": 0, "is_required": true, "estimated_minutes": 10,
  "completion_rule": {"watch_percentage": 90}, "status": "DRAFT"
}
```

Activities support `CONCEPT_VIDEO`, `EXPERIMENT`, `CONCEPT_OVERVIEW`, `OBSERVE_LEARN_PRACTICE`, `HOMEWORK`, `INTERACTIVE_WORKSHOP`, `SIMULATION`, `READING`, `PDF`, `INTERACTIVE`, `ASSIGNMENT`, `PROJECT`, `LIVE_CLASS`, and `FLASHCARD`.

Use the reorder actions after creating children:

```text
POST /api/v1/course-versions/{id}/reorder_chapters/
POST /api/v1/chapters/{id}/reorder_subtopics/
POST /api/v1/subtopics/{id}/reorder_activities/
```

Each body is `{"ids":["<first-uuid>","<second-uuid>"]}` and must contain every child exactly once.

## 4. Add content and media

Next.js: use `/content` for content records and `/media` for uploaded assets.

Create a `MediaAsset` first when content references a file:

`POST /api/v1/media-assets/`

```json
{
  "file_name": "equations.mp4", "file_type": "VIDEO", "mime_type": "video/mp4",
  "file_size": 5242880, "storage_path": "courses/math-9/equations.mp4",
  "cdn_url": "https://cdn.example.com/equations.mp4", "status": "READY"
}
```

For a local upload, send multipart form data instead of manufacturing storage metadata. The server stores the file, marks it ready, and returns `public_url` for playback:

```bash
curl -X POST http://127.0.0.1:8000/api/v1/media-assets/ \
  -H "Authorization: Bearer $TOKEN" \
  -F "upload=@equations.mp4" -F "duration_seconds=180"
```

Then create the structured content:

- Video: `POST /api/v1/videos/` with `activity`, `media_asset`, title, duration, transcript, captions, and optional completion percentage.
- Experiment: `POST /api/v1/experiments/` with `activity`, `experiment_type`, instructions, configuration, and optional external URL.
- Flexible overview: `POST /api/v1/activity-content/` with `activity`, `content_type`, and JSON `content`.
- Practice set: create `/practice-sets/`, then ordered `/practice-items/`. A video item requires `video`; a question item requires `question_reference`; a practice item requires neither.

Content managers can author drafts. Publishing is a separate permission.

### 4.1 Runtime experiment definitions

For a student-facing experiment, first create a LearningActivity whose `activity_type` is `EXPERIMENT`, `SIMULATION`, `INTERACTIVE`, or `INTERACTIVE_WORKSHOP`. Then create its one-to-one Experiment record in the curriculum editor or with `POST /api/v1/experiments/`.

`configuration` is a declarative document. It never contains executable JavaScript. Lesson wording, variables, coefficients, limits, and questions belong in this published record rather than in either frontend. The stable envelope is:

```json
{
  "schema_version": 1,
  "renderer": "geogebra",
  "renderer_config": {},
  "tracking": {}
}
```

The currently installed renderer adapters are `geogebra` and `placeholder`. Administrators can publish any number of lessons using these adapters without changing or reinstalling the Moodle plugin. Adding a fundamentally different renderer still requires a centrally released plugin update.

#### GeoGebra

A GeoGebra renderer supports two authoring modes:

1. Supply a published GeoGebra `material_id`.
2. Supply a validated `workspace` object. The installed generic workspace constructs a blank GeoGebra app from posted data, so each LPP lesson can use different variables and constraints without a frontend deployment.

Material example:

```json
{
  "activity": "<activity-uuid>",
  "experiment_type": "EMBEDDED",
  "instructions": "<student instructions authored by the administrator>",
  "external_url": null,
  "configuration": {
    "schema_version": 1,
    "renderer": "geogebra",
    "renderer_config": {
      "material_id": "<geogebra-material-id>",
      "app_name": "graphing",
      "width": 960,
      "height": 600,
      "parameters": {
        "showToolBar": false,
        "showMenuBar": false,
        "showAlgebraInput": true,
        "enableShiftDragZoom": true
      }
    },
    "tracking": {
      "watch_objects": ["<geogebra-object-name>"],
      "progress_object": "<optional-0-to-100-object>",
      "completion": {
        "object": "<completion-object>",
        "operator": "equals",
        "value": 1
      },
      "throttle_ms": 1000
    }
  }
}
```

Data-driven linear-programming example:

```json
{
  "schema_version": 1,
  "renderer": "geogebra",
  "renderer_config": {
    "app_name": "graphing",
    "workspace": {
      "type": "linear_programming",
      "title": "Production mix",
      "problem_statement": "Choose the most profitable feasible mix.",
      "axis_variables": ["x1", "x2"],
      "variables": [
        {"id":"x1","label":"Product A","symbol":"x₁","unit":"units","min":0,"max":50,"initial":0,"step":1},
        {"id":"x2","label":"Product B","symbol":"x₂","unit":"units","min":0,"max":25,"initial":0,"step":1}
      ],
      "objective": {"label":"Profit","sense":"maximize","currency":"₹","coefficients":{"x1":12,"x2":20}},
      "constraints": [
        {"id":"labour","label":"Assembly time","coefficients":{"x1":0.8,"x2":1.7},"operator":"<=","rhs":100}
      ]
    }
  }
}
```

Every variable must appear exactly once in the objective and each constraint. IDs begin with a letter and contain only letters, numbers, or underscores. `axis_variables` selects the two graph axes; any other variables become learner-controlled fixed parameters for the 2D slice. The complete demo definition is in `tella_backend/content/demo/lpp_workspace.json`.

`app_name` can select the appropriate GeoGebra app, including `graphing` or `3d`. The wrapper scales down on narrow screens; authors must also design the GeoGebra material itself for touch input and small screens. Prefer a 2D representation as the default when the learning objective does not require 3D.

Only objects named in `watch_objects`, `progress_object`, or `completion.object` are read. Completion operators are `equals`, `not_equals`, `greater_than`, `greater_than_or_equal`, `less_than`, `less_than_or_equal`, and `truthy`. The student UI shows completion only after Django confirms the progress write.

#### Placeholder

Use this for a planned experiment whose interactive definition is not ready. All displayed text still comes from the admin record:

```json
{
  "schema_version": 1,
  "renderer": "placeholder",
  "renderer_config": {
    "heading": "<admin-authored heading>",
    "message": "<admin-authored placeholder message>",
    "note": "<optional admin-authored note>"
  }
}
```

The experience is online-required: Moodle must exchange a valid learner token and load the published activity from Django. If connectivity drops after loading, progress events are queued briefly in the browser and sent on reconnection; this resilience does not make the lesson an offline product. AI features can consume tracked state later, but neither rendering nor mathematical correctness depends on an AI response.

## 5. Create questions and assessments

Next.js: `/assessments`.

### 5.1 Question bank

`POST /api/v1/questions/`

```json
{
  "question_type": "MCQ", "question_text": "What is 2 + 2?",
  "explanation": "Adding two and two gives four.", "difficulty": "EASY",
  "marks": 1, "subject": "Mathematics", "grade": "9",
  "status": "PUBLISHED", "metadata": {}
}
```

Add options with `POST /api/v1/question-options/`:

```json
{"question":"<question-uuid>","option_text":"4","is_correct":true,"display_order":0}
```

For `NUMERIC`, `SHORT_TEXT`, `LONG_TEXT`, or `MATH_EXPRESSION`, store the canonical answer in `metadata.correct_answer`. Never send a client-calculated score.

### 5.2 Learning check

Create a check for a chapter:

`POST /api/v1/learning-checks/`

```json
{
  "chapter": "<chapter-uuid>", "title": "Algebra check",
  "instructions": "Answer all questions.", "passing_score": 70,
  "max_attempts": 3, "time_limit_minutes": 20,
  "randomize_questions": false, "status": "DRAFT"
}
```

Link questions in the Learning-check questions workspace or with `POST /api/v1/learning-check-questions/`. Publish the check only after its questions are complete. Students can then start, submit, and view their own results through `/learning-checks/{id}/start/`, `/submit/`, and `/results/`.

Case studies follow the same pattern with `/case-studies/` and `/case-study-questions/`.

## 6. Publish curriculum

Recommended order:

1. Finish all content and assessments.
2. Set required records to `PUBLISHED` where appropriate.
3. Ensure the Program is `PUBLISHED`.
4. Publish a course version:

```bash
curl -X POST "http://127.0.0.1:8000/api/v1/courses/<course-uuid>/publish/" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"version_id":"<version-uuid>"}'
```

The service requires a published parent Program and at least one Chapter, then marks the selected version and parent Course published. Students cannot see drafts.

## 7. Create cohorts, assignments, and enrollments

Next.js: `/learners`.

Create a StudentGroup (not a Django Group):

`POST /api/v1/student-groups/`

```json
{"name":"Grade 9A","code":"G9A","grade":"9","academic_year":2026,"teacher":"<teacher-uuid>","status":"ACTIVE"}
```

Add students using `POST /api/v1/student-groups/{id}/members/`:

```json
{"student":"<student-uuid>"}
```

Assign a course version to the cohort:

`POST /api/v1/course-assignments/`

```json
{"course":"<course-uuid>","course_version":"<version-uuid>","student_group":"<group-uuid>","student":null,"due_date":null,"status":"ACTIVE"}
```

Exactly one of `student_group` or `student` is required. The operation atomically creates active enrollments for current group members. Individual enrollment uses the same endpoint with `student` instead of `student_group`, or `POST /api/v1/enrollments/` for direct administration.

## 8. Progress and assessment use

Students normally create progress by using activities:

```text
POST /api/v1/activities/{activity_id}/start/
POST /api/v1/activities/{activity_id}/progress/
POST /api/v1/activities/{activity_id}/complete/
```

The backend persists Activity, Subtopic, Chapter, and Course snapshots. It rejects writes without an active, unexpired enrollment for the exact version. The current progress endpoints are student self-service endpoints; teacher reporting endpoints are reserved for the reporting phase.

Assessment flow:

```text
POST /learning-checks/{id}/start/
  → receive attempt_id
POST /learning-checks/{id}/submit/
  → server calculates score/pass/fail
GET  /learning-checks/{id}/results/
```

## 9. Data-entry checklist

- Run migrations and `setup_groups` before creating data.
- Create parent records before child records and save every returned UUID.
- Keep authoring records `DRAFT` until reviewed.
- Publish Program, CourseVersion, activities, and checks deliberately.
- Never reuse a CourseVersion for a materially changed curriculum.
- Distinguish Django `Group` roles from `StudentGroup` cohorts.
- Assign students before assigning a group course.
- Do not manually write progress or assessment scores except through their services/APIs.
- Test access as a student and teacher after enrollment/assignment.
- Use `GET /api/v1/health/` and `python manage.py check` after deployment changes.
