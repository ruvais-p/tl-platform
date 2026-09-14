## Context

See `proposal.md` for motivation. Django currently authenticates email/password credentials with SimpleJWT and remains the source of user state, Groups, and effective permissions. The Next.js application acts as a backend-for-frontend: it stores separate staff and learner access/refresh pairs in HTTP-only cookies, refreshes them server-side, and exposes narrow same-origin proxies to browser code. Staff admission is currently restricted to superusers and the existing admitted staff Groups; learner admission requires `STUDENT`. A signed Moodle exchange separately creates learner JWTs.

Auth0 must be additive. A successful Auth0 login cannot by itself authorize platform access, create a Django user, assign a role, or choose a portal. Pre-existing Django users, including future accounts created without usable passwords, are the admission directory. The integration spans external configuration, Next.js OAuth session handling, Django identity resolution, token issuance, logout, and migrations, so an explicit cross-service design is required.

## Goals / Non-Goals

**Goals:**

- Make Auth0 and local credentials converge on the current Django user, permission, and SimpleJWT API contract.
- Preserve the browser-to-Next.js credential boundary and the separate staff and learner cookie namespaces.
- Link external identities once using verified email, then use stable Auth0 issuer-and-subject identifiers.
- Fail closed for invalid identity assertions, unknown users, inactive users, conflicting links, unsafe continuation paths, and incorrect portal roles.
- Keep Auth0 configuration explicit and fail startup or authentication clearly when required production values are absent.
- Keep the account model compatible with future passwordless pre-provisioning by CSV.

**Non-Goals:**

- Implement CSV upload, bulk account/group creation, invitations, or Auth0 Management API provisioning.
- Move Django Groups or object/domain authorization into Auth0 roles, permissions, or metadata.
- Remove local passwords, migrate password hashes to Auth0, or force existing users to link an external identity.
- Replace the Moodle exchange or redesign the staff/learner authorization policy.
- Add social-provider-specific account linking or allow end users to merge accounts manually.

## Decisions

### 1. Use Auth0 as an identity proof and exchange it for existing Django tokens

The Next.js application will use the current Auth0 Next.js SDK and Authorization Code flow to establish an encrypted Auth0 application session. After the Auth0 callback, a server-only completion route obtains an Auth0 access token for the configured platform API audience and sends it to a new Django exchange endpoint. Django validates the token, resolves the local user, checks account state, and issues the same rotating SimpleJWT access/refresh pair as local login.

The Auth0 access token must use asymmetric signing. Django validates the exact issuer and audience, restricts accepted algorithms, validates time and subject claims, and resolves signing keys through the tenant JWKS with bounded caching and key-rotation refresh. Email and verification status must come from token claims added by trusted tenant configuration or from Auth0's signed/authorized user-profile response; request-body profile fields are never trusted.

This approach is preferred over teaching every DRF endpoint to support two bearer-token formats because the existing proxies, permission classes, refresh rotation, tests, and Moodle exchange can continue using one platform token contract. Directly accepting Auth0 access tokens is a possible later simplification, but would enlarge this migration and leave local sessions with a separate authentication path anyway. A custom Auth0 database connection backed by Django is rejected because it would keep password validation in the platform while adding remote credential scripts.

### 2. Complete Auth0 login through a portal-aware server route

Both `/login` and `/learn/login` retain their local forms and add a normal navigation link to Auth0 Universal Login. Authentication initiation carries a validated application continuation describing `portal=staff|learner` and a same-origin destination. The SDK callback establishes the Auth0 application session and returns to a server-only completion route, which performs the Django exchange, stores the returned pair in the requested portal's existing cookie namespace, calls the canonical current-user endpoint, and applies the same portal gate as local login.

Only relative paths under the requested workspace are accepted: staff destinations must match staff application routes and learner destinations must remain under `/learn`. Invalid or external destinations fall back to `/dashboard` or `/learn`. Portal input affects only the destination and cookie namespace; it never grants a Django role. Failed exchange or admission clears any partially created platform cookies and redirects to a dedicated login error state with a generic message.

Using a completion route instead of duplicating OAuth callback handling in the two login screens keeps secrets and tokens server-only. Keeping the current cookie namespaces avoids widening learner proxy access into staff APIs and preserves existing simultaneous-session behavior.

### 3. Add an account-owned Auth0 identity mapping

Add an `Auth0Identity` model in the accounts domain with a UUID primary key, user foreign key, canonical issuer, subject, email-at-link-time, created timestamp, and last-authenticated timestamp. A database uniqueness constraint on `(issuer, subject)` makes the provider identity canonical. Multiple provider identities may link to one Django user so institutions can change Auth0 connections without duplicating the domain account, but an identity can never link to multiple users.

This model is separate from `students.ExternalUserMapping`: the latter represents LMS/application identifiers such as Moodle and Canvas, while Auth0 is an account authentication identity used by both staff and learners. Raw ID/access tokens, refresh tokens, tenant secrets, and full provider profiles are not persisted.

Adding `AUTH0` to the student-domain provider enum was rejected because it would couple staff authentication to student/LMS functionality and make account deletion and auditing ambiguous.

### 4. Resolve a first login by verified normalized email, then only by issuer and subject

Identity resolution runs in a database transaction:

1. Look up `(issuer, subject)` and lock an existing mapping when found.
2. If linked, use its user association, require the user to remain active, update only authentication metadata such as `last_authenticated_at`, and do not silently change the local email or association.
3. If unlinked, require a trusted `email_verified=true` value and normalize the email using the same canonical policy as Django account creation.
4. Lock and resolve exactly one pre-existing user by canonical email, require it to be active, then create the mapping.
5. Treat uniqueness races as either the same canonical link or a safe conflict; never partially link or create a user.

