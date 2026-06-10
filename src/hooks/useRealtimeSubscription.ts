import { useEffect, useMemo, useRef } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
  RealtimePostgresChangesFilter,
} from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

export type RealtimeTableName =
  | "notifications"
  | "tasks"
  | "activity_logs"
  | "group_members"
  | "materials"
  | "join_requests"
  | "contribution_logs";

export type RealtimePostgresEvent = "*" | "INSERT" | "UPDATE" | "DELETE";
export type RealtimeSubscriptionStatus = "SUBSCRIBED" | "CHANNEL_ERROR" | "TIMED_OUT" | "CLOSED";

interface UseRealtimeSubscriptionOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  enabled: boolean;
  table: RealtimeTableName;
  filter?: string;
  events?: RealtimePostgresEvent[];
  requireFilter?: boolean;
  channelName?: string;
  onPayload: (payload: RealtimePostgresChangesPayload<T>) => void;
  onStatus?: (status: RealtimeSubscriptionStatus, error?: Error) => void;
}

function normalizeChannelName(value: string): string {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "_");
}

export function useRealtimeSubscription<T extends Record<string, unknown> = Record<string, unknown>>({
  enabled,
  table,
  filter,
  events = ["*"],
  requireFilter = false,
  channelName,
  onPayload,
  onStatus,
}: UseRealtimeSubscriptionOptions<T>) {
  const payloadRef = useRef(onPayload);
  const statusRef = useRef(onStatus);
  const eventsKey = useMemo(() => events.join(","), [events]);

  useEffect(() => {
    payloadRef.current = onPayload;
  }, [onPayload]);

  useEffect(() => {
    statusRef.current = onStatus;
  }, [onStatus]);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured || (requireFilter && !filter)) {
      return;
    }

    const resolvedChannelName = normalizeChannelName(
      channelName ?? `teamfair:${table}:${filter ?? "all"}:${eventsKey}`,
    );
    const resolvedEvents = eventsKey.split(",").filter(Boolean) as RealtimePostgresEvent[];

    let channel: RealtimeChannel = supabase.channel(resolvedChannelName);

    resolvedEvents.forEach(event => {
      const config: RealtimePostgresChangesFilter<RealtimePostgresEvent> = {
        event,
        schema: "public",
        table,
      };

      if (filter) {
        config.filter = filter;
      }

      channel = channel.on("postgres_changes", config, payload => {
        payloadRef.current(payload as RealtimePostgresChangesPayload<T>);
      });
    });

    channel.subscribe((status, error) => {
      if (
        status === "SUBSCRIBED"
        || status === "CHANNEL_ERROR"
        || status === "TIMED_OUT"
        || status === "CLOSED"
      ) {
        statusRef.current?.(status, error);
      }
    });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [channelName, enabled, eventsKey, filter, requireFilter, table]);
}
