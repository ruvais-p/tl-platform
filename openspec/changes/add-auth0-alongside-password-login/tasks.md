## 1. Dependencies and configuration

- [x] 1.1 Add the maintained Auth0 Next.js SDK and Python JWT/JWKS verification dependency with compatible pinned ranges, update both lock/dependency files, and verify clean dependency installation succeeds.
- [x] 1.2 Add typed server-only Auth0 configuration for enablement, issuer/domain, audience, client credentials, application base URL, application-session secret, and secure cookie behavior; verify tests cover disabled development, complete configuration, and fail-closed incomplete production configuration.
- [x] 1.3 Add Django Auth0 settings for enablement, canonical issuer, audience, accepted algorithm, JWKS caching, and request timeout; verify Django settings tests cover disabled and invalid enabled configurations.
- [x] 1.4 Document Auth0 application/API setup, exact callback and logout allowlists, asymmetric signing, trusted verified-email claim/profile requirements, and all environment variables; verify the documented local-password-only setup still works with Auth0 disabled.

## 2. Django external identity model

- [x] 2.1 Add the account-owned `Auth0Identity` model with user, canonical issuer, subject, email-at-link-time, created, and last-authenticated fields plus a unique issuer/subject constraint; verify model tests cover uniqueness and multiple identities linked to one user.
- [x] 2.2 Generate and review the additive accounts migration, then verify migration tests apply and reverse it without changing existing users, passwords, Groups, Moodle mappings, or sessions.
- [x] 2.3 Add safe administrative visibility for identity links without exposing tokens or secrets, and verify staff without appropriate account-management permission cannot enumerate or alter links.

## 3. Auth0 assertion verification and account linking

- [x] 3.1 Implement a server-side Auth0 assertion verifier that enforces issuer, audience, asymmetric algorithm, signature, expiry, subject, and trusted email provenance while using bounded JWKS caching and strict network timeouts; verify injected-key tests cover valid assertions, wrong issuer/audience/algorithm, expiry, missing claims, unknown key rotation, and JWKS failure.
- [x] 3.2 Implement canonical email normalization shared with Django user creation and verify tests cover whitespace, case, and legacy ambiguous-match handling.
- [x] 3.3 Implement transactional identity resolution that prefers issuer/subject, links an unlinked identity only to exactly one active user with verified normalized email, and never silently relinks on email change; verify service tests cover linked, first-link, changed-email, unknown, inactive, unverified, and conflicting identities.
- [x] 3.4 Enforce concurrency safety with row locking and database constraints, and verify transactional tests demonstrate that simultaneous first logins create one canonical link without cross-account association.
- [x] 3.5 Add structured security logging for verification, link, and denial reason categories with correlation identifiers, and verify log-capture tests confirm that assertions, authorization headers, secrets, and cookies are absent.
- [x] 3.6 Verify an active pre-provisioned `STUDENT` user with an unusable password can link and authenticate through Auth0 while local password authentication remains rejected.

## 4. Django exchange and shared admission

- [x] 4.1 Extract shared staff and learner portal-admission logic from the frontend-only gates into a canonical server-side service without changing the currently admitted Groups; verify unit tests cover superuser, every admitted staff Group, `STUDENT`, inactive users, wrong-portal users, and current teacher behavior.
- [x] 4.2 Add a throttled Auth0 exchange serializer and endpoint that accepts only the provider assertion and requested portal, validates and resolves the identity, applies admission, and returns the existing SimpleJWT pair plus canonical user context; verify API tests cover successful staff/learner exchange and all validation, linking, inactive, and role-denial cases.
- [x] 4.3 Mark issued platform tokens with a trustworthy authentication-method claim while preserving existing token fields and rotation behavior; verify password, Auth0, and Moodle issuance tests report the correct method without changing authorization claims.
- [x] 4.4 Return stable generic public errors for invalid assertions and unadmitted accounts while retaining operator-only reason categories, and verify API tests cannot distinguish unknown, inactive, unverified, or wrong-role email states from response detail.
- [x] 4.5 Update the existing local login path to use the same server-side portal-admission contract where applicable without changing its public token endpoint compatibility; verify current password login, refresh, blacklist, current-user, and Moodle exchange tests remain green.

