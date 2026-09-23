## Purpose

Provide enrolled learners and responsible academic staff with secure, durable, course-scoped human messaging and real-time updates without weakening enrollment or staff access boundaries.

## ADDED Requirements

### Requirement: Course-scoped learner conversations
The system SHALL allow a learner with an active, unexpired enrollment to create or retrieve one human support conversation for the enrollment's exact course version. The system MUST NOT use a client-supplied course version as the authority and MUST keep support conversations separate from AI tutor sessions.

#### Scenario: Learner opens support for an assigned course
- **WHEN** a learner opens support for a course with an active accessible enrollment
- **THEN** the system creates or returns the single conversation for that learner and enrolled course version

#### Scenario: Reopening support is idempotent
- **WHEN** the learner opens support repeatedly for the same course version
- **THEN** the system returns the existing conversation without creating duplicates

#### Scenario: Learner lacks an accessible enrollment
- **WHEN** a learner requests support for an unassigned, inactive, expired, unpublished, or mismatched course enrollment
- **THEN** the system rejects the request without exposing another learner's or version's conversation

#### Scenario: AI tutor remains isolated
- **WHEN** a human support message is created or a course chatbot configuration changes
- **THEN** human support history and AI tutor history remain independent and neither lifecycle operation changes the other

### Requirement: Current responsibility controls staff access
The system MUST authorize every staff list, history, send, close, and real-time delivery operation from current responsibility and permissions. A teacher SHALL access a conversation only when the learner currently belongs to a group assigned to that teacher and that group has an active assignment for the conversation's exact course version. An authorized academic manager or super administrator SHALL access all course-support conversations.

#### Scenario: Assigned teacher accesses a conversation
- **WHEN** a teacher is assigned to the learner's group and that group has the active matching course-version assignment
- **THEN** the teacher can list, read, reply to, and close that conversation

#### Scenario: Teacher is responsible for an unrelated course
- **WHEN** a teacher owns a learner's group but that group does not have the matching active course-version assignment
- **THEN** the teacher cannot discover, read, receive updates for, or modify the conversation

#### Scenario: Teacher responsibility changes
- **WHEN** the group teacher changes or the matching assignment ceases to be active
- **THEN** the previous teacher immediately loses REST and real-time access to subsequent conversation data

#### Scenario: Academic manager oversight
- **WHEN** an academic manager with global course-support permission accesses the staff inbox
- **THEN** the manager can list, read, reply to, and close every course-support conversation

#### Scenario: Ordinary administrator has no implicit access
- **WHEN** an administrator without a course-support permission requests a conversation or socket update
- **THEN** the system denies access even if the administrator can manage other platform resources

### Requirement: Permission-scoped teacher staff admission
The system SHALL allow an active teacher to authenticate to the staff portal for the course-support workspace while continuing to hide and deny staff functions for which the teacher lacks permission.

#### Scenario: Teacher enters the staff chat workspace
- **WHEN** an active teacher authenticates to the staff portal
- **THEN** the portal admits the teacher and exposes the chat navigation and assigned conversations permitted to that teacher

#### Scenario: Teacher requests an unauthorized administration function
- **WHEN** an admitted teacher requests a staff page or API operation without its required permission
- **THEN** the system hides or denies that function using the existing permission boundary

### Requirement: Single-use authenticated real-time connection
The system SHALL issue a short-lived, single-use socket credential through the authenticated staff or learner session and MUST bind an accepted WebSocket connection to that authenticated user and portal. It MUST reject expired, consumed, malformed, cross-origin, or disabled-feature connections without exposing the underlying JWT.

#### Scenario: Authenticated user connects
- **WHEN** an authenticated user obtains a socket credential and presents it once from an allowed origin before expiry
- **THEN** the system accepts the connection as that user without returning the session JWT to browser code

#### Scenario: Socket credential is replayed
- **WHEN** a consumed socket credential is presented again
- **THEN** the system rejects the connection and does not attach it to a user

#### Scenario: Socket credential expires
- **WHEN** a socket credential is presented after its configured expiry
- **THEN** the system rejects the connection and requires a newly authenticated credential

#### Scenario: Untrusted origin attempts connection
- **WHEN** a socket connection originates outside the configured allowed origins
- **THEN** the system rejects it before support data is delivered

### Requirement: Durable ordered and idempotent messaging
The system MUST authorize and persist a message before broadcasting it. Each conversation SHALL expose a monotonically increasing message sequence, and a repeated client message identifier from the same sender MUST resolve to the original message rather than create a duplicate.

#### Scenario: Learner sends a message
- **WHEN** an authorized learner sends valid text with a new client message identifier
- **THEN** the system durably stores it with the next sequence and sends the created event to currently authorized recipients

