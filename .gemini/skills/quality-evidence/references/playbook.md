# Verification playbook

## Gate levels
1. Static: strict TypeScript, repository lint, schema validation, formatting, secret scanning, and dependency review.
2. Unit: validation, role decisions, normalization, formatting, calculations, and state transitions.
3. Integration: Better Auth session/DAL boundary, database role and RLS, migrations, constraints, connection reuse, and cache invalidation.
4. Browser: full task, direct navigation, keyboard operation, narrow screen, pending/error/empty states, accessibility, and post-login/logout behavior.
5. Deployment: actual preview URL, build logs, environment bindings, production migration plan, smoke checks, and rollback readiness.

## Rules for evidence
1. Each result includes scope, exact command, environment, outcome, and limitation. An exit code of zero from a heuristic screen does not establish security or production readiness.
2. Never report a screenshot review without viewing screenshots. Never report RLS isolation from SQL parsing alone.
3. Distinguish written test coverage from executed tests. Distinguish local build from hosted deployment.
4. Reproduce failures before fixing them when practical; rerun relevant tests after the fix.
5. Classify findings by user impact and exploitability, with file/line evidence and a concrete remediation. Do not inflate cosmetic preferences into critical vulnerabilities.

## Minimum release blockers
1. Unresolved tenant data leakage, auth bypass, exposed secrets, or privileged ordinary-user database access.
2. No valid identity-to-RLS path or tests using only a bypassing role.
3. Missing critical migrations/contracts, unresolved type errors, or a broken primary user workflow.
4. Unsupported runtime/dependency combination or missing required production configuration.
5. Destructive remote action without informed approval and recovery planning.

## Packaging
Include source, lockfile, reviewed migrations, matching types, tests, .env.example with empty/safe placeholders, setup instructions, and honest verification notes. Exclude .env files, secrets, private user records, node_modules, .next, .git, build artifacts, and caches. Inspect the ZIP, not merely the source directory, before handing it off.
