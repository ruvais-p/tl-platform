## Purpose

Enable learners to apply safely for opportunities and provide authorized staff with a traceable workflow for reviewing and progressing every internal application.

## ADDED Requirements

### Requirement: Configurable application mode
Every published opportunity SHALL use either `INTERNAL` or `EXTERNAL` application mode. Internal mode SHALL submit an application within the platform. External mode SHALL clearly disclose that the learner is continuing to the company's HTTPS site and MUST NOT claim that an application was submitted or track an application status inside the platform.

#### Scenario: Learner follows an external application
- **WHEN** an eligible learner activates Apply on an external opportunity
- **THEN** the system presents the external destination clearly and opens the configured HTTPS URL without creating an internal application record

### Requirement: Internal application form
For an internal opportunity, the system SHALL prefill the authenticated learner's name and email and collect a contact phone number, cover note, and resume according to the opportunity configuration. Staff SHALL be able to require or omit the cover note and resume; required fields MUST be validated before submission.

#### Scenario: Required resume is missing
- **WHEN** a learner submits an internal application for an opportunity that requires a resume without attaching one
- **THEN** the system rejects the submission and identifies the resume requirement

#### Scenario: Valid internal application is submitted
- **WHEN** an eligible learner submits all required application information for an open internal opportunity
- **THEN** the system creates a submitted application, records the submission time and contact snapshot, and shows a confirmation

### Requirement: Private resume handling
Application resumes SHALL be stored as private applicant documents rather than public media assets. The system MUST enforce configured file-size and MIME-type limits, use non-guessable storage identifiers, and authorize every download so that only the applicant and staff with application review permission can access the file.

#### Scenario: Unauthorized user requests a resume
- **WHEN** a user other than the applicant or an authorized reviewer requests an application resume
- **THEN** the system denies the request without revealing file metadata or a public storage URL

#### Scenario: Learner uploads an unsupported file
- **WHEN** a learner uploads a file outside the accepted resume types or size limit
- **THEN** the system rejects the file with a clear validation message and creates no application

### Requirement: Submission integrity
The system SHALL permit no more than one application per learner and opportunity. It MUST reject new submissions for opportunities that are unpublished, closed, archived, expired, outside the learner's audience, or currently ineligible. Duplicate and rejected submissions MUST NOT create partial application or document records.

#### Scenario: Learner submits twice
- **WHEN** a learner who already has an application submits another application for the same opportunity
- **THEN** the system returns the existing-application conflict and does not create a duplicate

#### Scenario: Deadline passes during submission
- **WHEN** the application deadline has passed by the time the server processes the request
- **THEN** the system rejects the application and creates neither an application nor an orphaned resume

### Requirement: Application status lifecycle
An internal application SHALL have one of `SUBMITTED`, `UNDER_REVIEW`, `SHORTLISTED`, `ACCEPTED`, `REJECTED`, or `WITHDRAWN` as its status. Authorized staff SHALL transition active applications through review outcomes, while the learner SHALL be able to withdraw a submitted, under-review, or shortlisted application. Accepted, rejected, and withdrawn applications SHALL be terminal.

#### Scenario: Staff shortlists an application
- **WHEN** an authorized reviewer changes a submitted or under-review application to shortlisted
- **THEN** the new status and review timestamp are recorded and visible to the applicant

#### Scenario: Learner withdraws an active application
- **WHEN** the applicant withdraws a submitted, under-review, or shortlisted application
- **THEN** its status becomes withdrawn and staff can no longer move it to another status

#### Scenario: Invalid terminal transition is attempted
- **WHEN** staff or learner attempts to transition an accepted, rejected, or withdrawn application
- **THEN** the system rejects the transition and preserves the terminal status

### Requirement: Learner application history
The learner portal SHALL provide an authenticated application history showing each internal application's opportunity, company, submission date, current status, and link to the corresponding opportunity detail. Learners MUST see only their own applications.

#### Scenario: Learner views application history
- **WHEN** a learner opens `/learn/applications`
- **THEN** the system lists only that learner's internal applications with current statuses and opportunity links

### Requirement: Staff applicant review
Authorized staff SHALL be able to open an opportunity's applicant view, search and filter applications by status, inspect submitted contact information, cover notes, and authorized resume downloads, record private review notes, and perform valid status transitions. Private review notes MUST never be returned through learner APIs.

#### Scenario: Reviewer filters shortlisted applicants
- **WHEN** an authorized reviewer selects the shortlisted status filter
- **THEN** the system displays only shortlisted applications for that opportunity

#### Scenario: Learner requests staff review notes
- **WHEN** a learner requests their application through a learner endpoint
- **THEN** the response excludes private staff notes and reviewer-only metadata

### Requirement: Application permissions and audit fields
Application listing, review, document download, and status changes SHALL require explicit application permissions. Each application SHALL retain created and updated timestamps, the actor and time of the latest staff review, and immutable applicant identity even if profile fields later change.

#### Scenario: Staff without review permission opens applicants
- **WHEN** a staff member lacking application view permission requests an applicant list or application document
- **THEN** the system denies access and returns no applicant data
