## Context

See `proposal.md` for motivation. The current feature is a `CareerOpportunity` model in the Django `progress` app with `title`, free-form `kind`, `summary`, external `url`, and `is_published`. A model view set exposes generic staff CRUD, while one authenticated learner collection endpoint returns every published record. The Next.js admin renders it through the generic resource dialog under Reports, and `/learn/opportunities` renders cards that link directly to external URLs.

The existing platform already owns the learner facts needed for an initial rule engine: group membership and grade, enrollment status, course progress, and assessment results. It also has a media library suitable for public company logos, but that library exposes public URLs and is not suitable for resumes. Staff and learner access pass through explicit Next.js proxy allowlists before reaching Django.

## Goals / Non-Goals

**Goals:**

- Evolve existing data in place without losing published links or changing root admin and learner authentication patterns.
- Keep authoring understandable through a full-page opportunity editor and visual rule builder.
- Make all visibility, eligibility, deadline, and submission decisions server-authoritative.
- Give internal applications a secure, auditable lifecycle while retaining external application support.
- Keep catalog and detail views responsive, accessible, and consistent with the learner theme.

**Non-Goals:**

- Employer self-service accounts, recruiter portals, interview scheduling, email notifications, recommendations, or third-party applicant tracking integrations.
- Arbitrary executable rules, deeply nested Boolean expressions, or free-form custom application question builders in the first release.
- Public, search-engine-indexed job pages; learner opportunities remain authenticated platform content.
- A reusable employer CRM. Employer data is stored as an opportunity snapshot until reuse requirements justify a separate company entity.
- Moving the existing opportunity model to a new Django app during this change.

## Decisions

### 1. Expand the existing opportunity model in place

`CareerOpportunity` remains in the `progress` app and receives explicit structured columns for catalog fields, lifecycle, employer snapshot, compensation, dates, application configuration, and a nullable company-logo relation to `MediaAsset`. `OpportunityApplication` and its private document metadata are added alongside it.

This avoids a cross-app table move, content-type replacement, and permission migration while existing records are active. A new domain app was considered, but its architectural neatness does not justify the migration risk in this increment. Services and selectors will contain the new domain logic so a later extraction remains possible.

### 2. Use a dedicated admin workspace instead of the generic resource dialog

The admin portal gains `/opportunities`, `/opportunities/new`, `/opportunities/[id]`, and `/opportunities/[id]/applications`. The existing generic resource entry is removed or redirected so there is one authoring path.

A full-page editor is necessary for Markdown preview, conditional location and compensation fields, media selection, rule authoring, preview, and publication feedback. Extending the generic field definition until it supports this workflow would make unrelated CRUD screens more complex.

### 3. Model employment type and workplace mode independently

Employment type uses controlled values for internship, full-time, part-time, contract, apprenticeship, and project. Workplace mode separately uses remote, hybrid, and in-office. API responses may add human-readable labels, but persisted and submitted values remain stable enums.

The alternative—one `kind` field—cannot represent combinations such as a remote internship and produces unreliable filters. The legacy `kind` value is retained only for migration input and mapped conservatively.

### 4. Store validated, versioned eligibility rules as JSON

The opportunity stores a schema such as:

```json
{
  "version": 1,
  "match": "ALL",
  "conditions": [
    { "fact": "STUDENT_GROUP", "operator": "IN", "values": ["<group-uuid>"] },
    { "fact": "COURSE_PROGRESS", "operator": "GTE", "course_id": "<course-uuid>", "value": 80 }
  ]
}
```

The rule builder produces this structure, and the Django serializer validates its version, condition shapes, compatible operators, thresholds, and referenced records. A pure relational rule hierarchy was considered, but it would require several sparse tables and more joins while the condition vocabulary is still small. Unvalidated JSON and arbitrary expressions are rejected because they are hard to secure, migrate, and explain.

V1 uses one top-level `ALL` or `ANY` operator and supports group, grade, course enrollment/status/completion/progress, and learning-check score facts. Unknown versions fail closed. Missing learner facts evaluate false. Each evaluator result includes machine state plus deterministic learner-facing unmet-condition messages.

### 5. Separate audience filtering from eligibility gating

`audience_scope` is `ALL_LEARNERS` or `SELECTED_GROUPS`, with selected groups stored through a relation. Audience filtering occurs before serialization so out-of-audience records are not disclosed. Eligibility is evaluated only for visible records: eligible learners can apply; ineligible learners can read the detail and see unmet requirements.

Using rules for both visibility and eligibility was considered, but it makes it impossible to explain aspirational opportunities to a learner without exposing every institution posting. The separation gives staff a clear privacy boundary and learners useful qualification guidance.

### 6. Centralize open-state and eligibility enforcement in services

Selectors build the learner-visible queryset and prefetch groups, enrollments, progress, and relevant assessment results in bounded queries. A shared evaluator supplies catalog and detail eligibility. Application creation runs in a database transaction, locks or otherwise serializes the learner/opportunity pair, rechecks publication, deadline, audience, and eligibility, and relies on a unique database constraint for final duplicate protection.

