# Student frontend

The student experience is part of the existing Next.js app and starts at `http://localhost:3000/learn/login`. It does not require a Moodle clone for frontend development.

## Screens

- `/learn` — live dashboard, progress, achievements, and continuation target
- `/learn/courses` — searchable enrolled-course library
- `/learn/courses/{course_id}` — published chapters, subtopics, activities, and learning checks
- `/learn/courses/{course_id}/activities/{activity_id}` — responsive lesson and experiment player
- `/learn/courses/{course_id}/checks/{check_id}` — server-scored learning check
- `/learn/opportunities` — published career and further-learning opportunities

Students only receive published curriculum attached to an active, unexpired enrollment. The browser never receives a Django JWT directly: the Next.js server stores student access and refresh tokens in HTTP-only `tella_learner_*` cookies. Administration uses separate `tella_admin_*` cookies and a different route allowlist.

An enabled course tutor is mounted by the shared course layout, so it is available on the course overview, activity, and learning-check screens. Availability follows the learner's exact enrolled course version. The browser sends only the question and an optional opaque platform session ID; it never receives approved context or the external provider key. Answers are rendered as text, and validated evidence excerpts are shown separately. Unsupported questions receive the fixed context-only refusal.

## Data-driven activity rendering

The activity player selects its presentation from the published activity payload:

- `content` JSON is rendered as safe text, lists, content blocks, source links, prompts, deliverables, and reflections.
- video records are joined to accessible media metadata and shown as YouTube, an uploaded/direct HTML video, or an external resource.
- `configuration.renderer = "geogebra"` either loads an administrator-supplied `material_id` or constructs a validated data-driven workspace. The `linear_programming` workspace accepts arbitrary posted variables, bounds, objective coefficients, and linear constraints; it solves a selected 2D slice and draws that construction through GeoGebra.
- `configuration.renderer = "graphspace"` opens the bundled 2D/3D GraphSpace tool from a validated local path and displays the administrator-authored experiment framing.
- `configuration.renderer = "placeholder"` renders the supplied heading, message, and note.
- legacy `response_fields` arrays generate labelled text/number/long-answer controls without knowledge of a specific experiment.
- unknown renderer names fail safely while preserving the definition for a future adapter.

This means universities do not update the frontend when administrators add lessons or new instances of a supported experiment. A code deployment is needed only when introducing a genuinely new renderer type.

## Online behaviour and Moodle

The learner frontend is online-required. Authentication, enrollment checks, progress, scoring, GeoGebra materials, and future AI services all rely on server connectivity; no service worker or offline lesson cache is installed.

Local development uses `/learn/login`. For Moodle, post the existing signed identity payload to `/api/learner/auth/moodle`; that endpoint exchanges it with Django and creates the same learner cookie session. A Moodle launch can then redirect to the desired `/learn/...` URL without exposing tokens to browser JavaScript.

## Backend endpoints used

Read access: `/courses/`, `/courses/{id}/`, `/videos/`, `/media-assets/`, `/learning-checks/`, `/me/activity-progress/`, `/gamification/me/`, and `/career/opportunities/`.

Student writes are limited to activity `start`, `progress`, and `complete`, learning-check `start` and `submit`, and `POST /courses/{course_id}/chat/`. The Next.js learner proxy explicitly rejects curriculum mutations and unrelated backend resources.

Chat questions and validated replies are retained in Django for the configured retention window and are not used for grades or progress. A bounded subset of approved context and recent conversation is sent to the configured Math Tutor service for each turn. Production rollout therefore requires an approved external-processor/privacy review and a scheduled `purge_course_chat` backend job.
