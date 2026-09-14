## Purpose

Allow staff to target opportunities with understandable rules while ensuring visibility and application decisions are evaluated consistently and securely for each learner.

## ADDED Requirements

### Requirement: Audience and eligibility are separate controls
The system SHALL treat audience visibility and application eligibility as separate decisions. Staff SHALL choose an audience of all learners or selected student groups. Only learners in the configured audience may discover the opportunity; visible learners who do not satisfy eligibility rules SHALL be allowed to read the opportunity but SHALL NOT be allowed to apply.

#### Scenario: Learner is outside the selected audience
- **WHEN** an opportunity targets selected student groups and the learner belongs to none of them
- **THEN** the opportunity is absent from the catalog and its detail endpoint is unavailable to that learner

#### Scenario: Visible learner is not yet eligible
- **WHEN** a learner is in the opportunity audience but fails an eligibility condition
- **THEN** the learner can read the detail page, sees that they are not eligible with useful reasons, and cannot submit an application

### Requirement: Staff-friendly rule builder
The admin portal SHALL provide controls for adding, editing, reordering, and removing eligibility conditions without requiring staff to edit raw JSON. A rule set SHALL use a versioned format and a single top-level `ALL` or `ANY` match operator.

#### Scenario: Staff creates an all-conditions rule set
- **WHEN** staff selects `ALL` and adds group membership and minimum course progress conditions
- **THEN** the saved rule set requires both conditions to be true for the learner to be eligible

#### Scenario: Staff creates an any-condition rule set
- **WHEN** staff selects `ANY` and adds two student group conditions
- **THEN** membership in either configured group makes an audience-visible learner eligible

### Requirement: Supported learner facts
Eligibility conditions SHALL support student group membership, group grade, course enrollment status, course completion, minimum course progress percentage, and minimum best submitted learning-check score. Rule operands MUST reference existing compatible records and use operators valid for the selected fact.

#### Scenario: Learner meets course progress threshold
- **WHEN** a rule requires at least 80 percent progress in a course and the learner's server-recorded course progress is 85 percent
- **THEN** that condition evaluates true

#### Scenario: Learner fact is missing
- **WHEN** a rule depends on a course or assessment fact for which the learner has no record
- **THEN** that condition evaluates false without raising an application error

### Requirement: Rule validation and versioning
The system SHALL reject malformed rules, unknown rule versions, unsupported facts or operators, out-of-range thresholds, and references to missing or incompatible records. A saved valid rule set MUST round-trip through the editor without losing recognized or version metadata.

#### Scenario: Staff submits an unsupported rule
- **WHEN** a rule contains an unknown fact, unsupported operator, or threshold outside its allowed range
- **THEN** the system rejects the opportunity update and returns a field-specific rule validation error

### Requirement: Server-authoritative evaluation
The backend SHALL evaluate audience and eligibility using authenticated learner identity and server-owned facts. Learner requests MUST NOT be able to override identity, progress, score, group, or evaluation outcome through request data.

#### Scenario: Learner tampers with eligibility data
- **WHEN** a learner submits an application request containing fabricated group, progress, or eligibility values
- **THEN** the system ignores those values, evaluates current server records, and rejects the application if the learner is ineligible

### Requirement: Stable eligibility response
Catalog and detail responses SHALL include a stable eligibility result for the current learner consisting of eligibility state and learner-facing reason messages. A rule set with no conditions SHALL make every audience-visible learner eligible. Reason messages MUST describe unmet requirements without exposing another learner's data or internal-only configuration.

#### Scenario: Opportunity has no eligibility conditions
- **WHEN** an audience-visible learner requests an opportunity with an empty rule set
- **THEN** the response marks the learner eligible and contains no unmet-rule reasons

#### Scenario: Learner fails multiple all-conditions
- **WHEN** a learner fails more than one condition in an `ALL` rule set
- **THEN** the response identifies each unmet requirement in clear learner-facing language

### Requirement: Eligibility is rechecked when applying
Eligibility shown in a previously loaded page SHALL NOT be treated as authorization. The system MUST re-evaluate the latest opportunity, audience, learner facts, deadline, and lifecycle state atomically when accepting an application.

#### Scenario: Eligibility changes after page load
- **WHEN** a learner loads an eligible opportunity but becomes ineligible before submitting
- **THEN** the application is rejected with a current eligibility explanation and no application record is created
