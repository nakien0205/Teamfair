---
name: docs-auto-logger
description: Automatically aligns system documents and appends change history logs to docs/guides/ to keep development guides in perfect sync with code changes.
---

# Docs Auto-Logger Skill

A guide and workflow to automate the "Docs-first rule" and "Log task rule" defined in `project-instruction.md`. It provides instructions on how to trace codebase changes, identify which guide in `docs/guides/` needs updating, and write structured, clean implementation history logs.

## When to Activate

- After completing a feature or fixing a bug, before making a final commit/PR.
- When adding new components, pages, context providers, or database schemas.
- Whenever a task is marked completed in the project workflow.

## The Guide Mapping Directory

Use this table to map where code modifications should be logged:

| Impacted Component / Logic | Relevant Guide File |
|-----------------------------|---------------------|
| Authentication, OAuth, Supabase sessions, Demo data contexts | [state_and_data.md](file:///d:/Python/Projects/Teamfair/docs/guides/state_and_data.md) |
| Routing paths, Entry points, React context providers wrapper order | [entry_points_routing.md](file:///d:/Python/Projects/Teamfair/docs/guides/entry_points_routing.md) |
| Database migrations, Local/production env variables, Run commands | [how_to_run.md](file:///d:/Python/Projects/Teamfair/docs/guides/how_to_run.md) |
| Student dashboard, Student workspace tabs, student workflows | [student_workspace.md](file:///d:/Python/Projects/Teamfair/docs/guides/student_workspace.md) |
| Lecturer dashboard, Student reviews, badges, report views | [lecturer_workplace.md](file:///d:/Python/Projects/Teamfair/docs/guides/lecturer_workplace.md) |
| Layout structures, Navbar, Sidebars, DashboardHeader | [core_layout.md](file:///d:/Python/Projects/Teamfair/docs/guides/core_layout.md) |
| Page map, file routes, file placement directories | [pages.md](file:///d:/Python/Projects/Teamfair/docs/guides/pages.md) |
| Broad architectural changes, directory layout restructuring | [project_structure.md](file:///d:/Python/Projects/Teamfair/docs/guides/project_structure.md) |

## Logging Workflow

### Step 1: Scan Changes
Run a git diff or review modified file buffers to determine what files changed.
Example:
```bash
git diff --name-only
```

### Step 2: Select Target Guides
Identify the relevant guide file(s) from the mapping table above.

### Step 3: Keep Guides Focused and Slim
To keep token counts minimized and developer documentation highly targeted:
- **Do not append historical changelogs, task logs, or verification histories** directly inside the guide files in `docs/guides/`. Git history and commit messages serve as the authoritative record of modifications.
- Ensure the guide files strictly describe only the **current active state** of the components, configurations, database tables, and system architectures.

### Step 4: Keep Index and References Clean
- If you introduced new pages, update **[pages.md](file:///d:/Python/Projects/Teamfair/docs/guides/pages.md)**.
- If you added new environment variables or core runtime requirements, update **[how_to_run.md](file:///d:/Python/Projects/Teamfair/docs/guides/how_to_run.md)**.
- Ensure all file paths and guides referenced are accurate and active.
