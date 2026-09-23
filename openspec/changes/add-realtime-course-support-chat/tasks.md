## 1. Backend Data and Access Foundations

- [x] 1.1 Add support conversation, message, read-state, and single-use socket-ticket models with migrations and verify model constraint and ordering tests pass
- [x] 1.2 Add dedicated support-chat permissions, group synchronization, and permission-scoped teacher staff admission and verify account/group admission tests pass
- [x] 1.3 Implement centralized learner, assigned-teacher, and global-manager conversation access selectors and verify exact course-version, reassignment, multi-group, and cancelled-assignment tests pass

## 2. Durable Support Services and REST API

- [x] 2.1 Implement idempotent conversation creation, ordered message persistence, read-state advancement, close/reopen lifecycle, and current-recipient resolution and verify service tests pass
- [x] 2.2 Add bounded serializers and authorization-scoped REST endpoints for availability/conversation creation, staff inbox, message recovery, read state, close, and socket tickets and verify API tests pass
- [x] 2.3 Add support-chat feature, size, rate, ticket-expiry, retention, WebSocket URL, and allowed-origin settings plus cleanup commands and verify settings and retention tests pass

## 3. Real-Time Transport

- [x] 3.1 Add Django Channels, Redis channel-layer, ASGI protocol routing, origin validation, and single-use ticket authentication and verify ASGI/ticket connection tests pass
- [x] 3.2 Implement the versioned WebSocket send/read/close protocol with per-user post-commit events, structured errors, limits, and idempotent acknowledgement and verify consumer tests pass
- [x] 3.3 Verify reconnect gap recovery, duplicate sends, revoked access, multi-connection delivery, and non-sensitive logging through backend integration tests

## 4. Shared Frontend Transport

- [x] 4.1 Add support-chat types, REST clients, staff/learner proxy allowlists and ticket routes, WebSocket lifecycle/reconnect client, and event reducer and verify client and policy tests pass

## 5. Learner Experience

- [x] 5.1 Add the accessible `Ask a teacher` launcher above the AI tutor across course routes with persisted history, connection recovery, send/retry, and read-state behavior and verify learner component tests pass

## 6. Staff Experience

- [x] 6.1 Add a permission-gated Chats navigation destination and responsive staff inbox/thread workspace with filters, unread state, close/reopen updates, and real-time replies and verify staff component tests pass
- [x] 6.2 Verify teacher portal access exposes only permission-allowed navigation and assigned conversations while academic managers receive global chat visibility through frontend and API tests

## 7. Documentation and Final Verification

- [x] 7.1 Document ASGI/WebSocket routing, Redis, feature flag, origin, limit, retention, privacy, log-redaction, rollout, and rollback configuration and verify tracked examples contain no credentials
- [x] 7.2 Run focused backend and frontend suites, migrations/checks, OpenSpec strict validation, and repository secret scans; fix regressions and record all checks passing
