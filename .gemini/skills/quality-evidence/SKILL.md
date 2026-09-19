---
name: quality-evidence
description: "Review code or release readiness, run quality gates, screen for prohibited UI or TypeScript patterns, plan security tests, or prepare an evidence-based project handoff."
---


# Quality Evidence
1. Read `references/playbook.md`. Establish review scope and acceptance criteria before claiming readiness.
2. Inspect package scripts and run supported typecheck, lint, tests, and build commands. Record actual outputs/exit codes; explain unavailable prerequisites.
3. Optionally run `python scripts/screen_project.py /absolute/project/path` from this skill directory. It is a read-only heuristic screen, not an AST linter, vulnerability scanner, or security proof. Investigate findings; use real TypeScript/ESLint checks as the authority.
4. Review auth/RLS integration and UI states manually. Exercise isolation as real restricted roles, not privileged database owners.
5. Record failures, skipped tests, and limitations. Use `assets/handoff.md` for the final delivery.
6. If packaging, exclude credentials, personal data, dependency folders, and build outputs. Verify archive contents and relative paths.
