# React and Next.js review guide

## Boundaries
1. Render layout, navigation context, and initial domain data on the server when feasible.
2. Use client components only for event handlers, browser APIs, local interaction state, or client-only dependencies. A client boundary pulls transitive imports into its bundle; audit imports.
3. Pass serializable, minimal DTOs across the boundary; never forward entire session rows, database clients, tokens, or sensitive internal fields.
4. Use composition and children slots before adding broad context providers. Put providers as deep as practical.

## State and forms
1. Compute filtered/sorted views from existing state when inexpensive. Do not mirror props in state without a documented interaction need.
2. Use effects to synchronize actual external systems and clean up subscriptions. Do not treat useEffect as a generic fetch or derived-state default.
3. Handle duplicate submission and mutation retries at the server; disabled buttons alone do not establish idempotency.
4. Consider useActionState/useFormStatus where supported and useful; optimistic updates require rollback and reconciliation.
5. Preserve semantic form labels, field errors, global error summaries, and focus behavior. Prefer progressive enhancement where the stack supports it.

## Data and caching
1. Parallelize independent server reads; keep dependent operations ordered. Use joins/batching for N+1 patterns.
2. Scope request memoization and persistent caches differently. Never persistently cache user-session results under a global key.
3. Include tenant and resource identity in applicable cache keys/tags, and authorize before reading protected cached data. Test logout and cross-tenant navigation.
4. Check installed APIs for route parameters, cookies, headers, server actions, caching, and invalidation. Do not copy obsolete signatures.
5. Paginate large data sets with deterministic ordering and bounded page sizes.

## Required verification
1. Unauthorized direct server action/API calls fail even if the UI hides the control.
2. Client bundles do not include server credentials or database drivers.
3. Keyboard submission, pending state, validation failure, and retry work.
4. A server-rendered initial view does not rely on a client-side auth redirect flash.
5. Measure bundle size or latency before claiming an optimization.
