---
name: dense-ui-systems
description: "Design or review dense, neutral, accessible SaaS interfaces; use for tables, dashboards, queues, layouts, design tokens, visual polish, or removal of generic AI UI patterns."
---


# Dense UI Systems
1. Read `references/playbook.md`; identify the user's primary task and information hierarchy before drawing containers.
2. Start from a table, queue, editor, or feed rather than decorative KPI cards. Choose one neutral base and at most one functional accent.
3. Use `assets/tokens.css` as an optional reference; merge deliberately into the existing design system rather than overwriting it. Use semantic Tailwind utilities backed by project tokens.
4. Build compact, semantic components with all data states, keyboard access, focus visibility, responsive overflow, and non-color status cues.
5. Use clearly marked domain-authentic demo fixtures only when live data is unavailable. Never manufacture customer or revenue claims.
6. Review screenshots at narrow and wide widths when browser tools exist. Otherwise explicitly mark visual verification as not run. Use `assets/review-rubric.md` for review.
