## 1. Tutoring Data and Configuration

- [x] 1.1 Add the tutoring Django app with course-version configuration, chat session, and chat message models plus migrations; verify `manage.py makemigrations --check` reports no missing migrations
- [x] 1.2 Register tutoring settings and assign the dedicated chatbot-management permission to the intended staff groups; verify group synchronization and settings tests pass
- [x] 1.3 Add permission-scoped chatbot configuration serializers, services, viewset routes, and safe learner availability metadata; verify API tests cover blank enabled context, revision changes, and context non-disclosure

## 2. Grounded Chat Backend

- [x] 2.1 Implement the server-only Math Tutor `/api/ask` client with environment-backed URL/key/timeouts and normalized failures; verify mocked client tests cover success, timeout, authentication failure, and malformed responses
- [x] 2.2 Implement deterministic context chunking, bounded selection, prompt construction, refusal sentinel handling, and exact evidence validation; verify unit tests cover supported, unsupported, injected, and invalid-citation responses
- [x] 2.3 Implement enrollment-bound session orchestration and the course chat endpoint with session/version/revision isolation; verify API tests prove inactive enrollment, cross-user, cross-course, and stale-session requests never invoke the provider
- [x] 2.4 Add chat-specific input limits, throttling, concurrency protection, and metadata-only logging; verify limit, duplicate/concurrent turn, throttle, and provider-failure tests pass without persisting invalid assistant replies

## 3. Admin Chatbot Authoring

- [x] 3.1 Extend staff proxy policy, curriculum client types, and API helpers for chatbot configuration; verify proxy-policy and API-client tests accept only the intended operations
- [x] 3.2 Add an independently saved Course chatbot panel for selected course versions with enablement, approved context, budget feedback, permissions, and validation; verify component tests cover load, save, permission hiding, and enabled-empty rejection

## 4. Learner Chat Experience

- [x] 4.1 Extend learner response types, API client, and proxy policy for chatbot availability and course chat submission without exposing context or credentials; verify learner policy/client tests cover allowed and rejected routes
- [x] 4.2 Add a shared accessible responsive course chatbot surface across course overview, activity, and learning-check pages with isolated session state, pending/error/refusal states, safe text rendering, and evidence display; verify component tests cover availability, duplicate-send prevention, successful evidence, refusal, and provider failure

## 5. Documentation and Verification

- [x] 5.1 Document server-only chatbot configuration, credential rotation, privacy/retention assumptions, endpoint behavior, and rollout constraints in environment examples and platform docs; verify no real API key or approved context appears in tracked files
- [x] 5.2 Run strict OpenSpec validation plus focused Django and frontend tests, lint, typecheck, and production build; resolve all regressions and record successful commands
