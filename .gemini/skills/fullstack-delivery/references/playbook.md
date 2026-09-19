# Delivery playbook

## Intake
1. Purpose: who does what, and what measurable outcome makes the workflow successful?
2. Scope: new app, existing feature, bug fix, audit, or design only? Avoid unnecessary framework migrations.
3. Identity: organizations, invited members, individual users, role hierarchy, support access, and ownership transfer.
4. Data: regulated or confidential fields, retention, residency, audit needs, expected cardinality, and recovery requirements.
5. Operations: environment accounts, package manager, deployment region, budgets, observability, and user-authorized integrations.

## Architecture record
For each decision record context, chosen option, rejected alternatives, tradeoffs, validation method, and reversal cost. Minimum decisions: identity authority, RLS identity propagation, runtime/driver, tenancy model, cache isolation, and error handling.

## Slice order
1. Data contract: entities, keys, relationships, invariant constraints, indexes, and policy matrix.
2. Server boundary: parse inputs, validate session, resolve membership, authorize operation, query within the chosen isolation model, return minimal typed result.
3. UI: semantic work surface, server-rendered shell, interactive leaves, accessible feedback, and all required states.
4. Verification: unit tests for invariants, integration tests for auth/data boundaries, and E2E for the user task.
5. Release: migration sequencing, environment validation, rollback compatibility, monitoring, and explicit approval.

## Blockers requiring a pause
1. No known product purpose for a request to build a new app.
2. Unknown identity-to-RLS mechanism with a claimed multi-tenant security guarantee.
3. Destructive migration without a recovery plan and approval.
4. Missing credentials or unavailable tools for actions requiring verified remote state.
5. Conflicting requirements that materially change data integrity, billing, privacy, or access control.

## Review delegation
Architecture reviewer checks the plan; UI reviewer checks semantics and state coverage; tenant-security reviewer checks auth/RLS seams. Independent review is advisory, not a replacement for executing tests. Pass necessary context explicitly and reconcile findings in the main session.
