## Purpose

Provide staff with a complete, governed opportunity catalog and give learners a structured, searchable experience for evaluating each available opportunity.

## ADDED Requirements

### Requirement: Dedicated opportunity administration
The system SHALL provide a dedicated Opportunities workspace in the admin portal for authorized staff to list, search, filter, create, preview, edit, publish, close, and archive opportunities. View, create, and change actions MUST be protected by explicit model permissions, and the normal administrator role MUST receive the permissions required to manage opportunities.

#### Scenario: Authorized administrator opens the workspace
- **WHEN** an administrator with opportunity view permission opens the Opportunities navigation item
- **THEN** the system displays the opportunity workspace with records and actions limited by that administrator's create and change permissions

#### Scenario: Unauthorized staff member attempts access
- **WHEN** a staff member without opportunity view permission requests the workspace or its API
- **THEN** the system denies access without disclosing opportunity administration data

### Requirement: Structured opportunity authoring
The system SHALL capture a title, company name, short summary, Markdown description, employment type, workplace mode, lifecycle status, and application mode for every opportunity. It SHALL also support a company logo, company website, openings, physical location, remote applicant region, compensation disclosure, currency, compensation range, pay period, start date, duration, application deadline, and featured flag.

Employment type MUST be one of `INTERNSHIP`, `FULL_TIME`, `PART_TIME`, `CONTRACT`, `APPRENTICESHIP`, or `PROJECT`. Workplace mode MUST be one of `REMOTE`, `HYBRID`, or `IN_OFFICE`; these values MUST be stored independently.

#### Scenario: Administrator creates a valid opportunity
- **WHEN** an authorized administrator submits all required fields with valid conditional fields
- **THEN** the system saves the opportunity as a draft and makes it available for preview

#### Scenario: Administrator mixes workplace and employment concepts
- **WHEN** an administrator submits `REMOTE` as an employment type or `INTERNSHIP` as a workplace mode
- **THEN** the system rejects the invalid value and identifies the affected field

### Requirement: Conditional form validation
The system SHALL validate opportunity fields according to their meaning. Hybrid and in-office opportunities MUST include a physical location; remote opportunities MUST state the permitted applicant region. A disclosed paid compensation range MUST include a valid ISO currency and pay period, and its maximum MUST NOT be lower than its minimum. External application mode MUST include a valid HTTPS application URL.

#### Scenario: Paid range is internally inconsistent
- **WHEN** an administrator enters a maximum compensation below the minimum
- **THEN** the system rejects publication and explains that the range is invalid

#### Scenario: External application URL is absent
- **WHEN** an administrator selects external application mode without an HTTPS application URL
- **THEN** the system rejects publication and identifies the missing application URL

### Requirement: Safe Markdown description
The system SHALL store the authored opportunity description as Markdown and render headings, paragraphs, lists, links, emphasis, and code using the same safe renderer in staff preview and learner detail views. Raw HTML, executable content, and unsafe URL schemes MUST NOT be rendered.

#### Scenario: Description contains unsafe HTML
- **WHEN** a description includes a script element, event handler, or unsafe URL scheme
- **THEN** the preview and learner detail render the safe Markdown content without executing or exposing the unsafe content

### Requirement: Valid company logo presentation
The system SHALL allow staff to select or upload a ready image media asset as the company logo. Non-image or unavailable assets MUST be rejected, and learner views SHALL display a deterministic company-initial fallback when no logo is configured or the image cannot load.

#### Scenario: Staff selects a document as a logo
- **WHEN** an administrator selects a media asset that is not a ready image
- **THEN** the system rejects that asset as the company logo

### Requirement: Opportunity lifecycle and open state
Each opportunity SHALL have one of `DRAFT`, `PUBLISHED`, `CLOSED`, or `ARCHIVED` as its lifecycle status. Only a complete and valid opportunity may be published. An opportunity SHALL be open to new applications only while published and before its deadline, when a deadline exists; closing or archiving it MUST immediately prevent new applications.

#### Scenario: Published opportunity reaches its deadline
- **WHEN** the current time is later than a published opportunity's application deadline
- **THEN** the learner experience marks the opportunity closed and does not permit a new application

#### Scenario: Staff closes an opportunity manually
- **WHEN** authorized staff changes a published opportunity to closed
- **THEN** it is removed from the open catalog and new applications are rejected

### Requirement: Learner opportunity catalog
The learner portal SHALL display open, published opportunities that are visible to the authenticated learner. The catalog SHALL support text search and filtering by employment type and workplace mode, and each card SHALL present the company, logo or fallback, title, employment type, workplace mode, location or remote region, compensation disclosure, deadline, and eligibility state.

#### Scenario: Learner filters remote internships
- **WHEN** a learner selects employment type Internship and workplace mode Remote
- **THEN** the catalog displays only visible opportunities matching both filters

#### Scenario: No visible opportunities match
- **WHEN** no visible opportunity matches the learner's search and filters
- **THEN** the system displays a useful empty state and allows the learner to clear the filters

### Requirement: Individual opportunity detail
The learner portal SHALL provide `/learn/opportunities/[opportunityId]` as the canonical detail route for a visible opportunity. It SHALL render all relevant structured fields, the safe Markdown description, eligibility result, deadline/open state, and the correct internal or external application action. A learner with an existing application SHALL retain access to the corresponding opportunity detail after it closes.

#### Scenario: Learner explores an opportunity
- **WHEN** a learner selects a visible opportunity card
- **THEN** the system opens that opportunity's detail route without sending the learner directly to an external site

#### Scenario: Learner requests a non-visible opportunity
- **WHEN** a learner requests an opportunity outside their audience and has no existing application for it
- **THEN** the system responds as though the opportunity is unavailable

### Requirement: Legacy opportunity preservation
Existing opportunity records SHALL remain available after deployment. Legacy `summary`, `url`, `kind`, and `is_published` data MUST be mapped into the expanded fields without silently publishing previously unpublished records or losing external application links.

#### Scenario: Existing published internship is migrated
- **WHEN** a published legacy record with kind `internship` and an external URL is migrated
- **THEN** it remains published as an internship using external application mode with its summary and URL preserved
