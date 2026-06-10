// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRealtimeSubscription } from "./useRealtimeSubscription";

const realtimeMock = vi.hoisted(() => ({
  isConfigured: true,
  channel: vi.fn(),
  removeChannel: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({
  get isSupabaseConfigured() {
    return realtimeMock.isConfigured;
  },
  supabase: {
    channel: realtimeMock.channel,
    removeChannel: realtimeMock.removeChannel,
  },
}));

describe("useRealtimeSubscription", () => {
  let channel: {
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
  };
  let statusCallback: ((status: string, error?: Error) => void) | undefined;

  beforeEach(() => {
    statusCallback = undefined;
    channel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(callback => {
        statusCallback = callback;
        return channel;
      }),
    };
    realtimeMock.isConfigured = true;
    realtimeMock.channel.mockReset();
    realtimeMock.channel.mockReturnValue(channel);
    realtimeMock.removeChannel.mockReset();
  });

  it("does not subscribe when disabled", () => {
    renderHook(() => useRealtimeSubscription({
      enabled: false,
      table: "tasks",
      filter: "group_id=eq.group-1",
      requireFilter: true,
      onPayload: vi.fn(),
    }));

    expect(realtimeMock.channel).not.toHaveBeenCalled();
    expect(channel.on).not.toHaveBeenCalled();
    expect(channel.subscribe).not.toHaveBeenCalled();
  });

  it("registers table, filter, and event configuration", () => {
    const onPayload = vi.fn();

    renderHook(() => useRealtimeSubscription({
      enabled: true,
      table: "tasks",
      filter: "group_id=eq.group-1",
      requireFilter: true,
      events: ["INSERT", "UPDATE"],
      onPayload,
    }));

    expect(realtimeMock.channel).toHaveBeenCalledWith("teamfair:tasks:group_id_eq_group-1:INSERT_UPDATE");
    expect(channel.on).toHaveBeenCalledTimes(2);
    expect(channel.on).toHaveBeenNthCalledWith(
      1,
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "tasks",
        filter: "group_id=eq.group-1",
      },
      expect.any(Function),
    );
    expect(channel.on).toHaveBeenNthCalledWith(
      2,
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "tasks",
        filter: "group_id=eq.group-1",
      },
      expect.any(Function),
    );
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
  });

  it("removes the channel on cleanup", () => {
    const { unmount } = renderHook(() => useRealtimeSubscription({
      enabled: true,
      table: "materials",
      filter: "group_id=eq.group-1",
      requireFilter: true,
      onPayload: vi.fn(),
    }));

    unmount();

    expect(realtimeMock.removeChannel).toHaveBeenCalledWith(channel);
  });

  it("forwards subscription status changes", () => {
    const onStatus = vi.fn();
    const error = new Error("timeout");

    renderHook(() => useRealtimeSubscription({
      enabled: true,
      table: "notifications",
      filter: "recipient_id=eq.user-1",
      requireFilter: true,
      onPayload: vi.fn(),
      onStatus,
    }));

    statusCallback?.("SUBSCRIBED");
    statusCallback?.("TIMED_OUT", error);

    expect(onStatus).toHaveBeenCalledWith("SUBSCRIBED", undefined);
    expect(onStatus).toHaveBeenCalledWith("TIMED_OUT", error);
  });
});