Client-side eligibility remains presentational only. This prevents stale tabs or request tampering from bypassing rules.

### 7. Expose purpose-specific staff and learner APIs

The staff side retains opportunity CRUD under `/api/v1/career-opportunities/` for compatibility and adds publish/close actions plus filtered applicant endpoints. Application review is exposed through a permission-controlled staff view set.

Learner endpoints provide:

- `GET /api/v1/career/opportunities/`
- `GET /api/v1/career/opportunities/<uuid>/`
- `POST /api/v1/career/opportunities/<uuid>/applications/`
- `GET /api/v1/career/applications/me/`
- `POST /api/v1/career/applications/<uuid>/withdraw/`

The Next.js staff and learner proxy policies explicitly allow only the required methods and UUID-shaped paths. Collection/detail responses are purpose-specific rather than exposing staff serializers.

### 8. Render Markdown through a restricted shared component

The Next.js app adds a shared opportunity Markdown component using a parser that does not render raw HTML. Links are restricted to safe schemes and external links receive appropriate target and rel attributes. Staff preview and learner detail use the same component and typography rules, preventing preview/render drift.

Saving HTML was considered but rejected because sanitization policy would become persistent data and future renderer changes would require content rewrites. Markdown remains the source of truth.

### 9. Keep company logos public and resumes private

Company logos reference ready image `MediaAsset` records and use existing public delivery behavior. Resume files use a separate private upload path and model metadata, validate a documented size limit and allowlist of resume MIME types, and are returned only through an authenticated authorization-checking download endpoint. Storage keys are generated and are never returned as public URLs.

Reusing `MediaAsset` for resumes was rejected because its public URL contract could expose applicant documents. File creation and application creation are coordinated so failed submissions clean up temporary files and cannot leave accessible orphans.

### 10. Use explicit lifecycle and application state machines

Opportunity status is `DRAFT`, `PUBLISHED`, `CLOSED`, or `ARCHIVED`; a computed open state additionally checks the application deadline. Application status is `SUBMITTED`, `UNDER_REVIEW`, `SHORTLISTED`, `ACCEPTED`, `REJECTED`, or `WITHDRAWN`. Accepted, rejected, and withdrawn are terminal. Transition services validate actor permissions and allowed origins before saving audit fields.

Boolean publication was considered insufficient because closing and archiving have distinct operational meanings. Explicit transitions also make tests and review UI predictable.

### 11. Assign explicit permissions and preserve data through migration

Default Django opportunity and application view/add/change permissions are used, with any review-specific action permission added where necessary. The administrator group receives opportunity management and application review permissions; super administrators continue receiving all permissions. Other roles receive none unless deliberately added later.

The data migration maps known legacy `kind` values, copies `summary`, uses `url` as the external application URL, sets external mode when a URL exists, and maps `is_published` to lifecycle status. Unknown kinds map to `PROJECT` only when semantically safe; otherwise they map to a documented conservative default while the original value is retained for audit during migration.

## Risks / Trade-offs

- **[Rules require several learner datasets]** -> Build a fact snapshot with prefetches and test query counts so catalog size does not create per-opportunity queries.
- **[JSON rule vocabulary may evolve]** -> Require a version, reject unknown versions, and add explicit migrations/evaluator compatibility before introducing V2.
- **[Legacy free-form kinds are ambiguous]** -> Use a deterministic mapping table, preserve original values during migration, and include a staff review filter for migrated defaults.
- **[Markdown or external URLs can become an injection/phishing path]** -> Disable raw HTML, allow only safe schemes, clearly label external applications, and validate HTTPS URLs on the backend.
- **[Resume files contain sensitive personal data]** -> Separate them from public media, authorize every request, avoid public URLs, validate files, and cover access boundaries with tests.
- **[Deadline and submission race]** -> Recheck open state and eligibility inside the application transaction and enforce uniqueness in the database.
- **[A large form can overwhelm staff]** -> Group fields into progressive sections, show conditional fields only when relevant, preserve drafts, and provide preview before publication.
- **[External applications cannot be verified]** -> Do not create internal application records or statuses for outbound applications; communicate that distinction in the UI.

## Migration Plan

1. Add nullable/defaulted opportunity columns, audience relations, application and private-document models, indexes, and permissions without removing legacy columns.
2. Run a data migration that maps legacy records and records any ambiguous kinds for staff review.
3. Deploy serializers, selectors, evaluator, staff APIs, learner APIs, and proxy allowlist changes while the old fields remain readable.
4. Deploy the dedicated admin workspace and learner catalog/detail/application routes, then redirect the generic opportunity resource entry.
5. Verify existing published opportunities, admin permissions, eligibility filtering, secure document access, and application transitions in production-like data.
6. Remove legacy field reads only after the new paths have been validated; defer destructive column removal to a later migration.

Rollback keeps the additive schema in place, restores the previous UI/API code, and continues reading the original legacy columns. New internal applications remain stored but inaccessible until the upgraded code is restored; the rollback MUST NOT delete opportunity or applicant data.
