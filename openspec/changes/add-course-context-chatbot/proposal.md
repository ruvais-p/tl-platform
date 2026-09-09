## Why

Learners need course-specific tutoring without receiving answers drawn from unrelated model knowledge, while authorized staff need a controlled way to define the material the tutor may use. The platform already delivers and enrolls learners into exact course versions, so chatbot behavior should follow the same publication and access boundaries.

## What Changes

- Add chatbot configuration for each course version, including enablement and administrator-approved context.
- Add permission-controlled chatbot context management to the existing curriculum administration workspace.
- Add a chatbot to course-specific learner pages only when it is enabled for the learner's enrolled, published course version.
- Add an authenticated Django chat endpoint that resolves the learner's enrollment server-side, keeps conversations isolated by learner and course version, and calls the Math Tutor API without exposing its API key or the raw approved context to the browser.
- Ground every request in the approved context, refuse questions without sufficient supporting context, and return evidence references that the platform can validate.
- Add dedicated input limits, throttling, provider timeout/failure behavior, audit fields, and tests for access isolation, prompt injection, and out-of-context questions.
- Use the provider's stateless `/api/ask` endpoint so the platform can reapply context and conversation boundaries on every turn rather than relying on provider-managed sessions.

## Capabilities

### New Capabilities

- `course-context-chatbot`: Course-version chatbot authoring, learner availability, grounded conversation behavior, enrollment enforcement, and external Math Tutor API integration.

### Modified Capabilities

None.

## Impact

- `tella_backend/curriculum`: course-version chatbot configuration, serialization, permissions, services, migrations, and tests.
- `tella_backend`: learner chat session/message persistence, grounded prompt construction and validation, a course chat endpoint, dedicated throttling, external HTTP client configuration, and API tests.
- `admin-platform`: course-version chatbot settings, API types/client support, learner chat UI on course overview and activity routes, proxy allowlist changes, and frontend tests.
- Runtime configuration: server-only Math Tutor API base URL, API key, request timeout, context/message limits, and chatbot throttle settings.
- Operations and privacy: external processing of approved course context and learner messages, credential rotation, observability without sensitive prompt logging, and documented provider-retention assumptions.
- No breaking API changes are intended; the chatbot is additive and disabled until a course version has valid approved context.
