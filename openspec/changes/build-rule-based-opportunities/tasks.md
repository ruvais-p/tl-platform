## 1. Data Model and Migration

- [x] 1.1 Expand `CareerOpportunity` with controlled employment/workplace/lifecycle/application enums, structured employer/location/compensation/schedule fields, company-logo relation, audience targeting, eligibility rules, and application configuration; add appropriate indexes and verify Django model checks pass.
- [x] 1.2 Add `OpportunityApplication` and private applicant-document metadata with uniqueness, status, review audit fields, and protected relations; verify model and constraint tests cover duplicate applications and terminal statuses.
- [x] 1.3 Create schema and data migrations that preserve legacy summaries and URLs, map known kinds and publication flags, retain ambiguous legacy values for review, and verify forward migration against representative legacy records.
- [x] 1.4 Add opportunity-management and application-review permissions to the administrator role while preserving super-admin access and denying unassigned roles; verify group setup and permission API tests pass.

## 2. Opportunity Catalog Domain and APIs

- [x] 2.1 Implement backend validation for required fields, independent employment/workplace enums, conditional location, compensation ranges and currency, company-logo image readiness, deadlines, and HTTPS external URLs; verify serializer tests cover valid and invalid combinations.
- [x] 2.2 Implement draft, publish, close, archive, and computed-open lifecycle behavior through domain services; verify incomplete drafts cannot publish and closed, archived, or expired opportunities reject new applications.
- [x] 2.3 Expand the permission-controlled staff opportunity API with search/filter support and explicit lifecycle actions while retaining compatible CRUD paths; verify authorized and unauthorized staff API tests pass.
- [x] 2.4 Implement learner-visible catalog and detail selectors that return only open audience-visible opportunities plus closed details for existing applicants; verify visibility, deadline, and non-disclosure tests pass.
- [x] 2.5 Update demo/seed opportunity data to exercise structured internal and external opportunities, workplace modes, compensation states, and deadlines; verify seed commands remain idempotent.

## 3. Eligibility Rules

- [x] 3.1 Define and validate the version-1 `ALL`/`ANY` eligibility rule schema for group, grade, course enrollment/completion/progress, and learning-check score facts; verify tests reject unknown versions, invalid operators, incompatible references, and out-of-range values.
- [x] 3.2 Implement a bounded-query learner fact snapshot and deterministic rule evaluator with false-on-missing semantics and learner-facing unmet-requirement messages; verify unit tests cover every fact, `ALL`, `ANY`, empty rules, and missing data.
- [x] 3.3 Implement all-learner versus selected-group audience filtering separately from eligibility evaluation; verify out-of-audience learners cannot list or retrieve records while visible ineligible learners receive explanations.
- [x] 3.4 Add eligibility data to learner catalog/detail serializers without exposing internal-only configuration or other learner data; verify API contract and query-count tests pass for multiple opportunities.

## 4. Application Domain, Privacy, and APIs

- [x] 4.1 Implement transactional internal application creation that rechecks lifecycle, deadline, audience, and eligibility and prevents duplicates or partial records; verify race-oriented, stale-eligibility, deadline, and duplicate tests pass.
- [x] 4.2 Implement application transition services for submitted, under-review, shortlisted, accepted, rejected, and withdrawn states with terminal-state enforcement and review audit fields; verify staff and learner transition matrices are fully tested.
- [x] 4.3 Implement private resume upload, validation, cleanup, storage, and authorization-checked download behavior using a documented size and MIME allowlist; verify applicant/reviewer access succeeds and public or unauthorized access fails without leaking metadata.
- [x] 4.4 Add learner endpoints for internal submission, personal application history, resume access, and withdrawal, while clearly separating external application redirects; verify identity isolation and response-field privacy tests pass.
- [x] 4.5 Add staff applicant list/detail/filter, review-note, document-download, and status-transition endpoints protected by application permissions; verify reviewer access, filtering, audit data, and denial cases pass.
- [x] 4.6 Extend Django URL registration and the Next.js learner/staff proxy allowlists for only the required collection, UUID-detail, action, upload, and download methods; verify proxy-policy tests reject unrecognized paths and verbs.

