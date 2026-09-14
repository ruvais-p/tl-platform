## Purpose

Provide staff and learners with a choice of Auth0 or local email-and-password authentication while preserving consistent Django-owned sessions, permissions, and workspace admission rules.

## ADDED Requirements

### Requirement: Both authentication methods remain available
The system SHALL offer Auth0 sign-in and local email-and-password sign-in on both the staff and learner login experiences.

#### Scenario: Staff chooses local credentials
- **WHEN** a staff user submits valid local email and password credentials
- **THEN** the system authenticates the user through Django and continues to the requested authorized staff location

#### Scenario: Learner chooses Auth0
- **WHEN** a learner selects Auth0 sign-in and Auth0 authenticates the identity successfully
- **THEN** the system completes platform admission and continues to the requested authorized learner location

#### Scenario: Auth0 is unavailable
- **WHEN** Auth0 sign-in cannot be completed because the provider is unavailable
- **THEN** the local email-and-password form remains usable and the system displays an actionable Auth0 failure without disabling local authentication

### Requirement: Authentication methods produce a consistent platform session
The system SHALL establish the same Django user identity, effective permissions, token lifetime behavior, and API authorization contract after either supported authentication method.

#### Scenario: Local login establishes a session
- **WHEN** a user passes local credential and workspace-admission checks
- **THEN** the system stores the platform session in HTTP-only cookies and browser code does not receive reusable platform credentials

#### Scenario: Auth0 login establishes a session
- **WHEN** a user passes Auth0 identity and workspace-admission checks
- **THEN** the system stores a platform session with the same API contract and cookie protections as a local login

#### Scenario: Access token expires
- **WHEN** an authenticated request uses an expired platform access token and its session remains renewable
- **THEN** the system renews the platform session without changing the authenticated Django user or authentication method

### Requirement: Django controls workspace admission
The system SHALL apply the existing Django user state, Groups, superuser state, and effective permissions after authentication and SHALL NOT use Auth0 roles as the source of platform authorization.

#### Scenario: Student enters the learner workspace
- **WHEN** an active authenticated user belongs to the `STUDENT` Django Group and requests the learner workspace
- **THEN** the system grants learner admission subject to endpoint-specific Django permissions and enrollment rules

#### Scenario: Student enters the staff workspace
- **WHEN** an authenticated user has only the `STUDENT` Django Group and requests the staff workspace
- **THEN** the system denies staff admission and creates no staff session

#### Scenario: Existing authorized staff member enters the staff workspace
- **WHEN** an active authenticated user is a superuser or belongs to a Django Group currently admitted to the staff workspace
- **THEN** the system grants staff admission and exposes only capabilities allowed by that user's effective Django permissions

#### Scenario: Authenticated user lacks portal eligibility
- **WHEN** either authentication method proves identity but the Django user is not eligible for the requested workspace
- **THEN** the system denies admission, clears any partial platform session, and returns a non-enumerating access-denied response

### Requirement: Portal continuation is constrained
The system SHALL preserve the intended staff or learner destination through authentication and SHALL redirect only to a safe same-origin path within the admitted workspace.

#### Scenario: Valid learner continuation
- **WHEN** learner authentication starts with a continuation path under `/learn`
- **THEN** successful learner admission returns the user to that path

#### Scenario: Invalid continuation target
- **WHEN** an authentication request contains an external, malformed, or cross-workspace continuation target
- **THEN** the system ignores it and redirects to the default home of the admitted workspace

### Requirement: Logout respects the authentication provider
The system SHALL revoke or clear all platform credentials for every logout and SHALL also terminate the Auth0 application session when the current platform session originated from Auth0.

#### Scenario: Local user logs out
- **WHEN** a locally authenticated user logs out
- **THEN** the system revokes the renewable platform token, clears the workspace cookies, and returns the user to the corresponding login page

#### Scenario: Auth0 user logs out
- **WHEN** an Auth0-authenticated user logs out
- **THEN** the system revokes the renewable platform token, clears the workspace cookies, terminates the Auth0 application session, and returns the user to an allowed logged-out location

#### Scenario: Upstream Auth0 logout fails
- **WHEN** the platform cannot complete upstream Auth0 logout
- **THEN** local platform credentials remain cleared and the user receives a safe retry or explanatory outcome

### Requirement: Existing authentication integrations remain compatible
The system SHALL preserve existing password users, current staff and learner API behavior, and the signed Moodle learner exchange while Auth0 is introduced.

#### Scenario: Existing password user signs in after deployment
- **WHEN** an existing active user submits the same valid local credentials used before the change
- **THEN** the system authenticates the account without requiring an Auth0 identity

#### Scenario: Learner arrives through Moodle
- **WHEN** a valid signed Moodle exchange request is received
- **THEN** the system continues to establish the learner session according to the existing Moodle exchange rules
