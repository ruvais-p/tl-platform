## Context

See `proposal.md` for motivation and `specs/admin-curriculum-management/spec.md` for behavioral requirements.

The repository contains a Django REST API and a newly scaffolded Next.js 16 application at `admin-platform` with Tailwind CSS 4 and shadcn/ui. Django owns authentication, authorization, validation, ordering, and publishing. Curriculum serializers return the complete nested hierarchy for reads, but nested children are read-only and must be mutated through individual endpoints. An activity's nested `content` currently omits the associated `ActivityContent` identifier and content type, making reliable updates difficult.

## Goals / Non-Goals

**Goals:**

- Keep the initial administrative surface small: authentication, course library, hierarchy editor, content inspector, reorder, and publish.
- Centralize API/session behavior and provide consistent loading and error semantics.
- Preserve the API's resource boundaries rather than attempting nested writes.
- Make the desktop editor efficient while retaining a clear narrow-screen workflow.
- Add only the smallest backwards-compatible backend change needed for activity-content editing.

**Non-Goals:**

- Replacing Django's operational admin in this change.
- Managing students, cohorts, enrollments, assessments, media uploads, or reporting.
- Adding collaborative editing, autosave, offline authoring, or optimistic publication.
- Changing curriculum models, status values, authorization rules, or publication semantics.
- Building specialized editors for every possible activity type; structured JSON remains the universal fallback.

## Decisions

### Use a thin Next.js backend-for-frontend for sessions

Next.js route handlers will authenticate against Django, retain access and refresh tokens in secure HTTP-only cookies, refresh expired access tokens server-side, and proxy only the API operations needed by this admin application. Browser components will never read JWT values.

This is preferred over storing tokens in `localStorage`, which is simpler but unnecessarily exposes an administrative credential to browser script. Direct browser calls with in-memory tokens were also considered, but they lose sessions on refresh and require additional Django CORS configuration.

### Use a course library plus master-detail editor

The primary route structure will be a sign-in page, a course library, and a course editor keyed by course UUID. On wide screens the editor uses a hierarchy rail and inspector. On narrow screens, the same state becomes a drill-in flow with an explicit back action.

This is preferred over separate pages for every resource because administrators need persistent parent context. A spreadsheet/tree-grid was considered but rejected for the MVP because deeply varied fields and activity content make inline editing hard to validate and use accessibly.

### Treat the nested course response as a read model

The frontend will normalize a fetched course hierarchy into typed selection and rendering helpers, but it will not submit that graph. Create, update, and delete operations target the appropriate individual resource endpoint. After a successful mutation, the editor will invalidate and reload the selected course, using returned data only for immediate feedback.

This respects the existing serializer boundary and avoids a new transactional bulk-write API. Client-only optimistic graph mutation was considered but rejected because Django validation and protected relationships are authoritative.

### Expose activity-content identity through a backwards-compatible API field

`LearningActivitySerializer` will expose a nullable `content_record` object containing `id`, `activity`, `content_type`, `content`, and timestamps. The existing `content` field will remain for compatibility. The implementation will use the existing reverse one-to-one relationship and extend queryset selection to avoid per-activity queries.

This is preferred over downloading the entire `/activity-content/` collection and matching records in the browser. An `?activity=` filter would also solve lookup, but embedding the one-to-one record in the course read model eliminates an extra request and keeps the editor deterministic. The standalone content endpoint remains the write boundary.

### Use explicit save with dirty-state protection

Inspector forms will use controlled form state with schema validation, explicit Save/Cancel actions, and a dirty-state confirmation when changing selection or route. New records default to `DRAFT`. JSON content will be parsed and validated before submission while preserving unknown keys.

Autosave was rejected because hierarchy changes and publication-sensitive status edits benefit from an explicit commit boundary and actionable server validation.

### Commit ordering through existing complete-list actions

Drag-and-drop or keyboard move controls will update a temporary sibling order. The UI will submit only when the interaction commits, sending every current sibling UUID exactly once. Failure restores the last server order. Keyboard move-up/move-down actions provide an accessible alternative to dragging.

### Keep permissions server-authoritative

The current-user response can guide labels and hide clearly unavailable actions, but every mutation remains subject to Django permission checks. A `403` becomes a permission-specific message; it does not trigger logout. A `401` triggers one refresh attempt and then session removal if refresh fails.

### Use a restrained shadcn component layer

The application will use shadcn primitives for buttons, forms, dialogs, menus, sheets, badges, and feedback while keeping the curriculum hierarchy and inspector as purpose-built components. The design uses a calm neutral surface system with one green action accent and avoids a dashboard-card layout.

## Data Flow

```text
+------------------+       +----------------------+       +----------------+
| Browser UI       |       | Next route handlers  |       | Django API     |
|                  |       |                      |       |                |
| Course tree      | ----> | Read HTTP-only JWT   | ----> | Permissions    |
| Inspector forms  | <---- | Refresh / proxy      | <---- | Validation     |
| Reorder controls |       | Normalize errors     |       | Persistence    |
+------------------+       +----------------------+       +----------------+
        |                           |                            |
        +-- no token access         +-- retry one 401            +-- source of truth
```

The frontend domain types mirror the documented API payloads and retain UUIDs as opaque strings. A selection is represented by resource kind and UUID, allowing the inspector to resolve the selected object from the current course tree without duplicating editable server state.

## Error Handling

- Field-keyed DRF validation responses map to the associated form fields.
- `detail` and structured domain errors become a form-level alert.
- `401` causes one refresh-and-retry cycle; a second failure clears cookies and returns sign-in.
- `403` preserves the session and reports insufficient permission.
- `404` removes inaccessible/stale selection only after a hierarchy reload confirms it.
- Network failures retain the last successful course tree and offer retry.

## Risks / Trade-offs

- [Large nested course responses may become slow as curricula grow] -> Fetch only the selected course, avoid loading every course tree in the library, and measure before introducing lazy child endpoints.
- [Embedding `content_record` can introduce N+1 database queries] -> Select/prefetch the content relationship in course and activity querysets and add query-count coverage.
- [Concurrent administrators can overwrite each other's edits] -> Use explicit save and canonical reload now; record optimistic concurrency/version checks as a future capability rather than silently implying conflict protection.
- [Refresh-token rotation can race across simultaneous requests] -> Serialize refresh attempts in the BFF session layer and retry each failed request at most once.
- [Generic JSON editing can produce invalid content shapes] -> Validate JSON syntax client-side and rely on backend validation; add specialized editors incrementally without removing the fallback.
- [Delete behavior varies because parent relationships are protected] -> Confirm destructive actions and surface backend rejection rather than predicting deletability client-side.

## Migration Plan

1. Add and test the backwards-compatible activity `content_record` representation and queryset prefetching.
2. Add admin-platform environment configuration and the session/proxy layer.
3. Implement the course library and read-only hierarchy before enabling mutations.
4. Add inspector CRUD, activity content, ordering, and publishing in independently testable increments.
5. Run Django API tests, frontend lint/type checks, and production builds; manually verify permissions with administrator and content-manager roles.
6. Deploy the frontend with its Django API base URL and secure-cookie settings, then smoke-test login and a draft curriculum before exposing the route broadly.

Rollback consists of removing access to the Next.js admin application. The serializer addition is backwards compatible and can remain; if reverted, existing API consumers continue using the original `content` field.