## 5. Shared Frontend Foundation

- [x] 5.1 Add the minimal Markdown dependencies and a shared restricted opportunity Markdown renderer with raw HTML disabled and safe external-link handling; verify rendering and unsafe-content tests pass.
- [x] 5.2 Add typed staff and learner opportunity, eligibility, and application API contracts and client methods, including multipart internal applications; verify TypeScript and API mocking tests pass.
- [x] 5.3 Add reusable opportunity badges, company-logo fallback, compensation/location formatting, lifecycle labels, and application status presentation; verify formatting tests cover every enum and missing optional values.

## 6. Dedicated Admin Opportunity Workspace

- [x] 6.1 Add a permission-controlled Opportunities item to the admin navigation and dashboard, route the old generic resource entry to the dedicated workspace, and verify access and navigation tests for administrator and unauthorized roles.
- [x] 6.2 Build the opportunity list with search, employment/workplace/lifecycle filters, deadline/open indicators, create/edit links, and responsive empty/loading/error states; verify component tests cover filtering and permissions.
- [x] 6.3 Build the full-page create/edit form with grouped employer, basics, Markdown description/preview, location, compensation, schedule, application, and publishing sections plus conditional field validation; verify draft creation, edit hydration, invalid combinations, and keyboard operation.
- [x] 6.4 Build the visual eligibility rule editor with `ALL`/`ANY`, supported fact-specific controls, relation lookup, add/remove/reorder behavior, and server error mapping; verify serialized rules round-trip without loss and all rule types are accessible.
- [x] 6.5 Add staff preview and explicit publish, close, and archive confirmations with lifecycle error feedback; verify invalid publication is blocked and successful transitions update the workspace.
- [x] 6.6 Build the applicant review workspace with search/status filters, application detail, private resume download, review notes, and permitted transitions; verify terminal states, private fields, loading/error states, and responsive behavior.

## 7. Learner Opportunity and Application Experience

- [x] 7.1 Replace the flat opportunity feed with branded searchable cards and employment/workplace filters showing company identity, compensation, location, deadline, and eligibility; verify empty, error, loading, eligible, and ineligible catalog states.
- [x] 7.2 Add `/learn/opportunities/[opportunityId]` with the complete structured detail, safe Markdown, eligibility reasons, open/closed state, and correct application action; verify inaccessible opportunities behave as unavailable and existing applicants retain closed-detail access.
- [x] 7.3 Add the internal application experience with account-prefilled identity, phone, configurable cover note/resume requirements, upload progress, confirmation, and duplicate/current-state feedback; verify validation, accessibility, and mobile behavior.
- [x] 7.4 Add the clearly labeled external application handoff without creating internal status, and verify only validated HTTPS destinations can be opened.
- [x] 7.5 Add `/learn/applications` with learner-isolated status history, opportunity links, and valid withdrawal actions; verify terminal applications cannot be withdrawn or mutated.
- [x] 7.6 Update the learner dashboard opportunity summary to use the expanded contract and link through platform detail routes; verify dashboard tests cover available and empty states.

## 8. End-to-End Verification

- [x] 8.1 Run the complete Django test suite, system checks, and migration consistency checks; verify there are no failures, missing migrations, permission regressions, or unsafe applicant-document responses.
- [x] 8.2 Run the admin-platform test suite, typecheck, lint, and production build; verify all commands complete successfully with the Markdown dependency and new routes.
- [x] 8.3 Inspect representative admin and learner flows at desktop and mobile widths, including authoring, Markdown preview, rule building, publication, eligible/ineligible catalog states, detail, internal/external apply, applicant review, private download denial, and withdrawal; verify keyboard focus, readable responsive layout, and unchanged unrelated admin/learner surfaces.
- [x] 8.4 Exercise the migration on representative existing opportunities and verify legacy published links remain available, drafts remain unpublished, ambiguous kinds are reviewable, and rollback preserves all opportunity and application data.
