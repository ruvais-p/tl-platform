## Context

See `proposal.md` for the motivation and product scope.

The Django backend already treats `Enrollment` as the authoritative learner-to-course-version access record. Group and individual `CourseAssignment` creation produces enrollments, and `StudentGroup.teacher` establishes the current teacher responsible for a cohort. Existing selectors scope teacher reads through that relationship, while academic managers have platform-wide academic visibility.

The tutoring domain already stores AI tutor sessions and messages, but those records are bound to an approved-context revision and permit only `USER` and `ASSISTANT` roles. Their grounding, invalidation, and retention semantics are unsuitable for human communication.

The Next.js application stores staff and learner JWTs in separate HTTP-only cookies and proxies REST requests to Django. Browser code cannot retrieve those tokens for a direct WebSocket authorization header. Django exposes an ASGI application, but the project does not yet configure Channels, WebSocket routing, or a channel layer. `REDIS_URL` exists, while the default Django cache is currently process-local.

The learner course layout already mounts the course AI chatbot across overview, activity, and learning-check routes. Teachers have backend permissions and scoped selectors, but `portal_admission` currently excludes the `TEACHER` group from the staff portal.

## Goals / Non-Goals

**Goals:**

- Keep human support messages durable and strictly separate from AI tutor data.
- Use one authorization policy for REST history, socket commands, and real-time recipients.
- Make PostgreSQL the source of truth and use WebSockets only for commands and timely change notification.
- Preserve correct ordering and duplicate protection across retries, reconnects, tabs, and multiple application workers.
- Revoke teacher access immediately when group responsibility or the matching course assignment changes.
- Authenticate sockets without exposing the existing staff or learner JWT to browser JavaScript.
- Support an ASGI deployment with cross-process delivery through Redis.

**Non-Goals:**

- File attachments, reactions, message editing or deletion, typing indicators, online presence, voice/video calls, or group chat.
- A learner-visible delivered/read receipt for the other participant; read state is initially used for each user's own unread counts and multi-tab synchronization.
- Automatic AI participation, AI summarization, or mixing support transcripts into the course-context chatbot.
- Email, push, SMS, or Moodle notifications.
- Assigning academic managers to individual learners or groups. Academic managers receive global oversight in this version.
- End-to-end encryption. Transport encryption and server-side access control protect the feature, while authorized platform services retain messages according to policy.

## Decisions

### Model human support conversations separately from the AI tutor

Add dedicated support records in the tutoring domain:

```text
CourseSupportConversation
  id
  student -> User (PROTECT)
  course_version -> CourseVersion (PROTECT)
  opened_from_enrollment -> Enrollment (PROTECT)
  status: OPEN | CLOSED
  last_sequence
  last_message_at
  created_at / updated_at
  UNIQUE(student, course_version)

CourseSupportMessage
  id
  conversation -> CourseSupportConversation (CASCADE)
  sender -> User (PROTECT)
  sender_role: STUDENT | TEACHER | ACADEMIC_MANAGER | ADMIN
  sequence
  client_message_id
  content
  created_at
  UNIQUE(conversation, sequence)
  UNIQUE(sender, client_message_id)

CourseSupportReadState
  id
  conversation -> CourseSupportConversation (CASCADE)
  user -> User (CASCADE)
  last_read_sequence
  updated_at
  UNIQUE(conversation, user)
```

`opened_from_enrollment` records why the conversation could be created, while current enrollment and assignment state is re-evaluated for later access. A single conversation per student and course version preserves continuity across enrollment renewals without merging different course versions.

`sender_role` is an audit snapshot, not an authorization input. Current permissions determine access. Message bodies are immutable in the first version so all clients see the same sequence and audit history.

Alternative considered: extend `CourseChatSession` and `CourseChatMessage`. This was rejected because AI sessions belong to a context revision, can be invalidated by configuration edits, have assistant-specific citations, and follow a different retention lifecycle.

### Derive participants and access instead of storing a mutable participant list

Central selectors and services enforce these rules:

- A student may create a conversation when the requested course resolves to an active, unexpired enrollment for its exact published course version.
- A student may read a conversation whose `student` is that user. Sending additionally requires a currently accessible enrollment for the conversation's course version.
- A teacher may read and send only when the student currently belongs to a group assigned to that teacher and that same group has an active `CourseAssignment` for the conversation's course and course version.
- An academic manager with `tutoring.view_all_course_support_chats` may read and send in every support conversation.
- A super administrator receives the global permission. Ordinary administrators do not receive chat access by default.
- A closed conversation remains readable. A permitted student send reopens it; authorized staff may explicitly close it.

