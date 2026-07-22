import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTaskVisibleToViewer } from "@/lib/taskVisibility";

const mocks = vi.hoisted(() => ({ addTask: vi.fn() }));

vi.mock("@/context/TeamContext", () => ({
  useTeam: () => ({
    groups: [
      {
        id: "group-1",
        name: "Capstone",
        lecturer_id: "lecturer-1",
        members: [
          {
            id: "student-1",
            name: "Ada Lovelace",
            role: "Member",
            completedTasks: 0,
            contributionPercent: 0,
            lecturerScore: null,
          },
          {
            id: "student-2",
            name: "Ada Lovelace",
            role: "Member",
            completedTasks: 0,
            contributionPercent: 0,
            lecturerScore: null,
          },
        ],
        tasks: [],
        activityLog: [],
      },
    ],
    currentGroupIndex: 0,
    setCurrentGroupIndex: vi.fn(),
    updateLecturerScore: vi.fn(),
    addTask: mocks.addTask,
    deleteTask: vi.fn(),
    approveTask: vi.fn(),
    dataLoading: false,
  }),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "lecturer-1" },
    profile: { id: "lecturer-1", role: "lecturer", full_name: "Lecturer One" },
    loading: false,
  }),
}));

vi.mock("@/context/LanguageContext", () => ({ useLanguage: () => ({ language: "en" }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/components/ContributionAnalytics", () => ({ default: () => null }));
vi.mock("@/components/skeletons", () => ({ LecturerDashboardSkeleton: () => null }));

vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  type SelectProps = {
    value?: string;
    onValueChange?: (value: string) => void;
    children?: React.ReactNode;
  };
  return {
    Select: ({ value = "", onValueChange, children }: SelectProps) => React.createElement(
      "select",
      {
        value,
        onChange: (event: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(event.target.value),
      },
      children,
    ),
    SelectTrigger: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    SelectValue: ({ placeholder }: { placeholder?: string }) => React.createElement("option", { value: "" }, placeholder),
    SelectContent: ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    SelectItem: ({ value, children }: { value: string; children?: React.ReactNode }) => React.createElement("option", { value }, children),
  };
});

import LecturerDashboard from "./LecturerDashboard";

function renderDashboard() {
  render(
    <MemoryRouter>
      <LecturerDashboard />
    </MemoryRouter>,
  );
}

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Create Task" }));
}

function fillRequiredFields(assigneeId = "student-1") {
  fireEvent.change(screen.getByPlaceholderText("Nhập tên task"), { target: { value: "Research" } });
  fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: assigneeId } });
}

function submitTask() {
  fireEvent.click(screen.getByRole("button", { name: "Create task" }));
}

beforeEach(() => mocks.addTask.mockReset());
afterEach(cleanup);

describe("LecturerDashboard task priority", () => {
  it("opens and resets with Choose Priority", () => {
    renderDashboard();
    openDialog();

    expect(screen.getAllByRole("combobox")[1]).toHaveValue("");
    expect(screen.getByRole("option", { name: "Choose Priority" })).toBeInTheDocument();

    fillRequiredFields();
    submitTask();
    openDialog();

    expect(screen.getAllByRole("combobox")[1]).toHaveValue("");
  });

  it("submits blank priority as absent", () => {
    renderDashboard();
    openDialog();
    fillRequiredFields();
    submitTask();

    expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({ priority: undefined }));
  });

  it("keeps a newly created task hidden from a duplicate-name viewer before reload", () => {
    renderDashboard();
    openDialog();
    fillRequiredFields("student-2");
    submitTask();

    const optimisticTask = mocks.addTask.mock.calls[0][0];
    expect(optimisticTask).toEqual(expect.objectContaining({
      assignedTo: "Ada Lovelace",
      assigneeId: "student-2",
    }));
    expect(isTaskVisibleToViewer(optimisticTask, {
      id: "student-1",
      name: "Ada Lovelace",
    })).toBe(false);
  });

  it.each(["Low", "Medium", "High"] as const)("preserves %s", (priorityValue) => {
    renderDashboard();
    openDialog();
    fillRequiredFields();
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: priorityValue } });
    submitTask();

    expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({ priority: priorityValue }));
  });
});
