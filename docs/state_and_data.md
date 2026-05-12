See [index.md](index.md) for the docs routing map.

## State, data, and i18n (in-memory demo)
- [src/context/TeamContext.tsx](src/context/TeamContext.tsx) - in-memory demo data for groups, tasks, members, activity log, reports, materials, lecturer reviews, and verified badges. All core mutations live here.
- [src/context/LanguageContext.tsx](src/context/LanguageContext.tsx) - language toggle (`vi` / `en`).
- [src/lib/i18n.ts](src/lib/i18n.ts) - dictionary and helpers `t()` / `tr()`.
- [src/hooks/use-toast.ts](src/hooks/use-toast.ts) - toast store and `useToast()`.
- [src/hooks/use-mobile.tsx](src/hooks/use-mobile.tsx) - breakpoint helper used by the sidebar system.

Notes:
- There is no backend integration yet; data is stored in React context and reset on refresh.
- AI behaviors are simulated with timers (see student and lecturer dashboards, plus the AI chat widget).