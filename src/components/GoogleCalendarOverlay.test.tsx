import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GoogleCalendarOverlay } from "./GoogleCalendarOverlay";
import { GoogleOverlayEvent } from "../lib/googleCalendarOverlay";

describe("GoogleCalendarOverlay Component", () => {
  const mockEvents: GoogleOverlayEvent[] = [
    {
      providerEventId: "evt-1",
      title: "Project Review Meeting",
      start: { dateTime: "2026-07-25T10:00:00Z" },
      end: { dateTime: "2026-07-25T11:00:00Z" },
      allDay: false,
      readOnly: true,
      source: "google",
    },
    {
      providerEventId: "evt-2",
      title: "Team Outing",
      start: { date: "2026-07-26" },
      end: { date: "2026-07-27" },
      allDay: true,
      readOnly: true,
      source: "google",
    },
  ];

  it("renders overlay header, read-only tag, and event list when status is ready", () => {
    const handleRefresh = vi.fn();
    render(
      <GoogleCalendarOverlay
        status="ready"
        events={mockEvents}
        refreshedAt="2026-07-22T20:00:00Z"
        isLoading={false}
        onRefresh={handleRefresh}
      />
    );

    expect(screen.getByRole("heading", { name: /google calendar overlay/i })).toBeInTheDocument();
    expect(screen.getByText(/project review meeting/i)).toBeInTheDocument();
    expect(screen.getByText(/team outing/i)).toBeInTheDocument();
    expect(screen.getAllByText(/google calendar · read-only/i)).toHaveLength(2);

    const refreshBtn = screen.getByRole("button", { name: /refresh google calendar/i });
    expect(refreshBtn).toBeInTheDocument();
    expect(refreshBtn).not.toBeDisabled();

    fireEvent.click(refreshBtn);
    expect(handleRefresh).toHaveBeenCalledTimes(1);
  });

  it("renders upgrade_required state with alert role when user lacks Pro Group entitlement", () => {
    render(
      <GoogleCalendarOverlay
        status="upgrade_required"
        events={[]}
        refreshedAt={null}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/pro group feature subscription required/i);
  });

  it("renders reconnect_required state with alert role when connection is missing", () => {
    render(
      <GoogleCalendarOverlay
        status="reconnect_required"
        events={[]}
        refreshedAt={null}
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/google calendar connection or authorization required/i);
  });

  it("renders stale cache notice when status is stale", () => {
    render(
      <GoogleCalendarOverlay
        status="stale"
        events={mockEvents}
        refreshedAt="2026-07-20T12:00:00Z"
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText(/showing cached events from/i)).toBeInTheDocument();
    expect(screen.getByText(/project review meeting/i)).toBeInTheDocument();
  });

  it("disables refresh button when isLoading is true", () => {
    render(
      <GoogleCalendarOverlay
        status="ready"
        events={mockEvents}
        refreshedAt="2026-07-22T20:00:00Z"
        isLoading={true}
        onRefresh={vi.fn()}
      />
    );

    const refreshBtn = screen.getByRole("button", { name: /refresh google calendar/i });
    expect(refreshBtn).toBeDisabled();
    expect(refreshBtn).toHaveTextContent(/refreshing\.\.\./i);
  });
});