#### Scenario: Staff member replies
- **WHEN** an authorized teacher or academic manager sends valid text
- **THEN** the system persists the identified staff sender and broadcasts the reply to the learner and other currently authorized recipients

#### Scenario: Client retries an acknowledged send
- **WHEN** the same sender repeats a send using the same client message identifier
- **THEN** the system returns the original durable message and does not advance the conversation sequence

#### Scenario: Persistence fails
- **WHEN** a message transaction does not commit
- **THEN** the system does not emit a successful acknowledgement or created-message event

#### Scenario: Access is revoked before send
- **WHEN** a connected user sends after losing access to the conversation
- **THEN** the system rejects the command and does not persist or broadcast the message

### Requirement: Recoverable history and unread state
The system SHALL provide authorization-scoped, bounded conversation and message history. It MUST support sequence-based gap recovery and maintain a monotonic per-user read position from which unread counts are derived.

#### Scenario: Client reconnects after missing events
- **WHEN** a client reconnects with its last received sequence
- **THEN** the client can retrieve all authorized messages after that sequence in stable order

#### Scenario: Staff inbox loads
- **WHEN** authorized staff load the course-support workspace
- **THEN** the system returns only visible conversations ordered by recent activity with learner, course, status, last-message, and unread context

#### Scenario: User marks a conversation read
- **WHEN** an authorized user marks a valid message sequence as read
- **THEN** the system advances that user's read position and updates the user's unread state across active connections

#### Scenario: Stale read update arrives
- **WHEN** a user submits a read sequence lower than the stored read position
- **THEN** the stored read position does not move backwards

### Requirement: Conversation lifecycle follows enrollment
The system SHALL retain existing conversation history independently of current send eligibility. A learner MUST be able to read their own existing history after enrollment access ends but MUST NOT send another message until the exact course-version enrollment is accessible again. Authorized staff SHALL be able to close a conversation, and a valid later learner message SHALL reopen it.

#### Scenario: Enrollment expires after a conversation exists
- **WHEN** a learner whose enrollment is no longer accessible loads an existing owned conversation
- **THEN** the system returns its retained history in read-only form and rejects new messages

#### Scenario: Staff closes a conversation
- **WHEN** authorized staff close an open conversation
- **THEN** the conversation becomes closed without deleting its messages

#### Scenario: Eligible learner messages after closure
- **WHEN** a learner with a current accessible enrollment sends to a closed conversation
- **THEN** the system reopens the conversation and persists the new message

### Requirement: Safe chat input and privacy controls
The system MUST enforce configured message, frame, send-rate, connection-rate, and active-connection limits before accepting work. It MUST render message content as non-executable text and MUST NOT place message content, socket credentials, JWTs, or unredacted socket query strings in ordinary operational logs.

#### Scenario: Message exceeds the configured limit
- **WHEN** a client sends content exceeding the configured character or event-size limit
- **THEN** the system rejects the command without persisting or broadcasting it

#### Scenario: User exceeds the send rate
- **WHEN** a user exceeds the configured course-support message rate
- **THEN** the system rejects additional sends without creating messages

#### Scenario: Message contains markup
- **WHEN** a message contains HTML or script-like text
- **THEN** learner and staff interfaces display it as inert text rather than executable content

#### Scenario: Operational event is logged
- **WHEN** the system logs socket authentication, message delivery, recovery, or failure metadata
- **THEN** the log excludes message bodies, credentials, JWTs, and complete credential-bearing URLs

### Requirement: Course and staff chat interfaces
The learner interface SHALL place an `Ask a teacher` control above the existing course tutor control on shared course routes and provide accessible connection, history, send, pending, failure, and unread states. The staff interface SHALL provide a permission-gated inbox and responsive conversation thread for authorized teachers and academic managers.

#### Scenario: Eligible learner views a course
- **WHEN** an actively enrolled learner loads a course route
- **THEN** the learner sees `Ask a teacher` above the existing AI tutor launcher and can open the persisted human conversation

#### Scenario: Learner is not eligible to start support
- **WHEN** a learner loads a course without an accessible enrollment
- **THEN** the interface does not offer a usable support-chat launcher for that course

#### Scenario: Connection is interrupted
- **WHEN** an open chat loses its socket connection
- **THEN** the interface reports the non-live state, avoids falsely confirming unsaved messages, reconnects with bounded retry behavior, and reconciles missed history after recovery

#### Scenario: Authorized staff receives a new message
- **WHEN** a visible conversation receives a committed message
- **THEN** the staff inbox and any open thread update in real time without requiring a page reload

#### Scenario: Keyboard or assistive technology is used
- **WHEN** a learner or staff user operates the chat without a pointer or receives a new message
- **THEN** controls remain keyboard operable and status/message changes are announced through appropriate accessible semantics
