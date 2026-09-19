---
name: fullstack-delivery
description: "Plan or implement a SaaS feature across Next.js, Supabase Postgres, Better Auth, and Vercel. Use for project intake, architecture, vertical slices, or cross-layer delivery; do not scaffold unless requested."
---


# Full-Stack Delivery
1. Read the repository's GEMINI.md and `references/playbook.md`. Inspect the existing stack and scripts.
2. Establish the requested outcome, users, primary workflow, data sensitivity, tenancy, constraints, and acceptance tests. Ask only the next blocking question. Use `assets/project-brief.md` as a planning aid, not a mandate to expand scope.
3. Map the request to a vertical slice and explicit server/client, identity, database-role, and runtime boundaries. Activate the specialist skills needed for this slice.
4. If only architecture is requested, deliver the design and stop. Otherwise implement the smallest complete slice with migrations, contracts, auth checks, real UI states, and tests.
5. For changes to an existing project, preserve unrelated code. Identify migration and compatibility risks; do not silently upgrade major dependencies.
6. Run the repository's real checks. Use the quality-evidence skill before handoff and the release skill only when relevant.
7. Deliver changes, evidence, setup requirements, and unresolved risks. Do not call a design or scaffold production-ready.

## Completion gate
Every acceptance criterion maps to an implementation artifact and verification evidence, or is explicitly blocked/deferred. Installation of skills alone never counts as application implementation.
