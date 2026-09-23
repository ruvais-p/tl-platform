## Why

Learners currently have an AI course tutor but no course-scoped way to ask a human teacher a question or continue a doubt-resolution conversation. Teachers and academic managers also lack a shared inbox for seeing and answering questions from the learners they are responsible for, so support happens outside the platform and loses course and enrollment context.

## What Changes

- Add a persistent human support conversation for each learner and assigned course version, kept separate from the existing AI chatbot sessions and messages.
- Let an actively enrolled learner open the support chat from course pages, load prior messages, send text messages, and receive replies and unread-state updates in real time.
- Add a staff chat workspace where teachers can see and reply only to conversations for students in their assigned groups, while academic managers can oversee and reply to all course-support conversations.
- Admit teachers to the staff portal with permission-scoped navigation and APIs so they can use the chat workspace without gaining broader administration access.
- Add authenticated WebSocket connections, durable message persistence, paginated history APIs, read state, reconnect recovery, idempotent sends, throttling, and authorization checks throughout the connection lifecycle.
- Add short-lived, single-use socket tickets so the browser can establish a Django WebSocket connection without exposing the JWT stored in HTTP-only Next.js cookies.
- Add Django Channels and a Redis-backed production channel layer for cross-process real-time delivery.
- Keep the existing course-context AI chatbot behavior and data model unchanged.

## Capabilities

### New Capabilities

- `course-support-chat`: Enrollment-scoped human conversations, teacher and academic-manager access, real-time message delivery, durable history, unread state, socket authentication, and course/staff chat surfaces.

### Modified Capabilities

None.

## Impact

- `tella_backend/tutoring`: new support-conversation models, selectors, services, serializers, REST endpoints, WebSocket consumers, routing, permissions, migrations, retention hooks, and tests.
- `tella_backend/accounts`: dedicated support-chat permissions, group synchronization, socket-ticket authentication, and restricted staff-portal admission for teachers.
- `tella_backend/config`: Channels ASGI routing, channel-layer configuration, Redis/runtime settings, origin controls, and real-time rate and size limits.
- `admin-platform`: learner support-chat launcher above the existing AI tutor, course-scoped chat sheet, staff chat inbox/thread workspace, API clients, socket lifecycle handling, proxy allowlists, navigation, and frontend tests.
- Runtime and deployment: add Django Channels, a Channels Redis backend, an ASGI-capable production server, and a shared Redis service. WebSocket routing and infrastructure must support long-lived connections.
- Data and operations: persist learner/staff messages and read state under a dedicated retention and privacy policy, with non-sensitive connection and delivery observability.
