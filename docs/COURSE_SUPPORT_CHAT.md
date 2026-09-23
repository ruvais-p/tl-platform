# Course support chat operations

Course support chat is a durable, course-version-scoped conversation between an enrolled learner and currently responsible academic staff. PostgreSQL is the source of truth. Redis carries transient cross-process events; losing Redis interrupts live delivery but does not lose persisted messages, and clients recover missed sequences through REST.

## Runtime topology

Run Django as ASGI, not WSGI, for this feature. The tracked production server is Daphne:

```bash
daphne -b 0.0.0.0 -p 8000 config.asgi:application
```

Route ordinary HTTP and `/api/v1/` to that service, and pass `/ws/course-support/` through a WebSocket-capable reverse proxy with upgrade headers and long-lived connection timeouts. Do not include the WebSocket query string in access logs: it contains a short-lived, single-use ticket. The backend also avoids logging ticket values, JWTs, message content, and complete credential-bearing URLs.

Production requires shared Redis through `REDIS_URL` for both the Channels layer and cache-backed rate/connection counters. A single-process test or development environment may override `CHANNEL_LAYERS` with Channels' in-memory backend, but that configuration must not be used across multiple workers.

The Next.js server continues to hold staff and learner JWTs in HTTP-only cookies. Browser code obtains an opaque ticket from its same-origin allowlisted REST proxy, then connects directly to the configured Django WebSocket URL. JWTs are never returned to browser JavaScript.

## Configuration

| Variable | Production guidance |
| --- | --- |
| `COURSE_SUPPORT_CHAT_ENABLED` | Keep `false` through infrastructure deployment and staging checks; set `true` only for rollout. Disabling rejects feature REST requests and new socket tickets/connections. |
| `COURSE_SUPPORT_CHAT_WEBSOCKET_URL` | Public `wss://` URL ending in `/ws/course-support/`. Never use `ws://` outside local development. |
| `COURSE_SUPPORT_CHAT_ALLOWED_ORIGINS` | Comma-separated exact HTTPS origins allowed to open sockets, normally the web app origin only. No wildcard origins. |
| `REDIS_URL` | Private authenticated/TLS Redis endpoint available to every ASGI worker. Store the real value in the deployment secret manager. |
| `COURSE_SUPPORT_CHAT_MESSAGE_MAX_CHARS` | Maximum normalized message length; default `2000`. Keep frontend and backend limits aligned. |
| `COURSE_SUPPORT_CHAT_EVENT_MAX_BYTES` | Maximum inbound WebSocket frame size; default `65536`. |
| `COURSE_SUPPORT_CHAT_HISTORY_PAGE_SIZE` | Default bounded REST page size; default `50`, with a server maximum of `100`. |
| `COURSE_SUPPORT_CHAT_SEND_RATE` | Shared-cache per-user send rate; default `20/min`. |
| `COURSE_SUPPORT_CHAT_CONNECTION_RATE` | Shared-cache per-user connection-attempt rate; default `10/min`. |
| `COURSE_SUPPORT_CHAT_MAX_CONNECTIONS_PER_USER` | Concurrent sockets per user; default `5`. |
| `COURSE_SUPPORT_CHAT_TICKET_TTL_SECONDS` | Ticket lifetime; default `30`. Tickets are hashed at rest and consumed once. |
| `COURSE_SUPPORT_CHAT_RETENTION_DAYS` | Independent human-transcript retention window; default `365`. Confirm the organizational policy before production enablement. |
| `COURSE_SUPPORT_CHAT_TICKET_CLEANUP_HOURS` | Age after which consumed tickets are removed; default `1`. |

Run `python manage.py setup_groups` after deployment so teachers, academic managers, and super administrators receive the intended dedicated permissions. Ordinary administrators receive no implicit chat access.

## Retention, privacy, and safeguarding

Schedule this command at least daily:

```bash
python manage.py purge_course_support_chat
```

Use `--dry-run` to report eligible conversation and ticket counts without deleting them. Expired support conversations and their messages are deleted together; curriculum, users, enrollments, and AI tutor sessions are unaffected.

Human messages may contain sensitive learner information. Restrict production database and support access, include these tables in approved data export/deletion procedures, and keep backups aligned with the published retention period. Operational logs may contain bounded identifiers, event types, result codes, sequence numbers, latency, and close codes, but never message bodies, socket tickets, JWTs, or raw WebSocket query strings. The organization must name a safeguarding escalation owner and publish the escalation process before broad rollout.

## Rollout checklist

1. Deploy migrations, run `setup_groups`, deploy Redis, and start the ASGI service while the feature flag remains off.
2. Configure the public `wss://` route, exact allowed origin, proxy upgrade/timeouts, and query-string-redacted access logs.
3. In staging, verify single-use/expired ticket rejection, origin rejection, teacher reassignment and assignment cancellation, enrollment expiry, multiple tabs, Redis interruption, reconnect recovery, close/reopen behavior, and manager oversight.
4. Confirm retention, privacy/export, moderation, and safeguarding ownership; schedule the purge command and operational alerts.
5. Enable the flag for internal users, monitor connection failures, rejected commands, publish failures, latency, and sequence-gap recovery without recording content, then expand rollout.

## Rollback

Set `COURSE_SUPPORT_CHAT_ENABLED=false` and restart ASGI workers. This hides usable launchers after their availability checks, rejects feature REST operations and new sockets, and preserves existing transcripts for later recovery or controlled retention. Keep PostgreSQL migrations and data in place during an operational rollback; remove tables only in a later reviewed migration after the retention decision.
