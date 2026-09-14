## Why

The existing career opportunity feature only supports a title, free-form type, summary, and external link, so staff cannot publish complete opportunities, target suitable learners, or manage applications. A dedicated opportunity workflow will let administrators publish useful, structured openings and let learners discover, evaluate, and apply for opportunities inside the learning platform.

## What Changes

- Promote Opportunities from a generic Reports resource into a dedicated, permission-controlled admin workspace for creating, editing, previewing, publishing, closing, and archiving opportunities.
- Expand opportunity records with structured employer, employment type, workplace mode, location, compensation, schedule, deadline, summary, safe Markdown description, company logo, and application configuration fields.
- Separate employment type (for example internship or full-time) from workplace mode (remote, hybrid, or in office) so filtering and validation remain reliable.
- Add a staff-friendly eligibility rule builder based on facts the platform already owns, including student group or grade, course enrollment or completion, course progress, and learning-check score.
- Evaluate rules on the server and distinguish audience visibility from application eligibility, returning learner-facing eligibility results without trusting client calculations.
- Replace the learner's flat external-link feed with searchable opportunity cards, individual `/learn/opportunities/[opportunityId]` detail pages, eligibility feedback, deadlines, compensation, and internal or external application actions.
- Add internal applications with duplicate prevention, deadline and eligibility enforcement, optional cover note and private resume requirements, learner withdrawal, and staff review statuses.
- Add a dedicated staff applicant review view with filtering and transitions through submitted, under-review, shortlisted, accepted, rejected, and withdrawn states.
- Migrate existing opportunity data without loss by mapping legacy publication, kind, summary, and URL fields into the expanded model.
- Add explicit opportunity and application permissions for the intended staff roles and extend the existing staff and learner proxy allowlists for the new endpoints.

## Capabilities

### New Capabilities

- `opportunity-catalog-management`: Structured opportunity authoring, employer presentation, lifecycle management, validation, preview, and learner catalog/detail behavior.
- `opportunity-eligibility`: Versioned rule authoring, validation, server-side learner fact evaluation, audience visibility, eligibility explanations, and application gating.
- `opportunity-applications`: Internal and external application modes, learner submissions and status visibility, secure application documents, duplicate and deadline controls, and staff applicant review.

### Modified Capabilities

None. The repository does not currently define a main OpenSpec capability for the existing minimal opportunity feed.

## Impact

- **Backend:** Django progress/career models, migrations, serializers, selectors/services, API views, URLs, permissions, seed data, and automated tests.
- **Admin portal:** A dedicated Opportunities navigation item and workspace, rich full-page editor, rule builder, Markdown preview, logo selection, publication controls, and applicant review UI.
- **Learner platform:** Opportunity list, filters, detail and apply routes, application status UI, dashboard summary behavior, API types/client methods, and responsive/accessibility tests.
- **Storage and security:** Company logos may reuse public image media assets; learner resumes require private, authorization-checked storage and download endpoints rather than public media URLs.
- **Compatibility:** Existing records remain available through a data migration; existing external application links continue to work under the external application mode.
- **Dependencies:** A safe Markdown renderer is required in the Next.js application; any new package must keep raw HTML disabled and preserve the current build and test toolchain.
