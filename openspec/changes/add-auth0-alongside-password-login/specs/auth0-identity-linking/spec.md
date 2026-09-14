## Purpose

Resolve Auth0 identities to durable, pre-authorized Django accounts without duplicating users, trusting unverified email addresses, or moving admission and authorization policy into Auth0.

## ADDED Requirements

### Requirement: Auth0 assertions are cryptographically validated
The system MUST validate each Auth0 assertion server-side against the configured issuer, audience, signature keys, expiry, and required token claims before using any identity information.

#### Scenario: Valid Auth0 assertion
- **WHEN** an assertion has an accepted issuer and audience, a valid signature, is within its validity period, and includes the required subject claims
- **THEN** the system proceeds to resolve the corresponding Django account

#### Scenario: Invalid Auth0 assertion
- **WHEN** an assertion has an invalid signature, wrong issuer or audience, expired validity, missing subject, or unsupported algorithm
- **THEN** the system rejects the exchange without creating an identity link or platform session

### Requirement: Existing identity links use stable provider identifiers
The system SHALL identify a previously linked Auth0 account using the Auth0 issuer and subject rather than email, and SHALL enforce uniqueness of that provider identity.

#### Scenario: Linked identity returns with the same email
- **WHEN** a valid Auth0 identity matches an existing issuer-and-subject link
- **THEN** the system resolves the linked Django user

#### Scenario: Linked identity email changes
- **WHEN** a valid Auth0 identity matches an existing issuer-and-subject link but supplies a different email
- **THEN** the system keeps the existing user association and does not automatically relink the identity to another Django account

#### Scenario: Provider identity is already linked
- **WHEN** an operation would associate one issuer-and-subject pair with a second Django user
- **THEN** the system rejects the conflicting association and leaves both accounts unchanged

### Requirement: First-time Auth0 linking requires a verified admitted email
The system SHALL create an initial Auth0 identity link only when a cryptographically trusted Auth0 profile supplies a verified email matching exactly one pre-existing active Django user after canonical normalization.

#### Scenario: Verified email matches an active user
- **WHEN** an unlinked Auth0 identity supplies a verified email that matches exactly one active Django user
- **THEN** the system atomically records the issuer-and-subject link and continues with workspace-admission checks for that user

#### Scenario: Email is unverified
- **WHEN** an unlinked Auth0 identity supplies an email that Auth0 has not verified
- **THEN** the system denies linking and creates neither an identity association nor a platform session

#### Scenario: Email is unknown
- **WHEN** an unlinked Auth0 identity's verified normalized email does not match a Django user
- **THEN** the system denies admission without automatically creating a Django user or disclosing whether the email was pre-provisioned

#### Scenario: Matched user is inactive
- **WHEN** an unlinked Auth0 identity's verified normalized email matches an inactive Django user
- **THEN** the system denies linking and creates no platform session

### Requirement: Linking is atomic and concurrency-safe
The system SHALL make account resolution and first-time identity linking atomic so concurrent exchanges cannot create duplicate or cross-account associations.

#### Scenario: Concurrent first logins use the same identity
- **WHEN** two valid exchanges for the same previously unlinked issuer-and-subject are processed concurrently
- **THEN** both resolve to one canonical identity link and one Django user or one request fails safely without duplicate records

#### Scenario: Concurrent conflicting links occur
- **WHEN** concurrent exchanges attempt to link the same provider identity to different local accounts
- **THEN** database constraints prevent the conflict and no partial association is committed

### Requirement: Current Django account state is enforced on every session establishment
The system SHALL re-evaluate `is_active`, workspace eligibility, Groups, superuser state, and effective permissions from Django when establishing a platform session, including for previously linked identities.

#### Scenario: Linked user is deactivated
- **WHEN** a previously linked Auth0 identity authenticates after its Django user has been deactivated
- **THEN** the system denies a new platform session even though Auth0 authentication succeeded

#### Scenario: Linked user's role changes
- **WHEN** a previously linked user's Django Groups or permissions change
- **THEN** the next session establishment uses the updated authorization state without requiring Auth0 metadata changes

### Requirement: Auth0-only pre-provisioned accounts are supported
The system SHALL allow a pre-existing active Django user with an unusable local password to authenticate through a verified and linked Auth0 identity while continuing to reject local password authentication for that account.

#### Scenario: Pre-provisioned student uses Auth0
- **WHEN** a student was created without a usable local password and presents a valid Auth0 identity with the same verified normalized email
- **THEN** the system links the identity and admits the student to the learner workspace when the Django role permits it

#### Scenario: Pre-provisioned student attempts local login
- **WHEN** a student with an unusable local password submits local login credentials
- **THEN** the system rejects local authentication without affecting the student's ability to use Auth0

### Requirement: Authentication outcomes are auditable without exposing secrets
The system SHALL record security-relevant Auth0 exchange and identity-linking outcomes without storing raw tokens, secrets, or unnecessary identity-provider profile data.

#### Scenario: Identity link succeeds
- **WHEN** a new Auth0 identity link is committed
- **THEN** the system records the provider, local user, outcome, and timestamp without recording bearer credentials

#### Scenario: Identity resolution is denied
- **WHEN** a valid or invalid Auth0 exchange is denied
- **THEN** the system records a suitable reason category for operators while returning a generic response that does not enable account enumeration
