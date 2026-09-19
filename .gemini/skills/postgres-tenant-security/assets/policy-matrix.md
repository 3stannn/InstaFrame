# Policy and grants matrix
Complete this before SQL. A template is not an implemented policy.

| Table/schema | Actual DB role | Identity source | SELECT | INSERT | UPDATE USING / CHECK | DELETE | Grants | Isolation test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Fill for every managed table | Name the real role | Verified JWT or transaction context | Predicate or deny | Check or deny | Both predicates or deny | Predicate or deny | Minimum privileges | Test reference |

1. Include membership, application, auth, session, verification, and audit tables.
2. Document table owner, RLS enabled/forced status, and any privileged maintenance role.
3. Inspect existing policies: permissive policies combine with OR.
4. Specify tenant-safe foreign keys and immutability of ownership fields.
5. List every view, function/RPC, storage path, job, and admin access route separately.
6. Denied operations need no permissive policy; explicitly document absence of an applicable policy/grant. Never use a broad allow policy to satisfy a checklist.
7. Record application, auth-adapter, migration, and browser roles distinctly.