The teacher rule intentionally checks the matching group assignment as well as membership. Membership alone could expose a learner's chat for an unrelated course assigned through another group or individually. Individually assigned or manually enrolled learners remain supportable by academic managers when no responsible group teacher can be derived.

No durable participant table is needed because it would become stale when a learner moves group, a course assignment is cancelled, or the group's teacher changes. A shared `can_read_conversation`/`can_send_conversation` policy is called by REST selectors, socket command handlers, and event recipient resolution.

Alternative considered: grant teachers access to every course conversation belonging to any learner in their group. This was rejected as overly broad for learners who belong to multiple groups or receive individual course assignments.

### Admit teachers to a permission-scoped staff portal

Add `TEACHER` to staff portal admission and give the group the dedicated reply permission. The staff navigation exposes the chat workspace when that permission is present and labels the role as Teacher. Existing permission-based navigation and backend queryset scoping remain in force, so admission does not imply global administrative access.

Add explicit permissions rather than checking group names inside transport code:

- `tutoring.reply_to_assigned_course_support_chats`
- `tutoring.view_all_course_support_chats`
- `tutoring.close_course_support_chats`

Teachers receive assigned-chat reply and close permissions. Academic managers receive global view/reply and close permissions. Super administrators inherit all permissions. Student ownership is evaluated directly and does not require granting a broad staff permission.

Alternative considered: create a separate teacher application. This would duplicate authentication, shell, API proxy, and responsive workspace behavior without creating a stronger authorization boundary.

### Use REST for snapshots and WebSockets for commands and updates

REST endpoints provide idempotent resource discovery and cursor/sequence-based recovery:

```text
POST /api/v1/course-support/socket-ticket/
POST /api/v1/courses/{course_id}/support-conversation/
GET  /api/v1/course-support/conversations/?cursor=...
GET  /api/v1/course-support/conversations/{id}/messages/?after_sequence=...
```

Creating the course conversation is idempotent and returns the existing row when one already exists. Staff conversation lists are ordered by `last_message_at` and include student, group, course, last-message summary, status, and the requesting user's unread count. Message history is bounded and paginated; the client requests messages after its last durable sequence following a reconnect.

A single native WebSocket per browser session connects to:

```text
/ws/course-support/?ticket=<single-use opaque ticket>
```

The protocol uses versioned JSON envelopes:

```text
client -> {"v":1,"request_id":"...","type":"message.send","conversation_id":"...","client_message_id":"...","content":"..."}
server -> {"v":1,"request_id":"...","type":"message.accepted","message":{...}}
server -> {"v":1,"type":"message.created","conversation":{...},"message":{...}}

client -> {"v":1,"request_id":"...","type":"conversation.read","conversation_id":"...","sequence":42}
server -> {"v":1,"request_id":"...","type":"conversation.read.accepted","conversation_id":"...","sequence":42}

client -> {"v":1,"request_id":"...","type":"conversation.close","conversation_id":"..."}
server -> {"v":1,"type":"conversation.updated","conversation":{...}}
```

Unknown versions or message types receive a structured error without closing an otherwise valid connection. Authentication failures and policy violations use explicit close/error codes. Message content is plain text with configured byte/character limits.

Alternative considered: make the WebSocket the only source for lists and history. This was rejected because REST pagination is easier to authorize, retry, cache-control, test, and reconcile after a missed event. Alternative considered: polling only. This does not satisfy timely bidirectional updates and creates unnecessary repeated reads.

### Commit before broadcasting and use monotonic per-conversation sequences

The send service runs in a database transaction, locks the conversation, rechecks sender access, validates and normalizes content, increments `last_sequence`, creates the message, and updates conversation summary fields. It registers the broadcast with `transaction.on_commit`, so clients never receive an event for a rolled-back row.

The server acknowledges repeated `(sender, client_message_id)` commands with the already-created message. `sequence` gives deterministic ordering and a compact recovery/read cursor even when timestamps collide. Clients merge by message ID and sequence rather than assuming socket delivery is exactly once.

Delivery is at least once; persistence and idempotency produce an effectively-once user experience. Redis is not treated as message storage.

Alternative considered: order only by `created_at` and UUID. That supports stable pagination but makes read positions and gap recovery less direct and does not express conversation-local order as clearly.

