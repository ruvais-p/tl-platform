# Tella Web Platform

Next.js 16 frontend for curriculum administration and the responsive student learning experience.

## Local setup

1. Start Django at `http://127.0.0.1:8000` and ensure migrations and `setup_groups` have run.
2. Set `DJANGO_API_URL=http://127.0.0.1:8000/api/v1` and keep `ADMIN_SECURE_COOKIES=false` for local HTTP only. Put them in your shell environment or an ignored `.env.local` file.
3. Run `npm install` and `npm run dev`, then open `http://localhost:3000`.

Staff sign in at `/login` with a `SUPER_ADMIN`, `ADMIN`, `ACADEMIC_MANAGER`, or `CONTENT_MANAGER` account. Students sign in at `/learn/login` with a `STUDENT` account, or arrive through the signed Moodle exchange.

## Environment

| Variable | Purpose |
| --- | --- |
| `DJANGO_API_URL` | Server-only Django API root, including `/api/v1` |
| `ADMIN_SECURE_COOKIES` | Set `true` for HTTPS; production defaults to secure cookies for both isolated session types |

Production requests fail clearly when `DJANGO_API_URL` is absent. JWTs remain in HTTP-only, same-site cookies; browser code calls only the allowlisted Next.js proxy.

## Staff administration scope

- Permission-aware dashboard and navigation derived from Django’s effective permissions
- Curriculum workspace for programs, courses, versions, chapters, subtopics, activities, ordering, and publication
- Per-version course chatbot context and enablement for staff with `tutoring.manage_course_chatbot`
- Content workspace for activity content, videos, experiments, practice sets, and practice items
- Media workspace with multipart upload and storage-metadata editing
- Learner workspace for students, cohorts, memberships, enrollments, assignments, and LMS mappings
- Permission-aware student-group creation and maintenance
- Student membership management with optional teacher assignment
- Versioned course assignment to student groups with assignment history
- Assessment workspace for questions, options, case studies, learning checks, and their question links
- Access workspace for guarded account creation/editing, role assignment, and `SUPER_ADMIN` permission management
- Reports and operations workspace for progress, attempts, answers, awards, career opportunities, and legacy workshop records

`CONTENT_MANAGER` accounts receive curriculum-content-media tools; `ADMIN` accounts additionally receive learner, assessment, account, and reporting tools; `ACADEMIC_MANAGER` accounts receive full curriculum authoring, publication, and outcome reporting. The application always uses the returned permission set rather than assuming capabilities from a role name. Django is API-only; this application is the sole web administration surface.

The dedicated Learners → Student groups workspace requires `students.view_studentgroup`. Mutations require `students.manage_student_groups`, and course delivery requires `students.assign_course`. Assigning a course version atomically enrolls all current members. Students added later inherit active group assignments; removing a member preserves existing enrollments so access is never revoked implicitly.

## Learner scope

- Separate student-only session and route allowlist under `/learn`
- Responsive dashboard, course library, and nested curriculum map
- Generic lesson content and external/direct video rendering
- Data-driven experiment adapters for GeoGebra materials, structured linear-programming workspaces, placeholders, legacy response fields, and future renderer fallbacks
- Online progress sync, completion, points, badges, and published career opportunities
- Secure learning-check attempts for all supported question types
- Context-only course tutor shared across course overview, activity, and learning-check routes when enabled for the enrolled version

No lesson or named experiment is embedded in the frontend. The UI renders published curriculum records and experiment definitions received from Django. See `../docs/STUDENT_FRONTEND.md` for the API mapping and Moodle handoff.

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
```
