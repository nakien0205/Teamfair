See [index.md](index.md) for the docs routing map.

## Core layout and navigation
- [src/components/DashboardShell.tsx](src/components/DashboardShell.tsx) - shared layout with sidebar rail + header + content area.
- [src/components/DashboardSidebar.tsx](src/components/DashboardSidebar.tsx) - left nav, groups items into primary/secondary, handles mobile collapse.
- [src/components/DashboardHeader.tsx](src/components/DashboardHeader.tsx) - top bar, role switcher, language switcher, exit (Supabase `signOut` + clear demo session). Layout order: `[leftSlot] [Logo] [RoleSelect] [rightSlot] [MailIcon] [LanguageSwitcher] [Exit]`. The student dashboard passes an AI (Sparkles) button via `rightSlot` to globally trigger the agent sidebar. It also mounts the `NotificationMailIcon` to show unread notifications in a Popover container.
- [src/components/NotificationMailIcon.tsx](src/components/NotificationMailIcon.tsx) - animated Mail/MailOpen icon displaying a pulsing red badge when unread notifications are present, wrapping a scrollable, click-to-read Popover notification list.
- [src/components/DashboardTabs.tsx](src/components/DashboardTabs.tsx) - tab switcher used for local section navigation.

### Task Logs
- **Session 4: Settings Integration in Sidebar Layout (2026-05-25):**
  - **Type**: Feature
  - **Files Modified**:
    - `src/pages/StudentDashboard.tsx`
    - `src/pages/LecturerDashboard.tsx`
    - `src/pages/ProjectManagement.tsx`
  - **Summary of Changes**:
    - Added Settings tab/menu to the sidebars of both dashboards and Project Management page to launch the new unified SettingsModal.
    - Successfully integrated custom lucide Settings icons and Việt/Anh localization.