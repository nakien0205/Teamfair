# UX/UI Context

This file is the canonical UX/UI context entrypoint for Teamfair.

Use it after `process/context/all-context.md` when the task needs UI/UX styling, components, or GSAP animations.

---

## Scope

This group covers:
- Tailwind CSS configurations, utility classes, and custom animations.
- shadcn/ui components (Radix primitives) in `src/components/ui`.
- GSAP-based scroll triggers and cursor-driven timeline animations (such as landing page visual effects).
- Shared layouts (sidebar, header, nav shell).

It does not cover:
- Business logic or state management (belongs in auth/ or database/ groups).
- Feature-specific layout code (belongs in process/features/...).

## Read When

Read this entrypoint when:
- Editing frontend styles or Tailwind config.
- Modifying shared page layouts or sidebar navigation.
- Implementing or debugging complex visual animations using GSAP.

## Source Paths

- `src/components/ui/`
- `src/index.css`
- `tailwind.config.ts`

## Update Triggers

Update this group when:
- UI libraries or styling configs change.
- New animations or landing pages are developed.
