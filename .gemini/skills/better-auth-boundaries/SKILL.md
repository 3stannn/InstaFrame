---
name: better-auth-boundaries
description: "Implement or audit Better Auth sessions, login flows, protected routes, RBAC, organization membership, invitation flows, or the Supabase identity boundary."
---


# Better Auth Boundaries
1. Read `references/playbook.md`; inspect installed Better Auth version, adapter schema, ID configuration, and session options.
2. Create a permission matrix for user actions and tenant-scoped roles. Do not grant authority from browser fields or cookie existence.
3. Verify sessions server-side at data-access and mutation boundaries; re-check membership for the target resource/tenant. Protect layouts and middleware/proxy as supplementary gates.
4. Define the RLS identity path with postgres-tenant-security before claiming end-to-end isolation. Preserve actual user ID types.
5. Implement enabled login/account flows completely, including cookies, origin checks, validation, rate limits, revocation, and accessible failures.
6. Test direct requests, expired/revoked sessions, role changes, and cross-tenant access. Report untested external providers/mail delivery as unverified.
