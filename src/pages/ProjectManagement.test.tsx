import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  userId: "viewer-1",
  fullName: "Viewer One",
  role: "student" as "student" | "lecturer" | "admin",
  memberRole: "Member",
}));

vi.mock("@/context/TeamContext", () => ({
  useTeam: () => ({
    groups: [
      {
        id: "group-1",
        name: "Capstone",
        owner_id: state.memberRole === "Leader" ? state.userId : "owner-1",
        lecturer_id: state.role === "lecturer" ? state.userId : "lecturer-1",
        members: [
          {
            id: state.userId,
            name: state.fullName,
            role: state.memberRole,
            completedTasks: 0,
            contributionPercent: 0,
            lecturerScore: null,
          },
        ],
        tasks: [
          {
            id: "task-own",
            name: "Viewer deadline",
            assignedTo: state.fullName,
            assigneeId: state.userId,
            status: "Todo",
            contributionPercent: 10,
            approved: false,
            deadline: "2026-07-22",
          },
          {
            id: "task-other",
            name: "Other deadline",
            assignedTo: state.fullName,
            assigneeId: "other-user",
            status: "Todo",
            contributionPercent: 10,
            approved: false,
            deadline: "2026-07-22",
          },
        ],
        activityLog: [],
      },
    ],
    setCurrentGroupIndex: vi.fn(),
    createProject: vi.fn(),
    joinProject: vi.fn(),
    deleteProject: vi.fn(),
    currentUserName: state.fullName,
    dataLoading: false,
    pendingJoinRequests: [],
    fetchPendingJoinRequests: vi.fn(),
    approveJoinRequest: vi.fn(),
    rejectJoinRequest: vi.fn(),
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: state.userId },
    profile: {
      id: state.userId,
      full_name: state.fullName,
      email: "viewer@example.com",
      role: state.role,
      last_name_change_at: null,
    },
    signOut: vi.fn(),
    updateProfileName: vi.fn(),
  }),
}));

vi.mock("@/context/LanguageContext", () => ({
  useLanguage: () => ({ language: "en" }),
}));

vi.mock("@/context/NotificationContext", () => ({
  useNotifications: () => ({
    notifications: [],
    unreadCount: 0,
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  },
}));

vi.mock("@/components/OnboardingNameModal", () => ({ OnboardingNameModal: () => null }));
vi.mock("@/components/SettingsModal", () => ({ SettingsModal: () => null }));
vi.mock("@/components/NotificationDetailModal", () => ({ default: () => null }));

import ProjectManagement, { isExactProjectNameConfirmation } from "./ProjectManagement";

function renderGlobalCalendar() {
  render(
    <MemoryRouter>
      <ProjectManagement />
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Global Calendar" }));
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("project deletion confirmation", () => {
  it("requires the exact rendered project name before deletion can proceed", () => {
    expect(isExactProjectNameConfirmation("Capstone", "Capstone")).toBe(true);
    expect(isExactProjectNameConfirmation("capstone", "Capstone")).toBe(false);
    expect(isExactProjectNameConfirmation("Capstone ", "Capstone")).toBe(false);
    expect(isExactProjectNameConfirmation("Capstone", undefined)).toBe(false);
  });
});

describe("Global Calendar", () => {
  it("should open Global Calendar on the current month and highlight today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 12, 0, 0));

    renderGlobalCalendar();

    expect(screen.getByText("July 2026")).toBeInTheDocument();
    expect(screen.getByText("22")).toHaveClass("text-indigo-400");
  });

  it.each([
    ["student", "student", "Member"],
    ["leader", "student", "Leader"],
    ["admin", "admin", "Member"],
    ["lecturer", "lecturer", "Lecturer"],
  ] as const)("isolates present assignee IDs for %s", (_label, role, memberRole) => {
    state.role = role;
    state.memberRole = memberRole;
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 12, 0, 0));

    renderGlobalCalendar();

    expect(screen.getByText("Viewer deadline")).toBeInTheDocument();
    expect(screen.queryByText("Other deadline")).not.toBeInTheDocument();
  });
});
