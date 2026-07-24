import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isTaskVisibleToViewer } from "@/lib/taskVisibility";

const mocks = vi.hoisted(() => ({
  addTask: vi.fn().mockResolvedValue({ id: "task-1" }),
  invoke: vi.fn().mockResolvedValue({ data: null, error: null }),
  canUsePriority: false,
}));

vi.mock("@/context/TeamContext", () => ({
  useTeam: () => ({
    groups: [{ id: "group-1", name: "Capstone" }],
    currentGroupIndex: 0,
    tasks: [],
    members: [
      { id: "member-1", name: "Ada Lovelace" },
      { id: "member-2", name: "Ada Lovelace" },
    ],
    addTask: mocks.addTask,
    updateTaskStatus: vi.fn(),
    deleteTask: vi.fn(),
    currentUserName: "Leader One",
  }),
}));

vi.mock("@/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "leader-1" } }) }));
vi.mock("@/context/LanguageContext", () => ({ useLanguage: () => ({ language: "en" }) }));
vi.mock("@/context/NotificationContext", () => ({ useNotifications: () => ({ sendNotification: vi.fn() }) }));
vi.mock("@/context/EntitlementContext", () => ({ useEntitlements: () => ({ plan: "test-plan" }) }));
vi.mock("@/lib/billing", () => ({ hasProGroupFeatures: () => mocks.canUsePriority }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { functions: { invoke: mocks.invoke } } }));

vi.mock("@/components/ui/select", async () => {
  const React = await import("react");
  type SelectProps = {
    value?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
    children?: React.ReactNode;
  };
  return {
    Select: ({ value = "", onValueChange, disabled, children }: SelectProps) => React.createElement(
      "select",
      {
        value,
        disabled,
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

import KanbanBoard from "./KanbanBoard";

function openDialog() {
  fireEvent.click(screen.getByRole("button", { name: "Create Task" }));
}

function fillRequiredFields(assigneeId = "member-1") {
  fireEvent.change(screen.getByPlaceholderText("Task title"), { target: { value: "Research" } });
  fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: assigneeId } });
}

async function submitTask() {
  await act(async () => {
    const buttons = screen.getAllByRole("button", { name: "Create Task" });
    fireEvent.click(buttons[buttons.length - 1]);
  });
}

beforeEach(() => {
  mocks.addTask.mockReset();
  mocks.addTask.mockResolvedValue({ id: "task-1" });
  mocks.invoke.mockClear();
  mocks.canUsePriority = false;
});

afterEach(cleanup);

describe("KanbanBoard task priority", () => {
  it("opens and resets with Choose Priority", async () => {
    render(<KanbanBoard isLeader currentUser="Leader One" />);
    openDialog();

    const priority = screen.getAllByRole("combobox")[1];
    expect(priority).toHaveValue("");
    expect(screen.getByRole("option", { name: "Choose Priority" })).toBeInTheDocument();

    fillRequiredFields();
    await submitTask();
    openDialog();

    expect(screen.getAllByRole("combobox")[1]).toHaveValue("");
  });

  it("persists blank priority through task and email submission", async () => {
    render(<KanbanBoard isLeader currentUser="Leader One" />);
    openDialog();
    fillRequiredFields();
    fireEvent.click(screen.getByLabelText("Send email"));
    await submitTask();

    expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({ priority: undefined }));
    expect(mocks.invoke).toHaveBeenCalledWith(
      "send-task-email",
      expect.objectContaining({ body: expect.objectContaining({ priority: undefined }) }),
    );
  });

  it("keeps a newly created task hidden from a duplicate-name viewer before reload", async () => {
    render(<KanbanBoard isLeader currentUser="Leader One" />);
    openDialog();
    fillRequiredFields("member-2");
    fireEvent.click(screen.getByLabelText("Send email"));
    await submitTask();

    const optimisticTask = mocks.addTask.mock.calls[0][0];
    expect(optimisticTask).toEqual(expect.objectContaining({
      assignedTo: "Ada Lovelace",
      assigneeId: "member-2",
    }));
    expect(isTaskVisibleToViewer(optimisticTask, {
      id: "member-1",
      name: "Ada Lovelace",
    })).toBe(false);
    expect(mocks.invoke).toHaveBeenCalledWith(
      "send-task-email",
      expect.objectContaining({
        body: expect.objectContaining({ assigneeId: "member-2", priority: undefined }),
      }),
    );
  });

  it.each(["Low", "Medium", "High"] as const)("preserves paid %s", async (priorityValue) => {
    mocks.canUsePriority = true;
    render(<KanbanBoard isLeader currentUser="Leader One" />);
    openDialog();
    fillRequiredFields();
    fireEvent.change(screen.getAllByRole("combobox")[1], { target: { value: priorityValue } });
    await submitTask();

    expect(mocks.addTask).toHaveBeenCalledWith(expect.objectContaining({ priority: priorityValue }));
  });
});
