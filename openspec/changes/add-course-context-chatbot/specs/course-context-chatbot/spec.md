## Purpose

Provide enrolled learners with a course-version-specific tutor that answers only from administrator-approved context while keeping configuration, conversations, and provider credentials securely isolated.

## ADDED Requirements

### Requirement: Authorized course-version chatbot configuration
The system SHALL allow authorized staff to create and update one chatbot configuration for a course version, including whether the chatbot is enabled and its approved plain-text context. The system MUST reject enabling a configuration whose approved context is blank. Updating or disabling a configuration MUST advance its context revision so conversations created for older context cannot continue.

#### Scenario: Save disabled draft context
- **WHEN** authorized staff save non-empty approved context with the chatbot disabled
- **THEN** the system stores the configuration without making the chatbot available to learners

#### Scenario: Reject enabled blank context
- **WHEN** authorized staff attempt to enable a course-version chatbot with blank approved context
- **THEN** the system rejects the request with a field-level validation error

#### Scenario: Unauthorized staff cannot configure chatbot
- **WHEN** an authenticated staff user without chatbot-management permission attempts to read or change a chatbot configuration
- **THEN** the system denies access without changing the configuration

#### Scenario: Context revision invalidates an existing conversation
- **WHEN** approved context is changed or the chatbot is disabled after a learner conversation was created
- **THEN** that conversation cannot be used for another chatbot turn

### Requirement: Learner availability follows exact enrollment
The system MUST make a chatbot available only when the learner has an active, unexpired enrollment in the requested course, the enrollment's exact course version is published, and that version has an enabled configuration with non-blank context. The learner MUST NOT choose the authoritative course version.

#### Scenario: Enrolled learner sees chatbot availability
- **WHEN** a learner loads a course whose enrolled published version has an enabled valid chatbot configuration
- **THEN** the learner response indicates that the course chatbot is available without exposing its approved context

#### Scenario: Chatbot is unavailable for another version
- **WHEN** a learner is enrolled in one version of a course and only a different version has an enabled chatbot
- **THEN** the chatbot is unavailable to that learner

#### Scenario: Expired enrollment cannot use chatbot
- **WHEN** a learner with an expired or inactive enrollment submits a chatbot message
- **THEN** the system rejects the request without contacting the external provider

### Requirement: Context-only grounded responses
The system SHALL construct each provider request exclusively from the active configuration's approved context, bounded conversation history, the learner's current question, and grounding instructions. It MUST return a generated answer only when the response supplies valid evidence from context excerpts sent for that turn. It MUST return a fixed context-only refusal when relevant evidence is absent or response grounding validation fails.

#### Scenario: Answer supported by approved context
- **WHEN** an enrolled learner asks a question answerable from the approved context and the provider returns a valid answer with exact supporting evidence
- **THEN** the system returns the answer with validated evidence references

#### Scenario: Question is outside approved context
- **WHEN** a learner asks a question for which the approved context contains no sufficient supporting evidence
- **THEN** the system returns the fixed context-only refusal and does not present an answer from general model knowledge

#### Scenario: Provider cites unavailable evidence
- **WHEN** the provider returns an answer citing a chunk or excerpt that was not supplied for the current turn
- **THEN** the system discards the provider answer and returns the fixed context-only refusal

#### Scenario: Prompt-injection request
- **WHEN** a learner asks the chatbot to ignore its context or reveal hidden instructions, configuration, or credentials
- **THEN** the system does not reveal those values and returns only a valid context-supported answer or the fixed refusal

### Requirement: Isolated multi-turn conversations
The system SHALL support multi-turn conversations using platform-owned session identifiers. Every conversation MUST belong to exactly one learner, course version, and context revision, and only a bounded amount of recent history SHALL be included in a provider request.

#### Scenario: Continue owned conversation
- **WHEN** a learner supplies a valid session identifier belonging to that learner, enrolled course version, and current context revision
- **THEN** the system includes bounded validated history and records the new turn in the same conversation

#### Scenario: Reject another learner's session
- **WHEN** a learner supplies a session identifier owned by another learner
- **THEN** the system rejects the request without revealing the session or contacting the provider

#### Scenario: Reject session from another course
- **WHEN** a learner supplies a session identifier associated with a different course version
- **THEN** the system rejects the request without mixing conversation history

### Requirement: Provider credentials and context remain server-side
The system MUST call the configured Math Tutor API from the Django backend using server-only credentials. Browser responses, learner-visible payloads, client bundles, and ordinary operational logs MUST NOT contain the API key, full approved context, constructed prompt, or raw rejected provider response.

#### Scenario: Browser submits a chat message
- **WHEN** the learner frontend sends a chatbot request
- **THEN** it sends only the course, message, and optional platform session identifier through the authenticated learner proxy

#### Scenario: Provider is unavailable
- **WHEN** the external provider times out, rejects authentication, returns malformed transport JSON, or reports failure
- **THEN** the system returns a normalized retryable service-unavailable response without fabricating or persisting an assistant answer

### Requirement: Chat-specific limits and safe rendering
The system MUST enforce chatbot-specific throttling and configured message, context, history, and provider-request limits before invoking the external provider. The learner interface SHALL prevent duplicate submissions, render assistant output as non-executable text with supported mathematical notation, expose validated evidence separately, and provide accessible status updates.

#### Scenario: Message exceeds configured limit
- **WHEN** a learner submits a message longer than the configured maximum
- **THEN** the system returns a validation error without contacting the provider

#### Scenario: Learner exceeds chatbot rate limit
- **WHEN** a learner exceeds the configured chatbot request rate
- **THEN** the system returns a throttling response without contacting the provider

#### Scenario: Learner submits while a turn is pending
- **WHEN** the learner activates send again before the current turn completes
- **THEN** the interface does not create a duplicate request and announces the pending state accessibly
