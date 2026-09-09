## Context

See `proposal.md` for motivation and scope.

The platform uses Django REST Framework as the source of truth for curriculum, authorization, and enrollment. The Next.js application provides separate staff and learner sessions and proxies an explicit allowlist of Django routes. Learners are enrolled in an exact `CourseVersion`, and the project guidance already says new versions should be published instead of rewriting historical learning records.

The supplied Math Tutor API exposes `POST /api/chat` with provider-managed session memory and `POST /api/ask` with a single free-form `message`. Both return a free-form `reply`; the reference does not expose a system-message role, context field, structured-output guarantee, source citations, model identifier, payload limit, retention policy, or error/rate-limit contract. Consequently, the platform must own course selection, conversation isolation, grounding instructions, evidence validation, and failure handling.

## Goals / Non-Goals

**Goals:**

- Bind chatbot configuration and conversations to the learner's enrolled course version.
- Keep approved context and the Math Tutor credential server-side.
- Make insufficient evidence produce a deterministic refusal instead of an answer from general model knowledge.
- Preserve useful multi-turn conversation while reapplying the grounding boundary on every turn.
- Keep provider-specific HTTP and response parsing behind a replaceable service boundary.
- Integrate with existing staff permissions, learner sessions, proxy allowlists, and responsive course pages.
- Fail closed when configuration, enrollment, provider responses, or evidence validation are invalid.

**Non-Goals:**

- Uploading or extracting context from PDF, Word, video, or arbitrary files in the first version.
- Automatically treating the entire curriculum hierarchy as chatbot context.
- Open-ended internet search, tools, actions, grading, progress updates, or cross-course tutoring.
- Training or fine-tuning a model.
- Exposing the provider's `/api/chat` sessions directly to learners.
- Claiming that prompt instructions alone provide a formal guarantee against every hallucination; strictness comes from bounded inputs, evidence requirements, validation, and refusal behavior.

## Decisions

### Store chatbot configuration against `CourseVersion`

Create a dedicated tutoring domain model with a one-to-one relationship to `curriculum.CourseVersion`. The initial configuration contains `is_enabled`, `approved_context`, `context_revision`, `updated_by`, and timestamps. A configuration may be saved while disabled, but enabling it requires non-blank context. Updating or disabling the context increments its revision and invalidates active conversations using an older revision.

This is preferred over fields on `Course` because enrollments and historical progress are version-specific. A separate model is preferred over adding large text and chatbot lifecycle fields directly to `CourseVersion`, and leaves room for later context sources without changing the curriculum core.

The admin API exposes the configuration only to callers with a dedicated `tutoring.manage_course_chatbot` permission. `ACADEMIC_MANAGER` and `CONTENT_MANAGER` receive that permission through group setup; super administrators inherit it. Learner course responses expose only availability metadata, never `approved_context`, audit fields, or provider settings.

### Resolve the authoritative version from enrollment

Expose an authenticated course chat API shaped like:

```text
POST /api/v1/courses/{course_id}/chat/
{
  "message": "...",
  "session_id": "optional UUID"
}

{
  "session_id": "UUID",
  "reply": "...",
  "grounded": true,
  "citations": [{"chunk_id": "C3", "excerpt": "..."}]
}
```

Django resolves the student's active, unexpired enrollment for `course_id` and uses its exact `course_version`. It rejects inaccessible, unpublished, disabled, blank-context, or mismatched configurations without revealing whether another version has a chatbot. The client never submits a course-version identifier.

This builds on the existing enrollment selector boundary instead of trusting the version chosen by the Next.js page or the published version inferred from a nested course response.

### Keep conversation state in the platform and call `/api/ask`

Add `CourseChatSession` and `CourseChatMessage` records in the tutoring domain. A session belongs to one student, one course version, and one context revision. A supplied session UUID is accepted only after ownership and version checks. The server includes a bounded number of recent messages when constructing each request and stores only validated assistant replies as successful assistant messages.

Call the provider's stateless `/api/ask` endpoint for every turn. Each call contains the current grounding policy, approved context excerpts, recent history, and current question. This is preferred over `/api/chat`, whose undocumented server-side memory could outlive an enrollment, mix revisions, drift away from the original context, or be difficult to erase. It also avoids depending on provider session availability for continuity.

The browser may retain only the opaque platform session UUID. Server-side ownership checks make a guessed or copied UUID unusable by another learner.

### Use bounded chunks, evidence output, and fail-closed validation

Normalize approved context and split it deterministically into stable, labeled paragraph chunks whenever its revision changes. For contexts within the provider request budget, send all chunks. If a configured context exceeds that budget, select a bounded set using deterministic lexical relevance scoring; no external corpus or internet source participates.

The provider prompt:

1. identifies the allowed chunks as the only factual source;
2. treats context, history, and the learner question as quoted data rather than instructions;
3. requires the exact insufficient-context sentinel when the answer is not explicitly supported;
4. requests a JSON object containing an answer and evidence entries with chunk IDs and short exact excerpts; and
5. repeats the output contract after the untrusted inputs.

Although `/api/ask` returns a string, the tutoring service parses that string as the requested JSON envelope. It accepts an answer only when every cited chunk was supplied and every evidence excerpt occurs in that chunk after normalization. A missing/invalid envelope, unknown citation, altered evidence excerpt, empty evidence set, refusal sentinel, or failed local relevance gate becomes the platform's fixed refusal response. The raw provider reply is never passed through on validation failure.

This is stronger than a prompt-only approach and enables visible source evidence. It cannot prove that every generated phrase is logically entailed by its evidence; if later evaluation shows that requirement needs a stronger guarantee, the safe alternative is an extractive-only response mode that returns approved excerpts without generative synthesis.

