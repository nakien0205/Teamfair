---
name: setup-realtime
description: >
  Enable Supabase Realtime subscriptions for live dashboard updates in Teamfair.
  Trigger when: adding real-time features, live notifications, or executing roadmap item P1-1.
---

# P1-1: Supabase Realtime Subscriptions

## Context
Teamfair notifications and task changes require a page refresh to appear. Supabase Realtime is included in the plan but not used. Enabling it gives live updates for tasks, notifications, and group membership changes — critical for a collaborative team tool.

**Priority**: P1 — High  
**Effort**: M (Medium — ~3-4 hours)  
**Budget**: $0 (included in Supabase plan)  
**Depends on**: Nothing (can start immediately)

## Prerequisites
- Read `docs/guides/state_and_data.md` — understand `TeamContext` and `NotificationContext`
- Read `src/context/TeamContext.tsx` — understand the state shape and data loading
- Read `src/context/NotificationContext.tsx` — understand notification state
- Supabase project dashboard → Database → Replication: verify tables are enabled for realtime

## Step-by-Step Instructions

### Step 1: Enable Realtime on required tables

In Supabase Dashboard → Database → Replication, enable realtime for:
- `tasks` — task status changes, new tasks
- `notifications` — new notifications
- `group_members` — member joins/leaves
- `contribution_logs` — new activity

Or via SQL migration `supabase/migrations/<timestamp>_enable_realtime.sql`:

```sql
-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contribution_logs;
```

### Step 2: Create a realtime subscription hook

Create `src/hooks/useRealtimeSubscription.ts`:

```typescript
import { useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type TableName = "tasks" | "notifications" | "group_members" | "contribution_logs";

export function useRealtimeSubscription(
  table: TableName,
  filter: string | undefined,  // e.g., "group_id=eq.{id}"
  onInsert?: (payload: RealtimePostgresChangesPayload<any>) => void,
  onUpdate?: (payload: RealtimePostgresChangesPayload<any>) => void,
  onDelete?: (payload: RealtimePostgresChangesPayload<any>) => void
) {
  useEffect(() => {
    const channelName = `${table}_${filter ?? "all"}`;

    let channel = supabase.channel(channelName);

    if (onInsert) {
      channel = channel.on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table, filter },
        onInsert
      );
    }
    if (onUpdate) {
      channel = channel.on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table, filter },
        onUpdate
      );
    }
    if (onDelete) {
      channel = channel.on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table, filter },
        onDelete
      );
    }

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [table, filter]);
}
```

### Step 3: Integrate with NotificationContext

In `src/context/NotificationContext.tsx`, add a realtime subscription for new notifications:

```typescript
// Inside the provider, after initial data load:
useRealtimeSubscription(
  "notifications",
  `user_id=eq.${user?.id}`,
  (payload) => {
    // INSERT — new notification received
    const newNotification = payload.new as Notification;
    setNotifications(prev => [newNotification, ...prev]);
    setUnreadCount(prev => prev + 1);
    // Trigger toast
    toast({ title: newNotification.title, description: newNotification.body });
  }
);
```

### Step 4: Integrate with TeamContext for task updates

In `src/context/TeamContext.tsx` or as a hook used inside it, subscribe to task changes for the current group:

```typescript
useRealtimeSubscription(
  "tasks",
  currentGroup ? `group_id=eq.${currentGroup.id}` : undefined,
  (payload) => {
    // INSERT — new task created by another user
    // Merge into local state without refetching everything
    const newTask = deserializeTask(payload.new);
    addTaskToState(newTask);
  },
  (payload) => {
    // UPDATE — task status/fields changed
    const updatedTask = deserializeTask(payload.new);
    updateTaskInState(updatedTask);
  },
  (payload) => {
    // DELETE — task removed
    removeTaskFromState(payload.old.id);
  }
);
```

**Important**: The realtime callback receives the raw Supabase row. You need to deserialize it into the same shape as your TypeScript types (dates, nested objects, etc.). Reuse existing deserialization logic from `teamPersistence.ts`.

### Step 5: Handle subscription lifecycle

- Subscribe when the user is authenticated AND has a current group
- Unsubscribe when switching groups or logging out
- The `useEffect` cleanup in the hook handles this automatically via the `filter` dependency

### Step 6: Avoid duplicate state updates

When the current user performs an action (create task, send notification), the optimistic update AND the realtime callback will both fire. Guard against duplicates:

```typescript
onInsert: (payload) => {
  const newItem = payload.new;
  setItems(prev => {
    // Skip if already exists (optimistic update already added it)
    if (prev.some(item => item.id === newItem.id)) return prev;
    return [deserialize(newItem), ...prev];
  });
}
```

## Verification

- [ ] Realtime publication is enabled for target tables
- [ ] Opening two browser tabs: creating a task in tab A appears in tab B without refresh
- [ ] New notifications appear instantly without refresh
- [ ] Switching groups unsubscribes from old group and subscribes to new
- [ ] Logging out cleans up all subscriptions (no console errors)
- [ ] Optimistic updates don't cause duplicates when realtime callback fires
- [ ] `pnpm build` succeeds
- [ ] `pnpm test` passes

## Post-Task Logging

Create `docs/tech_stack/setup-realtime.md`:

```markdown
# setup-realtime
date: <today>
status: complete
files_changed:
  - supabase/migrations/<timestamp>_enable_realtime.sql (NEW)
  - src/hooks/useRealtimeSubscription.ts (NEW)
  - src/context/NotificationContext.tsx
  - src/context/TeamContext.tsx
blockers: none
notes: Realtime enabled for tasks, notifications, group_members, contribution_logs. Custom hook with dedup guard for optimistic updates.
```
