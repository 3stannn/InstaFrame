---
name: vercel-release-safety
description: "Prepare or review Vercel deployment, Next.js runtime selection, cache invalidation, environment variables, preview environments, migration sequencing, or release readiness."
---


# Vercel Release Safety
1. Read `references/playbook.md`; inspect the framework, dependency lockfile, package scripts, deployment settings, and runtime constraints.
2. Identify Node versus Edge compatibility honestly. Do not force Node-only auth/database drivers into Edge functions.
3. Review environment separation, callback origins, tenant-safe caching, migration order, and observability.
4. Run the supported install, typecheck, lint, test, and build commands. Do not assume historical Next.js lint/build behavior.
5. Prepare a preview/release plan using `assets/release-checklist.md`. Ask for explicit approval before deployment or remote mutations.
6. Deploy only with available authenticated tools and authorization. Capture the real deployment URL/status and smoke-test it. Otherwise deliver a clearly marked unexecuted plan.
