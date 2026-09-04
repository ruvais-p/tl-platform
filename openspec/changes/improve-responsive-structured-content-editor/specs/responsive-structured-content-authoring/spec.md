## Purpose

Enable curriculum authors to edit structured completion rules and flexible activity content safely and efficiently across narrow and wide viewports without losing forward-compatible JSON data.

## ADDED Requirements

### Requirement: Structured completion-rule authoring
The system SHALL present dedicated form controls for recognized chapter and activity completion-rule fields and SHALL produce API-compatible JSON objects from those controls.

#### Scenario: Author edits a chapter completion rule
- **WHEN** an author changes required-subtopic, case-study, learning-check, or pass-percentage controls
- **THEN** the system prepares the corresponding completion-rule keys and values for the chapter update

#### Scenario: Activity type has a recognized completion rule
- **WHEN** an author edits an activity whose type has recognized completion semantics
- **THEN** the system displays type-appropriate completion controls with the values from the stored rule

#### Scenario: Completion rule contains unsupported keys
- **WHEN** a stored completion rule contains keys that have no dedicated control
- **THEN** the system preserves those keys and makes them available through the advanced JSON editor

### Requirement: Flexible structured-content editing
The system SHALL let authors inspect and edit JSON objects, arrays, strings, numbers, booleans, and null values without requiring raw JSON syntax.

#### Scenario: Author edits nested content
- **WHEN** an author changes a primitive value inside a nested object or array
- **THEN** the resulting content retains the surrounding hierarchy and all unchanged values

#### Scenario: Author changes content structure
- **WHEN** an author adds, removes, or reorders an object property or array item
- **THEN** the structured editor displays and submits the resulting valid JSON structure

#### Scenario: Existing content contains unknown fields
- **WHEN** content includes fields not recognized by any specialized controls
- **THEN** loading, editing a recognized field, and saving SHALL preserve every unchanged unknown field and value

### Requirement: Advanced raw JSON fallback
The system SHALL provide an explicitly disclosed raw JSON editor for completion rules and activity content, synchronized with the structured representation after successful validation.

#### Scenario: Author opens advanced JSON
- **WHEN** an author expands the advanced JSON editor
- **THEN** the system displays the complete current structured value, including unsupported fields

#### Scenario: Author applies valid raw JSON
- **WHEN** an author supplies syntactically valid JSON of the required root type and applies it
- **THEN** the structured controls reflect the new value without discarding any fields

#### Scenario: Author supplies invalid raw JSON
- **WHEN** raw JSON contains a syntax error or has an invalid root type
- **THEN** the system identifies the error near the editor, retains the author's text, and does not replace the last valid structured value

### Requirement: Safe content submission
The system SHALL validate all locally editable activity and structured-content values before issuing any update request and SHALL distinguish complete success from partial server-side failure.

#### Scenario: Local structured content is invalid
- **WHEN** the author requests Save while any local completion rule or content value is invalid
- **THEN** the system sends no activity or activity-content mutation and focuses or identifies the invalid section

#### Scenario: Both activity and content updates succeed
- **WHEN** all local values are valid and both required API mutations succeed
- **THEN** the system reloads and displays the canonical saved activity and content

#### Scenario: Content update fails after activity update
- **WHEN** the activity update succeeds but its separate activity-content update fails
- **THEN** the system states that the activity fields were saved but the content was not, retains the attempted content, and offers a safe retry

### Requirement: Responsive structured authoring
The system SHALL keep structured fields, nested content, validation feedback, and editing actions usable without page-level horizontal overflow across narrow, medium, and wide viewports.

#### Scenario: Author edits content on a narrow viewport
- **WHEN** the inspector is displayed in a narrow viewport
- **THEN** fields and nested sections use a single-column flow, long values wrap or scroll within their own control, and the primary Save action remains readily reachable

#### Scenario: Author edits content on a wider viewport
- **WHEN** sufficient horizontal space is available
- **THEN** compatible primitive fields may use multiple columns while nested content retains enough width for readable editing

#### Scenario: Content has deeply nested sections
- **WHEN** an object or array would create excessive height or indentation
- **THEN** the author can expand and collapse sections without hiding validation state or losing edits

### Requirement: Accessible structured authoring
The system SHALL expose structured editing controls, disclosure state, validation, and collection actions with keyboard-operable controls and programmatic names.

#### Scenario: Author uses only a keyboard
- **WHEN** an author navigates, edits, adds, removes, reorders, expands, validates, and saves without a pointing device
- **THEN** every operation is reachable in a logical focus order and has a visible focus indicator and accessible name

#### Scenario: Validation fails
- **WHEN** a structured or raw JSON value cannot be accepted
- **THEN** the relevant control is programmatically associated with an actionable error message and the error is announced without discarding input
