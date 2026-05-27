# Checklist: Teamfair Hardening & Feature Polish

## Session 1: Core System Cleanup & Infrastructure (Tasks 1, 3, 5, 8)

- `[ ]` **Task 1: Complete Removal of Demo Mode**
  - `[ ]` Disable in-memory demo modes in `src/lib/demoSession.ts` by setting `isDemoSession` to always return `false`.
  - `[ ]` Remove the demo banner layout from `src/pages/StudentDashboard.tsx` and `src/pages/LecturerDashboard.tsx`.
  - `[ ]` Remove **"Or try the demo"** layout block and buttons (`demoStudent` / `demoLecturer`) in `src/pages/Login.tsx`.
  - `[ ]` Resolve 1-2s flashing: Add a loading state (`dataLoading`) in `TeamContext.tsx` while fetching groups. Show a skeleton UI in dashboards if `dataLoading` is true.
  - `[ ]` Empty states: Initialize `groups` as `[]` in `TeamContext.tsx` and set default `dataSource` to `'supabase'`.
- `[ ]` **Task 5: Fix "Switch Project" Empty Page Bug**
  - `[ ]` Verify that `/projects` routing correctly loads `ProjectManagement.tsx`.
  - `[ ]` Ensure that when `groups.length === 0`, `isNewUserOnboarding` handles redirects properly without entering a black-hole empty state.
- `[ ]` **Task 8: Document global roles vs project roles**
  - `[ ]` Check that global roles (`users.role`) and project member roles (`group_members.role` like `'Leader'` or `'Member'`) are distinct in database mappings and documentation.
- `[ ]` **Task 3: Vercel Python FastAPI Deployment Guide**
  - `[ ]` Add a deployment advice section in `/docs` regarding Vercel serverless 10-second Hobby limits and persistent fly/railway backend configurations.

## Session 2: Onboarding Flow & Display Name Cooldown (Tasks 6, 7)

- `[ ]` **Task 6: Dynamic 2-Step Onboarding Modal**
  - `[ ]` Redesign `OnboardingNameModal.tsx` to handle onboarding when `profile && !profile.profile_completed`.
  - `[ ]` **Step 1:** Add interactive cards for choosing between "Sinh viên / Student" and "Giảng viên / Lecturer".
  - `[ ]` **Step 2:** Prompt user for their display name.
  - `[ ]` On submit, trigger `set_signup_role` RPC to set their role, then update their display name.
- `[ ]` **Task 6 (part 2): SQL migration for Name Change Cooldown**
  - `[ ]` Create `supabase/migrations/20260527150000_name_cooldown.sql` with the `last_name_change_at` column and the BEFORE UPDATE cooldown trigger.
  - `[ ]` Add remaining time check inside `SettingsModal.tsx` and disable name editing if the cooldown is active.
- `[ ]` **Task 7: Remove Sidebar Role Switcher**
  - `[ ]` Delete the `Select` role switching element in `DashboardSidebar.tsx`.
  - `[ ]` Clean up `roleValue` and `onRoleChange` props and handlers from `StudentDashboard.tsx` and `LecturerDashboard.tsx`.

## Session 3: Task Actions & Team Hierarchy Management (Tasks 2, 9)

- `[ ]` **Task 2: Kanban Task Creation Button**
  - `[ ]` Ensure "Create Task" button is visible and active on the Kanban Board for the team leader.
  - `[ ]` Align member role parameters with task creation rights.
- `[ ]` **Task 9: Member Management & Resignation**
  - `[ ]` Create `supabase/migrations/20260527160000_member_management_rpcs.sql` containing:
    - `update_member_role(group_id, target_user_id, new_role)` RPC to update users' global roles from the project manager's dashboard securely.
    - `resign_as_leader(group_id, new_leader_id)` RPC to switch leader role and update project owner/creator IDs.
  - `[ ]` **Promotion/Demotion Section:** Add member directory in `SettingsModal.tsx` for leader to change member roles.
  - `[ ]` **Resignation Dialog Flow:**
    - Add red-alert "Resign" button.
    - Open verification input demanding exact matching of **"I resign my row"**.
    - Reveal successor picker and execute `resign_as_leader` RPC on submit.