Email is deliberately a bootstrap identifier rather than the durable key because identity-provider email addresses can change. Unknown email, inactive user, unverified email, ambiguous legacy email, and conflicting mapping responses use a common public denial message. Structured server logs record reason categories and correlation identifiers without tokens or unnecessary profile data.

Automatic just-in-time user creation was rejected because anyone able to authenticate in the Auth0 tenant could otherwise enter the local user population, and the platform would lack an authoritative role, institution, and student-group assignment. Future CSV import will create Django users and membership first; those users may have unusable passwords and link Auth0 on first login.

### 5. Keep Django authorization and current portal gates unchanged

After either login method, Django remains authoritative for `is_active`, superuser state, Groups, and effective permissions. The current learner rule (`STUDENT`) and admitted staff Group/superuser rule are shared by local and Auth0 completion code rather than maintained as separate lists in multiple routes. Auth0 roles, organization membership, and metadata are not translated into Django permissions in this change.

The shared admission result should expose whether a user can enter the requested portal and return the canonical user payload. Endpoint-level Django permission checks remain mandatory; frontend checks continue to control affordances only.

Teacher admission and mixed staff/student role policy are intentionally preserved as they behave before this change. Altering either would be an authorization-policy change and should be specified separately.

### 6. Retain platform refresh tokens and make logout provider-aware

Local and Auth0 login both produce the current short-lived access and rotating refresh tokens. Auth0-originated completion records the method in server-managed session metadata so logout can distinguish it without trusting client input. Logout first blacklists available Django refresh tokens and clears local cookies. For an Auth0-originated session it then uses the SDK logout flow with an allowlisted post-logout destination to clear the Auth0 application/tenant session.

If Auth0 logout is unavailable, local cookies remain cleared and Django refresh revocation is not rolled back. Auth0 logout clears both platform portal cookie sets to avoid leaving another locally minted session active behind a global Auth0 sign-out; local-password logout preserves the current portal-specific behavior.

The Auth0 SDK session and the platform JWT session intentionally coexist for Auth0 users in this design. This is the cost of retaining one downstream Django token format. Tokens retain current lifetimes initially; no token is placed in browser-readable storage.

### 7. Isolate configuration and keep development deterministic

Next.js configuration includes Auth0 domain/issuer, application client ID and secret, application session secret, base URL, API audience, and allowed callback/logout origins. Django receives issuer, audience, JWKS/cache configuration, and an explicit enable flag. Production fails closed when Auth0 is enabled but required values are absent. Development and tests can leave Auth0 disabled while local and Moodle authentication continue to work.

Remote JWKS calls use strict timeouts, bounded caching, and a single refresh attempt for an unknown key ID. Unit tests use injected/static keys and never contact Auth0. Logs redact bearer tokens, authorization codes, client secrets, and cookies.

## Risks / Trade-offs

- **[Auth0 and Django sessions can diverge]** -> Keep platform access tokens short-lived, require Django `is_active` on authenticated requests, revoke refresh tokens on explicit logout, and document that upstream Auth0 deactivation does not itself mutate Django authorization.
- **[Email-based first linking can attach the wrong account]** -> Require Auth0-verified email, normalize consistently, link only to exactly one existing active account, enforce provider-identity uniqueness, and never relink automatically after the first association.
- **[A permissive Auth0 tenant could authenticate outsiders]** -> Treat successful Auth0 authentication only as identity proof; require pre-provisioned Django admission and return generic denials for unknown users.
- **[Duplicate admission rules can drift]** -> Centralize portal admission in Django-facing/shared server helpers and apply it after both local and Auth0 authentication.
- **[JWKS outage can block new exchanges]** -> Cache validated signing keys with bounded lifetime, refresh only when needed, and leave local password login operational.
- **[Global Auth0 logout affects both portals]** -> Clear both platform cookie namespaces for Auth0-originated logout and use an explicit, documented post-logout destination.
- **[OAuth continuation can become an open redirect]** -> Accept only normalized relative paths within the selected workspace and fall back to fixed defaults.
- **[Two login methods increase security surface]** -> Retain existing password throttling and validation, throttle exchanges, use Authorization Code flow through the maintained SDK, and add negative tests for token validation, linking, role gates, redirects, cookie exposure, and logout.

## Migration Plan

1. Register the Auth0 regular web application and platform API, configure exact development/production callback and logout URLs, use asymmetric token signing, and arrange trusted verified-email claims or profile lookup.
2. Deploy the additive Django identity model, verification/exchange service, endpoint, configuration, and tests with Auth0 disabled; run migrations and verify local and Moodle authentication unchanged.
3. Deploy the Next.js Auth0 SDK integration, completion/logout flow, environment checks, dual login controls, and tests while keeping the Auth0 control hidden until configuration is enabled.
4. Enable Auth0 in a non-production environment and verify existing staff, learners, inactive accounts, unknown emails, role mismatches, both portal continuations, key rotation, logout, and local fallback.
5. Enable Auth0 in production without migrating existing passwords or requiring immediate identity links. Monitor categorized exchange denials and linking events without collecting tokens.

Rollback disables Auth0 initiation in Next.js and the Django exchange endpoint while leaving local login, Moodle exchange, platform JWTs, users, and permissions intact. Existing identity mapping rows are harmless and retained for a later re-enable; the additive migration need not be reversed during an application rollback.
