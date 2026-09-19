# Deployment and cache playbook

## Runtime compatibility
1. Use Node runtime for dependencies requiring Node APIs, TCP Postgres drivers, or incompatible auth adapters.
2. Use Edge only for verified compatible code. Identify runtime per route and middleware/proxy using the installed framework's conventions.
3. Co-locate compute and database where supported; document regional/residency constraints. Pool serverless connections and bound resource use.
4. Pin compatible dependencies and commit the package-manager lockfile. Match build Node version and package manager to repository requirements.

## Environment separation
1. Maintain distinct development, preview, and production secrets and appropriate database isolation. Do not point untrusted PR previews at production credentials/data.
2. NEXT_PUBLIC values are browser-visible and can be build-time inlined. Never place auth secrets, service-role keys, or database URLs in them.
3. Document required environment names and purpose without values. Verify auth trusted origins/callbacks for preview URLs without allowing arbitrary hostile origins.
4. Disable real email, payment, or destructive external actions in previews or use provider test modes.

## Cache correctness
1. Record which resources are public, tenant-private, user-private, or volatile. Avoid persistent caching of sessions and authorization decisions unless revocation semantics are explicit.
2. Authorize before access; scope cache keys/tags by tenant and resource. Do not infer isolation from a URL alone.
3. Use the installed version's revalidateTag signature/profile or supported updateTag/revalidatePath behavior. Choose stale-while-revalidate versus immediate read-your-writes intentionally.
4. Test user A/user B, tenant switching, logout, permission revocation, and post-mutation refresh. Never invalidate another tenant's data through user-controlled tag construction.

## Release order
1. Validate configuration and produce a build/test report with exact commands and exit codes.
2. Back up appropriately; dry-run migration behavior against a safe environment. Review destructive SQL and lock risks.
3. Apply backward-compatible expansion, deploy compatible app, verify/backfill, and defer destructive contraction until safe.
4. Create preview only after approval. Verify auth, tenant isolation, core action, cache behavior, and error handling on the actual deployment.
5. Promote to production only after explicit authorization and identified rollback criteria. Do not auto-run production migrations during an ordinary build step.
6. Redact secrets/PII from logs. Configure actionable Sentry alerts and correlation identifiers only if the user has authorized that integration.
7. Define rollback separately for application and database. Rolling back code does not undo schema/data changes.
