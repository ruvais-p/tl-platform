## Why

The platform currently requires Django-managed email and password credentials for both staff and learners, which prevents institutions from using an external identity provider and makes future pre-provisioning workflows depend on distributing local passwords. Adding Auth0 as an optional sign-in method while retaining local credentials gives institutions an SSO path without removing the existing fallback or moving authorization data out of Django.

## What Changes

- Add Auth0 Universal Login as an alternative to the existing email-and-password forms for both the staff and learner workspaces.
- Preserve the current Django email/password login, token rotation, and portal-specific authorization behavior.
- Validate Auth0 identities server-side and exchange an accepted Auth0 identity for the same Django JWT session contract used by local login.
- Link Auth0 identities to existing Django users using the stable Auth0 issuer and subject, with verified normalized email used only for the initial link.
- Reject unknown, inactive, unverified, or portal-ineligible Auth0 identities without automatically creating or elevating users.
- Keep Django Groups and effective permissions authoritative for staff and learner access regardless of authentication method.
- Make logout provider-aware so local tokens are revoked and an Auth0-authenticated user also exits the Auth0 application session.
- Permit pre-provisioned users with unusable local passwords to authenticate through Auth0, establishing a safe foundation for a future CSV student and group import workflow.
- Preserve the existing Moodle exchange as an independent learner authentication path; replacing it is outside this change.

## Capabilities

### New Capabilities

- `dual-workspace-authentication`: Alternative Auth0 and local-password sign-in, unified Django sessions, portal admission, session renewal, and provider-aware logout for staff and learners.
- `auth0-identity-linking`: Secure resolution and durable linking of verified Auth0 identities to pre-existing Django users, including inactive, unknown, conflicting, and pre-provisioned account behavior.

### Modified Capabilities

None.

## Impact

- **Next.js frontend:** staff and learner sign-in experiences, Auth0 callback/logout routes, server-side session helpers, authenticated proxy behavior, environment validation, and authentication tests under `admin-platform/`.
- **Django backend:** Auth0 token verification and exchange endpoints, external identity persistence, account resolution services, serializers, migrations, settings, and authentication tests under `tella_backend/accounts/`.
- **Dependencies and configuration:** Auth0 Next.js SDK, a maintained Python JWT/JWKS validation library, Auth0 tenant/application/API configuration, callback/logout URL allowlists, issuer, audience, client credentials, and secure application-session secrets.
- **Authorization:** no role or permission migration; Django users, Groups, `is_active`, superuser state, and effective permissions remain the source of truth.
- **Compatibility:** existing local login, refresh/logout endpoints, HTTP-only platform token cookies, current staff and learner eligibility rules, and Moodle exchange remain available.
- **Future provisioning:** CSV parsing, bulk student creation, group membership import, Auth0 Management API user creation, and invitation delivery are explicitly deferred.
