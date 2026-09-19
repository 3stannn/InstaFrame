# Database isolation and migration guide

## Identity is an explicit architecture decision
Better Auth sessions and Supabase Auth sessions are different systems. A successful Better Auth login does not automatically produce a Supabase-accepted access token. Do not assume auth.uid() will match the user, or that Better Auth IDs are UUIDs.

## Option A: verified JWT bridge to Supabase's API
1. Verify current Supabase support for the issuer/JWKS integration and configure issuer, audience, signature verification, key rotation, expiration, and claim mapping.
2. Obtain/verify identity through Better Auth on the server; mint or exchange only through a documented trusted mechanism. Do not merely copy a session cookie into a bearer header.
3. Forward the verified token server-side using a public application key, not a service-role key for normal user reads.
4. Design RLS for the actual subject type and authoritative tenant membership. Prefer a membership lookup over stale user-editable tenant/role claims.
5. Test missing/expired/wrong-audience/forged JWTs and cross-tenant reads/writes. Until the bridge is validated, it is not implemented.

## Option B: trusted server transaction context over pooled Postgres
1. Authenticate the request using Better Auth and resolve the user's tenant membership on the server.
2. Connect as a dedicated least-privilege application role with no superuser, BYPASSRLS, or schema ownership powers. Keep migration-owner credentials separate. Explicitly verify role attributes and grants.
3. Begin a transaction on one checked-out connection. Set application user/tenant context using parameterized transaction-local set_config calls. Perform protected reads/writes on that same transaction/connection. Commit or rollback and release in finally.
4. Policies use current_setting with missing_ok and NULL-safe logic; absence of identity denies access. Context values derive from the validated session, never request assertions. Do not use session-scoped SET through a pooler.
5. These settings are trusted-server assertions, not cryptographic identity: a compromised application DB credential can impersonate context. Restrict DB access to the trusted server; never distribute the role or provide arbitrary SQL endpoints.
6. Apply RLS with ownership semantics understood. Table owners normally bypass RLS; FORCE ROW LEVEL SECURITY can constrain owners but never overrides superuser/BYPASSRLS. Test the actual runtime role.
7. Better Auth may require a separate tightly scoped database role/adapter for auth tables. Configure required auth operations deliberately; never grant broad access to application data as a workaround.

## Schema and policies
1. Normalize entities and membership. Prefer explicit relationship tables to arrays/JSON for relational membership.
2. Index foreign keys used in joins/deletes, tenant/resource filters, membership lookups, and sort columns. Postgres does not automatically index referencing foreign-key columns.
3. Use composite unique keys and foreign keys where needed to prevent attaching a child in tenant A to a parent in tenant B.
4. SELECT uses USING; INSERT uses WITH CHECK; UPDATE normally needs USING and WITH CHECK; DELETE uses USING. UPDATE may also require a compatible SELECT policy.
5. Scope policies to explicit roles and remove inherited broad grants/policies. Permissive policies combine with OR; adding a narrow policy does not cancel an existing broad one.
6. Missing applicable policies intentionally deny row access when RLS applies. Record exact deny behavior; do not create fake CRUD permissions just to fill a matrix.
7. Prevent recursive membership policies. If a SECURITY DEFINER helper is necessary, tightly scope its owner and EXECUTE privilege, set a safe search_path, schema-qualify objects, validate inputs, and review leakage. Do not casually use definer functions to bypass RLS.
8. Views, RPC/functions, storage, auth tables, background jobs, and administrative tools each need their own access review. RLS on one table does not secure every derived interface.

## Migration and pooling rules
1. Commit immutable, ordered migration files. Include grants, policy changes, constraints, indexes, and the data/backfill sequence, not just CREATE TABLE.
2. Use expand/backfill/contract for risky changes. Review lock duration, timeouts, and data volume. CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
3. Runtime uses a pooler-compatible connection. Verify driver prepared-statement settings for the chosen pooling mode. Schema changes generally use a suitable direct/session connection with appropriate privileges.
4. Use parameterized queries; never interpolate identifiers from untrusted input. Allowlist sort identifiers separately.
5. Use bounded keyset pagination where scale requires it, with a stable tiebreaker.
6. Generate or verify TypeScript contracts against the applied schema. Account explicitly for nullable columns, database defaults, timestamps, decimal/bigint serialization, and row versus insert/update shape.

## Minimum adversarial tests
1. Anonymous access and missing transaction context are denied.
2. Tenant A cannot select, insert into, update, delete, or associate child records with tenant B.
3. A viewer cannot mutate; revoked membership and expired sessions fail.
4. Forged tenant/user fields cannot change authority.
5. Tenant identity does not leak between sequential and concurrent pooled requests.
6. Service-role/owner tests are separate operational checks and never counted as user isolation evidence.
7. Auth/session tables are inaccessible to browser-facing roles; the approved adapter still functions.
