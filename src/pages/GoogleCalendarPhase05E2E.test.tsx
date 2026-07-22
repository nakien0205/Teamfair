import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GoogleCalendarOverlay } from "../components/GoogleCalendarOverlay";
import { GoogleCalendarConnectionCard } from "../components/GoogleCalendarConnectionCard";
import { GoogleOverlayEvent } from "../lib/googleCalendarOverlay";
import * as connectionApi from "@/lib/googleCalendarConnection";

vi.mock("@/lib/googleCalendarConnection", async (importOriginal) => {
  const actual = await importOriginal<typeof connectionApi>();
  return {
    ...actual,
    fetchGoogleCalendarConnectionStatus: vi.fn(),
    startGoogleCalendarAuthorization: vi.fn(),
    setGoogleCalendarOptIn: vi.fn(),
    disconnectGoogleCalendar: vi.fn(),
  };
});

describe("Phase 05 Integrated React UI & Read-Only Overlay Proof", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const sampleEvents: GoogleOverlayEvent[] = [
    {
      providerEventId: "google-evt-e2e-1",
      title: "Google Calendar Private Sprint Demo",
      start: { dateTime: "2026-07-28T14:00:00Z" },
      end: { dateTime: "2026-07-28T15:00:00Z" },
      allDay: false,
      readOnly: true,
      source: "google",
    },
  ];

  it("AC13: renders read-only badge and omits write/edit actions on imported Google events", () => {
    render(
      <GoogleCalendarOverlay
        status="ready"
        events={sampleEvents}
        refreshedAt="2026-07-22T20:00:00Z"
        isLoading={false}
        onRefresh={vi.fn()}
      />
    );

    expect(screen.getByText(/google calendar private sprint demo/i)).toBeInTheDocument();
    expect(screen.getByText(/google calendar · read-only/i)).toBeInTheDocument();

    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("AC1 / AC2: renders Google Calendar Connection Card in disconnected state with OAuth flow trigger", async () => {
    vi.mocked(connectionApi.fetchGoogleCalendarConnectionStatus).mockResolvedValue({
      status: "disconnected",
      optedIn: false,
      grantedScopes: [],
      connectionGeneration: 0,
      attentionCode: null,
      connectedAt: null,
      updatedAt: null,
    });

    vi.mocked(connectionApi.startGoogleCalendarAuthorization).mockResolvedValue(
      "https://accounts.google.com/o/oauth2/v2/auth?mock=1"
    );

    render(<GoogleCalendarConnectionCard userPlan="pro_group" />);

    await waitFor(() => {
      expect(screen.getByText("Google Calendar Integration")).toBeInTheDocument();
      expect(screen.getByText("Connect Account")).toBeInTheDocument();
    });

    const connectBtn = screen.getByRole("button", { name: /connect google calendar/i });
    fireEvent.click(connectBtn);

    await waitFor(() => {
      expect(connectionApi.startGoogleCalendarAuthorization).toHaveBeenCalledTimes(1);
    });
  });

  it("AC2 / AC14: renders connected connection card with opt-in toggle and disconnect button", async () => {
    vi.mocked(connectionApi.fetchGoogleCalendarConnectionStatus).mockResolvedValue({
      status: "connected",
      optedIn: true,
      grantedScopes: ["https://www.googleapis.com/auth/calendar.events"],
      connectionGeneration: 1,
      attentionCode: null,
      connectedAt: "2026-07-22T20:00:00Z",
      updatedAt: "2026-07-22T20:00:00Z",
    });

    vi.mocked(connectionApi.setGoogleCalendarOptIn).mockResolvedValue({
      status: "connected",
      optedIn: false,
      grantedScopes: ["https://www.googleapis.com/auth/calendar.events"],
      connectionGeneration: 1,
      attentionCode: null,
      connectedAt: "2026-07-22T20:00:00Z",
      updatedAt: "2026-07-22T20:01:00Z",
    });

    vi.mocked(connectionApi.disconnectGoogleCalendar).mockResolvedValue({
      status: "disconnected",
      optedIn: false,
      grantedScopes: [],
      connectionGeneration: 2,
      attentionCode: null,
      connectedAt: null,
      updatedAt: "2026-07-22T20:02:00Z",
    });

    render(<GoogleCalendarConnectionCard userPlan="pro_group" />);

    await waitFor(() => {
      expect(screen.getByText("Connected")).toBeInTheDocument();
    });

    const toggle = screen.getByRole("checkbox", { name: /toggle task sync/i });
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    await waitFor(() => {
      expect(connectionApi.setGoogleCalendarOptIn).toHaveBeenCalledWith(false);
    });

    const disconnectBtn = screen.getByRole("button", { name: /disconnect google calendar/i });
    fireEvent.click(disconnectBtn);

    await waitFor(() => {
      expect(connectionApi.disconnectGoogleCalendar).toHaveBeenCalledTimes(1);
    });
  });
});