### Keep prompt construction and provider access in Django

Create a small provider client and orchestration service in the tutoring domain. The client owns URL construction, the `x-api-key` header, JSON parsing, connect/read timeouts, and normalized provider errors. The orchestration service owns enrollment checks, session history, chunk selection, prompt construction, evidence validation, and persistence. Views remain thin.

Use a synchronous, explicitly configured HTTP client with mockable transport and no automatic retry. A retry after an ambiguous timeout may duplicate provider work, while a fast `503` lets the learner retry deliberately. Provider base URL, rotated API key, timeouts, maximum message/context sizes, history depth, and rate settings come from environment-backed Django settings. The example credential contained in the reference must not be committed or used as a production secret.

Putting this integration in Django is preferred over calling the provider from the browser, which exposes the key and context, or from an independent Next.js-only handler, which would duplicate enrollment and permission decisions.

### Make configuration an explicit, independently saved admin panel

When a course version is selected in the existing curriculum inspector, show a "Course chatbot" section with an enable switch, approved-context textarea, character/budget feedback, last-updated metadata, and its own Save action. Keeping it separate from the course-version form avoids a partial state in which version fields appear unsaved while chatbot context has already changed, and allows the dedicated permission to govern the panel.

The first version supports manually entered plain text only. A preview/test interaction is deferred until the same enrollment-independent staff preview endpoint and throttling semantics can be specified; the learner endpoint must never be reused by staff to bypass enrollment checks.

### Mount one accessible chat surface across course-specific learner routes

Add a shared layout under the existing learner course route segment so the same chatbot drawer is available on the course overview and activity/check pages. Availability is derived from a safe backend field or endpoint. The launcher is absent when disabled rather than showing a nonfunctional control.

The chat surface uses a button and responsive dialog/sheet pattern, supports keyboard operation, labels messages by role, announces new replies through an appropriate live region, prevents duplicate submission, and preserves mathematical text without interpreting arbitrary model HTML. It shows evidence excerpts separately from the answer. Provider failure produces a retryable "Tutor temporarily unavailable" state; insufficient evidence produces the fixed context-only refusal.

### Apply dedicated abuse, privacy, and observability controls

Use a chatbot-specific DRF throttle stricter than the general authenticated-user limit, backed by shared production cache/storage so limits work across replicas. Enforce request length before provider calls, bound retained history and provider prompt size, and serialize turns per session to prevent concurrent history races.

Operational logs contain request IDs, course-version/session identifiers, latency, selected chunk IDs, validation outcome, and provider status, but not the API key, approved context, learner message, prompt, exact evidence, or raw provider reply. Stored messages follow a configurable retention window and can be deleted by operational policy without affecting curriculum or progress records. Chat content is not used for grading or learner progress.

## Risks / Trade-offs

- [The provider offers only free-form message/reply semantics, so JSON and grounding instructions may be ignored] -> Parse and validate strictly; return a safe refusal instead of forwarding malformed or unsupported content.
- [A cited excerpt can support part of an answer while the model adds an unsupported claim] -> Keep answers concise, show evidence, evaluate adversarial cases, and retain extractive-only mode as the stronger fallback.
- [Lexical retrieval can miss paraphrases or mathematical equivalence] -> Send the full bounded context when possible, normalize mathematical notation, tune with a course-specific evaluation set, and prefer false refusals over unsupported answers.
- [Large administrator context may exceed undocumented provider limits] -> Enforce a configurable authoring budget, chunk deterministically, bound selected excerpts, and verify actual limits in a provider spike before enabling production courses.
- [Context edits during a conversation can mix old questions with new material] -> Increment `context_revision` and close or restart sessions created against older revisions.
- [Persisted learner messages introduce privacy and retention obligations] -> Minimize stored data, restrict access, configure expiry/deletion, avoid sensitive logs, and document the external processor before launch.
- [Global DRF throttling is too generous and local-memory caching is per process] -> Add a chat-specific rate and require shared cache/storage in multi-replica production.
- [The external service can be slow or unavailable] -> Use short explicit timeouts, no implicit retries, a stable `503` contract, and a retryable learner UI without fabricating an answer.
- [An exposed reference credential could be abused] -> Rotate it before deployment, inject it only through backend secrets, and scan code and built frontend assets for accidental disclosure.

## Migration Plan

1. Add the tutoring app, disabled-by-default configuration/session/message models, migrations, permissions, settings validation, and provider client tests.
2. Add staff configuration APIs and group-permission synchronization. Existing course versions remain unchanged and have no chatbot until an authorized user explicitly configures one.
3. Add the enrollment-scoped learner chat endpoint, grounding pipeline, evidence validation, dedicated throttling, retention hooks, and adversarial backend tests.
4. Deploy backend environment configuration with a rotated API key and shared production throttle storage; verify provider payload limits, timeouts, and error mapping in staging.
5. Add the admin configuration panel and learner proxy allowlists/types/tests, then add the shared learner chat surface.
6. Configure and evaluate one non-production course version with in-context, out-of-context, cross-course, multilingual, mathematical, and prompt-injection questions.
7. Enable selected published course versions gradually while monitoring only non-sensitive latency, refusal, validation-failure, and provider-error metrics.

Rollback disables all chatbot configurations and removes the learner launcher/proxy route. The backend endpoint then fails closed while configuration and conversation tables remain available for audit or controlled deletion. No curriculum or progress rollback is required.

## Open Questions

- What retention and training commitments does the Math Tutor API operator make for submitted context and learner messages? The provided reference does not state them, so production enablement requires an operational/privacy answer.
- What request-size, rate-limit, timeout, language, and model-version guarantees does the provider support? These values should be measured in staging and then fixed in deployment settings without changing the architecture.
