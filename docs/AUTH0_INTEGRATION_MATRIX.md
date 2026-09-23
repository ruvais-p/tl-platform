# Auth0 integration verification matrix

Last updated: 2026-09-14

No non-production Auth0 tenant credentials are configured in this workspace. The automated, synthetic portion of the matrix is complete; live-tenant observations remain intentionally pending rather than being represented as successful.

| Scenario | Automated evidence | Non-production tenant observation |
| --- | --- | --- |
| Existing staff and learner login | Django exchange and Next.js completion route tests pass for both portals | Pending tenant configuration |
| First-time verified-email linking | Transactional service and exchange tests pass | Pending tenant configuration |
| Repeat login by issuer/subject | Existing-link test passes, including provider email change | Pending tenant configuration |
| Unverified or unknown email | Generic-denial and no-link tests pass | Pending tenant configuration |
| Inactive user and wrong portal | Canonical admission and exchange tests pass | Pending tenant configuration |
| Safe continuation | External, protocol-relative, malformed, and cross-workspace tests pass | Pending tenant configuration |
| Signing-key rotation/JWKS failure | Rotated-key and network-failure verifier tests pass | Pending tenant configuration |
| Local password fallback | Complete Django/frontend suites and disabled launcher smoke test pass | Pending tenant configuration |
| Simultaneous staff/learner sessions | Separate cookie namespace and global logout tests pass | Pending tenant configuration |
| Local and Auth0 logout | Revocation, local-only, global, missing-token, and upstream-failure tests pass | Pending tenant configuration |

When tenant access is available, execute each row using non-sensitive test accounts. Record status, date, tenant environment name, and sanitized correlation IDs only. Never record assertions, authorization codes, cookies, client secrets, session secrets, or refresh tokens.
