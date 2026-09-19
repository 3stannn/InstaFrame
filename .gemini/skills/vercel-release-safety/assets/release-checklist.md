# Release checklist
1. Commit, package manager, lockfile, Node version, and target environment recorded.
2. Actual typecheck, lint, test, and build command results recorded.
3. Runtime/driver/Better Auth compatibility confirmed.
4. Required environment names configured without exposing values.
5. Preview isolation and safe external-service modes confirmed.
6. Tenant-aware cache and post-mutation invalidation tested.
7. Database migration order, locks, backup, and recovery reviewed.
8. Actual runtime-role auth/RLS integration tests passed.
9. OAuth callbacks/trusted origins/cookies tested on target origin.
10. Explicit authorization for the exact deployment/migration action obtained.
11. Real deployment URL/status captured; smoke tests performed.
12. Logging/PII redaction, alerts, owner, rollback criteria, and rollback steps documented.

A checklist item without evidence remains NOT VERIFIED. Do not imply a checked box creates a deployed environment.
