See [index.md](index.md) for the docs routing map.

## Core layout and navigation
- [src/components/DashboardShell.tsx](src/components/DashboardShell.tsx) - shared layout with sidebar rail + header + content area.
- [src/components/DashboardSidebar.tsx](src/components/DashboardSidebar.tsx) - left nav, groups items into primary/secondary, handles mobile collapse.
- [src/components/DashboardHeader.tsx](src/components/DashboardHeader.tsx) - top bar, role switcher, language switcher, exit (Supabase `signOut` + clear demo session). Layout order: `[leftSlot] [Logo] [RoleSelect] [rightSlot] [LanguageSwitcher] [Exit]`. The student dashboard passes an AI (Sparkles) button via `rightSlot` to globally trigger the agent sidebar.
- [src/components/DashboardTabs.tsx](src/components/DashboardTabs.tsx) - tab switcher used for local section navigation.