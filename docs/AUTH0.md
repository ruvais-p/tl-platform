# Auth0 alongside email/password authentication

Auth0 is optional and additive. When `AUTH0_ENABLED=false` (the default), staff and learners continue to use the existing email/password forms, and Moodle login is unchanged. Enabling Auth0 adds a second button to each login page; it does not disable local passwords or move roles and permissions out of Django.

## Auth0 tenant setup

Create one **Regular Web Application** for the Next.js server and one Auth0 **API** for the Django exchange. Configure the API to sign access tokens with **RS256**. Use the same API identifier as `AUTH0_AUDIENCE` in both applications.

For local development, configure the Regular Web Application with these exact entries:

- Allowed Callback URLs: `http://localhost:3000/auth/callback`
- Allowed Logout URLs: `http://localhost:3000/login`, `http://localhost:3000/learn/login`
- Allowed Web Origins: `http://localhost:3000`

Add the corresponding exact HTTPS URLs for each deployed environment. Do not use wildcard callbacks or logout URLs. `APP_BASE_URL` must be the public origin for that environment and must use HTTPS outside local development.

Django trusts email only when it and its verification status are present in the Auth0 API access token as namespaced claims. Add an Auth0 post-login Action like this and attach it to the Login flow:

```javascript
exports.onExecutePostLogin = async (event, api) => {
  api.accessToken.setCustomClaim("https://tella.systems/email", event.user.email);
  api.accessToken.setCustomClaim(
    "https://tella.systems/email_verified",
    event.user.email_verified === true,
  );
};
```

The claim names must exactly match `AUTH0_EMAIL_CLAIM` and `AUTH0_EMAIL_VERIFIED_CLAIM`. Auth0 connections must verify ownership before setting `email_verified=true`; do not write an Action that forces the value to true. Request-body email fields and Auth0 roles/metadata are never accepted as platform authorization.

## Environment configuration

Copy the values in [the backend example](../tella_backend/.env.example) to `tella_backend/.env`, and those in [the frontend example](../admin-platform/.env.example) to `admin-platform/.env.local`.

Backend settings:

- `AUTH0_ENABLED`: `true` to enable assertion exchange; otherwise `false`.
- `AUTH0_ISSUER`: exact tenant issuer, including scheme (for example `https://tenant.eu.auth0.com/`).
- `AUTH0_AUDIENCE`: the Auth0 API identifier.
- `AUTH0_ALGORITHM`: must remain `RS256`.
- `AUTH0_EMAIL_CLAIM` and `AUTH0_EMAIL_VERIFIED_CLAIM`: trusted namespaced Action claims.
- `AUTH0_JWKS_CACHE_SECONDS`, `AUTH0_HTTP_TIMEOUT_SECONDS`, and `AUTH0_EXCHANGE_THROTTLE_RATE`: bounded verification cache, network timeout, and anonymous exchange throttle.

Frontend server settings:

- `AUTH0_DOMAIN`: tenant hostname without a scheme.
- `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET`: Regular Web Application credentials.
- `AUTH0_SECRET`: application-session encryption secret generated with `openssl rand -hex 32`.
- `APP_BASE_URL`: exact public frontend origin.
- `AUTH0_AUDIENCE`: the same API identifier configured in Django.

All frontend Auth0 values are server-only; do not rename them with a `NEXT_PUBLIC_` prefix. Restart both processes after changing configuration. `run-platform.sh` checks both the frontend and Django configuration and stops with missing variable names, never values.

## Account admission and linking

Auth0 authenticates identity; Django still authorizes access. Before first login, create the Django user and assign the existing portal Group:

- learner access requires `STUDENT`;
- staff access follows the existing admitted staff Groups or superuser policy.

The first Auth0 login links one active Django user whose normalized email exactly matches the verified Auth0 email. It never creates a user or assigns a Group. Later logins resolve the stable Auth0 issuer and subject even if the provider email changes. This supports future CSV pre-provisioning: imported users may have unusable passwords and link on first Auth0 login, while users with passwords may continue using either method.

## Local-password-only verification

Keep `AUTH0_ENABLED=false` in both environment files (or omit all Auth0 variables), then run:

```bash
./run-platform.sh
```

The Auth0 buttons and exchange are disabled, while email/password and Moodle authentication remain operational. To enable Auth0, set the full frontend and backend configuration and restart the launcher. Never paste client secrets, application-session secrets, authorization codes, or tokens into logs or support records.
