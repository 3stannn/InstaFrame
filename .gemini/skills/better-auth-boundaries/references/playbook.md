# Authentication and authorization playbook

## Setup discovery
1. Read the installed Better Auth API and adapter docs. Generate required tables with the installed compatible tooling and review the migration rather than inventing adapter columns.
2. Identify session storage, expiry, refresh behavior, caching, cookie attributes, trusted origins, callback URLs, and proxy headers.
3. Use a strong secret from the secret manager/environment; never ship a fixed example secret that could be mistaken for a real one.
4. Keep auth/session/account/verification data server-only. Explicitly review RLS/grants for the adapter role and prevent browser role access.

## Authorization boundaries
1. In each server action/handler/DAL entry point: validate input, verify session, load authoritative membership, authorize the operation and resource, execute with appropriate DB identity, return minimal output.
2. Resolve roles per tenant. A platform administrator is different from an organization administrator. Do not use a global role flag to accidentally grant every organization's data.
3. Use server-side resource ownership/tenant lookups. A supplied tenant ID is a requested target, not proof of membership.
4. Avoid time-of-check/time-of-use races for sensitive operations; enforce invariants within a transaction and appropriate locks/constraints where needed.
5. Do not depend solely on Next.js layouts: layouts may persist across navigation, and route handlers/actions are independently callable. Middleware/proxy checks must be compatible with the installed framework/runtime and do not replace DAL checks.

## Sessions and flows
1. Use secure, httpOnly cookies where appropriate, explicit sameSite behavior, controlled domains, and HTTPS in production. Validate trusted origins and CSRF protections for the actual auth flow.
2. Apply rate limits to login, reset, verification, and invitation endpoints. Avoid account enumeration in public responses.
3. Validate OAuth state/nonce/PKCE as required by the configured provider and library. Do not silently link accounts based on unverified email.
4. Protect reset and invite tokens with expiry, single-use semantics, safe storage, and authoritative recipient/organization validation.
5. Role changes, membership revocation, logout, and password/security changes must invalidate or revalidate relevant session/permission caches according to the documented risk model.
6. Background jobs use deliberate service identities; support impersonation requires explicit authorization, scoped access, and audit logging.

## Evidence
Test signed-out, expired, revoked, valid viewer, valid administrator, user in two organizations, and cross-tenant attacker scenarios. Include direct HTTP/action calls that bypass the UI. Record which identity and database role each test exercised.
