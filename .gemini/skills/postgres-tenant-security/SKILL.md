---
name: postgres-tenant-security
description: "Design or audit Supabase Postgres schemas, migrations, indexes, connection pooling, RLS policies, identity propagation, or multi-tenant isolation."
---


# Postgres Tenant Security
1. Read `references/playbook.md` before producing SQL. Identify identity authority, actual database role, driver, pooler mode, tenant boundaries, and access paths.
2. Normalize the model; define primary/foreign/unique/check constraints and index expected lookups. Match ID types to the actual Better Auth schema; never assume UUID user IDs.
3. Define the complete table-by-role-by-operation matrix with `assets/policy-matrix.md`. Deny by default; use explicit policies for allowed operations and document denied operations.
4. Implement migrations and matching TypeScript row/insert/update contracts in the project. Enable RLS for every managed application/auth table with compatible adapter privileges. Do not expose session/token tables to browser roles.
5. Wire a verified identity bridge or transaction-local trusted server context. Do not generate policies that refer to auth.uid() without proving how it is populated.
6. Test as real restricted roles using two tenants, not as the database owner or service role. Test connection reuse and missing identity. Inspect query plans using realistic non-sensitive fixtures.
7. Deliver migration execution/rollback notes, policy matrix, contracts, and isolation evidence. If no database is available, label SQL as unexecuted.