### Deliver events through per-user channel groups

Each authenticated socket joins only a group derived from its user UUID, such as `course_support.user.<uuid>`. After a committed change, the service recalculates currently authorized recipients and emits to their personal groups. This supports multiple tabs/devices and ensures a teacher removed from a group does not keep receiving new content merely because an old socket remains connected.

Conversation-wide channel groups and one broad academic-manager group are avoided because their membership can outlive a permission or assignment change until reconnect. Every inbound command still rechecks database authorization. REST recovery remains authoritative if a recipient changes while an event is in flight.

The initial recipient set is the student, teachers satisfying the matching assignment rule, and active users with global chat permission. The event contains only the bounded fields required by the inbox/thread UI; clients fetch history when they detect a sequence gap.

### Authenticate sockets with short-lived, single-use tickets

Separate staff and learner Next.js proxy allowlists expose the same Django ticket endpoint through their existing HTTP-only sessions. Django authenticates the REST request normally and creates an opaque random ticket. Only a cryptographic hash is stored with `user`, `portal`, `expires_at`, and `consumed_at`.

The ASGI authentication middleware hashes the presented token and consumes the matching ticket inside a locked transaction. Expired, used, or missing tickets are rejected. Tickets expire after a short configurable interval, are scoped to the current portal, and are never accepted by REST endpoints. A cleanup task removes expired/consumed rows.

The WebSocket URL is configured separately from the REST base URL and uses `wss` outside local development. `AllowedHostsOriginValidator` plus an explicit origin allowlist prevents an attacker-controlled site from opening authenticated platform sockets. Ticket values and WebSocket query strings must be redacted from access logs.

Alternative considered: return the JWT to browser JavaScript. This would weaken the existing HTTP-only-cookie boundary. Alternative considered: authenticate the socket from Django cookies. Django does not own the Next.js session cookies, and cross-origin cookie deployment would add fragile domain and SameSite coupling. Alternative considered: proxy long-lived WebSockets through a Next.js route handler. That is deployment-dependent and less appropriate than routing WebSockets directly to the ASGI service.

### Use Django Channels with Redis and native browser WebSockets

Add Django Channels, `channels-redis`, and a supported ASGI server. `config.asgi` routes HTTP to Django and `/ws/course-support/` through origin validation and ticket authentication to the support consumer. Production uses `REDIS_URL` for the channel layer. Development may use an in-memory channel layer only in a single-process environment.

Use the browser's native `WebSocket` API rather than Socket.IO. Channels already provides the server-side routing and group abstraction needed here, while Socket.IO would introduce a second protocol and client/server dependency without a requirement for its extra transport fallbacks.

The client reconnects with bounded exponential backoff and jitter. Every reconnect obtains a new ticket, reopens the socket, then recovers conversation state through REST using the latest stored sequences. The UI distinguishes connecting, live, recovering, and offline states and does not claim a message was sent until it receives the durable server acknowledgement/event.

### Keep learner and staff surfaces adjacent to existing workflows

The learner course layout renders a small launcher stack with `Ask a teacher` above the existing `Ask course tutor` control. The support launcher appears only when the course response indicates that an accessible enrollment exists; opening it idempotently resolves the course conversation. The responsive sheet shows persisted history, connection state, unread recovery, send failure/retry, and accessible live announcements. Messages render as plain text and never as arbitrary HTML.

The staff shell adds a permission-gated `Chats` destination. Its workspace uses an inbox/thread layout: conversations and filters on the left, selected history and composer on the right, collapsing to separate mobile views. Each row includes the learner, group/source, course version, last message time, status, and unread count. Academic managers may filter by teacher/group/course; teachers receive only their selector-scoped records.

The socket client, event reducer, and transport-independent API types are shared between learner and staff surfaces, while their cookie-backed ticket routes remain separate.

### Apply chat-specific safety, privacy, and operational controls

Enforce content size, event size, per-user send rate, connection rate, and maximum active sockets before processing a command. Production rate state must be shared across workers. Reject binary frames and unrecognized fields. Backpressure or repeated malformed commands may close the connection without affecting persisted history.

Operational logs may include request ID, user ID, conversation ID, message ID, sequence, event type, result code, latency, and socket close code. They must not contain message content, ticket values, JWTs, or full WebSocket query strings. Metrics cover active connections, connection failures, command latency, delivery failures, reconnects, and sequence-gap recoveries.

