# Copilot Instructions

## Docs-first rule (required)
- Always start with docs/guides/index.md to pick the smallest relevant doc.
- Read only that doc before opening any source files.
- Open code only if the doc does not answer the question.
- If still unclear, read docs/guides/project_structure.md next.
- Keep file reads minimal and targeted.

## Key references
- Run/build/test, env vars, and Supabase notes: docs/guides/how_to_run.md
- Routing and provider order: docs/guides/entry_points_routing.md
- State/auth/demo mode details: docs/guides/state_and_data.md
- Layout and navigation: docs/guides/core_layout.md
- Page map: docs/guides/pages.md
- Student and lecturer feature maps: docs/guides/student_workspace.md, docs/guides/lecturer_workplace.md

## UI conventions
- Prefer existing shadcn-ui primitives in src/components/ui before adding new UI components.
- Keep demo-mode behavior intact when touching auth or dashboard gating (see docs/guides/state_and_data.md).
