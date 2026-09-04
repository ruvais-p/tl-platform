## Why

Administrators and content managers have API endpoints, but need a simple workspace for understanding and editing a course as one hierarchy. A focused Next.js curriculum manager lets authorized staff create, organize, review, and publish course content without manually coordinating UUIDs across separate resource forms.

## What Changes

- Turn the existing `admin-platform` Next.js/shadcn scaffold into an authenticated curriculum-management application.
- Provide a course library and a master-detail editor for Course -> Version -> Chapter -> Subtopic -> Activity.
- Allow authorized users to create and edit hierarchy records, remove eligible records, and reorder chapters, subtopics, and activities through the existing REST actions.
- Provide activity-content editing without exposing raw relationship bookkeeping to administrators.
- Add a deliberate course-version publishing flow with validation feedback and permission-aware actions.
- Add the minimal backend representation/filtering needed for the frontend to locate and update an activity's content record.
- Keep Django as the source of truth for authorization, validation, publishing, and ordering.

## Capabilities

### New Capabilities

- `admin-curriculum-management`: An authenticated administrative workspace for browsing, authoring, organizing, and publishing nested course curricula.

### Modified Capabilities

None.

## Impact

- `admin-platform`: routes, shadcn components, API client/session handling, curriculum types, editor state, forms, and tests.
- `tella_backend/content`: activity-content lookup/representation required for reliable edits from the curriculum editor.
- `tella_backend/curriculum`: nested activity representation may expose the associated content record while preserving existing write boundaries.
- Runtime configuration: the Next.js application needs a Django API base URL; authentication must preserve existing JWT rotation and authorization behavior.
- No breaking API changes are intended. Existing Moodle and API clients remain supported.