Support-chat retention is configured independently of AI tutor retention. A management command deletes eligible old messages/conversations according to policy without cascading into enrollment, curriculum, or user records. User-facing deletion/export workflows are not added in this change, but the data model and logs must be included in platform privacy documentation.

Backend tests cover ownership, exact course/version access, group assignment scoping, teacher replacement, multi-group learners, cancelled assignments, global-manager access, inactive enrollments, ticket expiry/reuse, origin rejection, duplicate sends, ordering, post-commit delivery, read-state monotonicity, reconnect gaps, rate limits, and content limits. Frontend tests cover launcher ordering/availability, socket states, optimistic-draft behavior without false delivery, deduplication, unread updates, accessibility, and staff permission hiding.

## Risks / Trade-offs

- [A stale socket could otherwise retain data access after a teacher reassignment] -> Deliver through recalculated per-user recipients and re-authorize every inbound command rather than relying on long-lived conversation-group membership.
- [Redis loss interrupts real-time fan-out] -> Keep PostgreSQL authoritative, expose connection state, and reconcile missed sequences through REST after reconnect; sending fails visibly rather than pretending delivery.
- [A database commit can succeed while event publication fails] -> Record the durable sequence first; clients recover gaps through REST, and metrics alert on publish failures.
- [Academic-manager global access exposes sensitive learner communications to a broad role] -> Protect it with a dedicated permission, omit it from ordinary administrators, audit access, and avoid logging content.
- [Teacher staff-portal admission could unintentionally expose administrative features] -> Continue permission-gated navigation and backend authorization, add admission regression tests, and grant only assigned-chat permissions plus the teacher's existing scoped permissions.
- [Students in several groups can have several teachers] -> Require a matching active group course assignment; every qualifying teacher is responsible and may participate, with sender identity retained on each message.
- [Individually assigned or manually enrolled learners may have no responsible teacher] -> Allow the academic-manager inbox to handle those conversations and expose the assignment source in staff context.
- [At-least-once socket delivery can show duplicates] -> Use durable message IDs, per-conversation sequences, and sender-generated idempotency keys; clients merge rather than append blindly.
- [Ticket tokens appear in a WebSocket URL] -> Make them opaque, hashed at rest, single-use, very short-lived, TLS-only, and redacted from proxy/application access logs.
- [Large staff inboxes can make recipient and unread queries expensive] -> Add indexes on conversation recency, student/version, message sequence, and read state; paginate lists and precompute conversation summary fields.
- [Human chat introduces privacy and safeguarding obligations beyond the AI tutor] -> Define retention, moderation/escalation ownership, privacy notice, and operational access policy before production rollout.

## Migration Plan

1. Add the conversation, message, read-state, and socket-ticket tables; add indexes and permissions; synchronize groups without changing existing AI chat records.
2. Add centralized access selectors/services, REST serializers/endpoints, cleanup commands, and authorization tests behind a disabled `COURSE_SUPPORT_CHAT_ENABLED` setting.
3. Add Channels ASGI routing, ticket middleware, the WebSocket protocol, Redis channel-layer configuration, limits, metrics, and multi-worker integration tests.
4. Deploy the ASGI-capable backend and Redis configuration while the feature remains disabled. Verify `wss` routing, origin checks, log redaction, ticket consumption, reconnect recovery, and cross-worker delivery in staging.
5. Add Next.js proxy allowlists/ticket routes, the shared socket client, learner launcher/sheet, teacher staff admission, and the staff chat workspace. Keep navigation and launchers hidden while disabled.
6. Enable the feature for internal/staging accounts, exercise teacher changes, assignment cancellation, enrollment expiry, multiple tabs, network interruption, and manager oversight, then enable production.
7. Monitor connection failures, publish failures, command latency, rate rejection, and recovery gaps without collecting message content.

Rollback sets `COURSE_SUPPORT_CHAT_ENABLED=false`, hides both frontends, rejects new tickets/connections, and leaves persisted conversations intact for controlled retention or later re-enable. Existing REST curriculum, enrollment, staff, and AI tutor behavior remains available. Database tables are removed only in a later deliberate migration after the retention decision.

## Open Questions

- What retention period and transcript export/deletion process should apply to human course-support messages? This changes operational configuration and policy documentation, not the chosen architecture.
- Who owns safeguarding escalation when a message contains abuse, self-harm, or other sensitive content? The initial system records the sender and permits authorized oversight, but the organizational response procedure must be defined before production rollout.
