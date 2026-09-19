---
name: react-server-patterns
description: "Implement or review React 19 and Next.js App Router components, RSC boundaries, server data fetching, forms, mutations, or rendering performance."
---


# React Server Patterns
1. Read `references/playbook.md`; inspect installed React/Next.js versions and framework docs.
2. Classify each component as a server default or an interactive client leaf. Keep secrets, authorization, and database modules server-only.
3. Fetch data in server boundaries; avoid redundant browser fetching and sequential independent queries. Bound concurrency and payload size.
4. Validate and authorize every server action/route handler independently of the UI. Use supported React form/action hooks only after checking version compatibility.
5. Implement pending, failure, empty, and success states with correct accessibility and stable keys. Keep derived state out of effects.
6. Verify rendering behavior, hydration, isolation, and interaction tests. Report performance measurements as measurements, not guesses.