## 5. Next.js Auth0 and continuation flow

- [x] 5.1 Configure the Auth0 server client and Next.js proxy integration with a matcher that preserves static assets and existing application/API routes; verify route tests cover mounted Auth0 routes and unaffected same-origin Django proxies.
- [x] 5.2 Implement a shared continuation validator for `staff` and `learner` destinations that rejects external URLs, protocol-relative paths, malformed encodings, and cross-workspace targets; verify unit tests cover safe paths and fixed `/dashboard` or `/learn` fallbacks.
- [x] 5.3 Add server-only Auth0 initiation helpers for both login pages that retain the requested portal and validated continuation through OAuth state; verify tests confirm client-controlled input cannot grant a role or escape the same-origin workspace.
- [x] 5.4 Add the OAuth completion route that obtains the Auth0 API assertion server-side, calls the Django exchange, writes the returned pair only to the requested portal cookie namespace, verifies canonical user context, and redirects safely; verify route tests cover staff, learner, wrong-role, unknown-account, missing-session, exchange-failure, and partial-cookie cleanup paths.
- [x] 5.5 Extend staff and learner session helpers with server-managed authentication-method context while keeping access and refresh values HTTP-only, secure in production, same-site, and unavailable to browser code; verify cookie tests cover local, Auth0, learner, staff, and simultaneous portal sessions.
- [x] 5.6 Ensure authentication callback and error responses never cache credentials or leak provider assertions through URLs, client JSON, logs, or error messages; verify security-focused route tests inspect headers, redirects, and serialized bodies.

## 6. Dual login and provider-aware logout UI

- [x] 6.1 Add an accessible “Continue with Auth0” action and visual separator to the staff login page while retaining the current email/password form, loading behavior, safe continuation, and errors; verify component tests exercise both methods with keyboard-accessible controls.
- [x] 6.2 Add the matching Auth0 action to the branded learner login page while retaining the current email/password and Moodle messaging; verify learner component tests cover both methods, `/learn` continuation constraints, responsive rendering, and accessibility.
- [x] 6.3 Add provider-aware staff and learner logout orchestration that always blacklists available Django refresh tokens and clears local cookies, invokes Auth0 logout only when an Auth0 application session exists, and uses allowlisted post-logout destinations; verify route tests cover local, Auth0, missing-token, expired-token, and upstream-failure outcomes.
- [x] 6.4 Clear both staff and learner platform cookie namespaces during Auth0-originated global logout while preserving portal-specific behavior for local-password logout; verify tests cover a browser holding both portal sessions.
- [x] 6.5 Update authentication providers and shells to handle redirects rather than assuming every logout is a 204 fetch response, and verify users return to the appropriate logged-out page without a stale authenticated UI.

## 7. Compatibility and release verification

- [x] 7.1 Run the complete Django test suite and migration drift/system checks with Auth0 disabled, and verify existing accounts, permissions, learners, curriculum, opportunities, Moodle, and SimpleJWT behavior remain passing.
- [x] 7.2 Run frontend unit tests, lint, TypeScript checking, and a production build with Auth0 disabled and with representative enabled configuration; verify no token or secret is included in client bundles or snapshots.
- [ ] 7.3 Perform an integration matrix against a non-production Auth0 tenant covering existing staff and learner accounts, first-time linking, repeat login, unverified and unknown email, inactive user, wrong portal, safe continuation, key rotation, local fallback, simultaneous sessions, and local/Auth0 logout; record observed results without credentials.
- [x] 7.4 Run migrations and the existing group/seed preflight from `run-platform.sh`, then verify the launcher still starts in local-password-only mode and reports actionable configuration errors when Auth0 is explicitly enabled but incomplete.
