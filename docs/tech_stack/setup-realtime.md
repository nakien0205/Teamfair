# setup-realtime

date: 2026-06-04
status: complete

## Summary

Teamfair now uses Supabase Realtime Postgres Changes for dashboard-core live updates. Notifications are merged directly into `NotificationContext`; active project dashboard tables trigger debounced canonical reloads through the existing `TeamContext` persistence path.

## Files Changed

- `supabase/migrations/20260604130000_enable_realtime.sql`
- `src/hooks/useRealtimeSubscription.ts`
- `src/lib/notificationState.ts`
- `src/context/NotificationContext.tsx`
- `src/context/TeamContext.tsx`
- `docs/guides/state_and_data.md`
- `docs/guides/how_to_run.md`

## Realtime Tables

- `notifications`
- `tasks`
- `activity_logs`
- `group_members`
- `materials`
- `join_requests`
- `contribution_logs`

## Notes

- The Supabase CLI was unavailable locally, so the migration file was created manually using the repo's timestamp naming pattern.
- Existing RLS policies remain the authorization boundary.
- `contribution_logs` is in the publication for roadmap compatibility; no client subscription is active until the UI reads those rows.
