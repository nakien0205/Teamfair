import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/context/TeamContext";

vi.mock("@/context/TeamContext", () => ({
  useTeam: () => ({
    members: [{ id: "student-1", name: "Ada Lovelace" }],
    groups: [{ id: "group-1", name: "Capstone" }],
    currentGroupIndex: 0,
  }),
}));

vi.mock("@/context/LanguageContext", () => ({ useLanguage: () => ({ language: "en" }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/workLogs", () => ({ listStudentWorkLogs: vi.fn().mockResolvedValue([]) }));
vi.mock("@/lib/storage", () => ({ createSignedFileUrl: vi.fn() }));
vi.mock("@/lib/contributionAi", () => ({ fetchTaskVerification: vi.fn() }));
vi.mock("@/components/ui/dialog", async () => {
  const React = await import("react");
  const Wrapper = ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children);
  return {
    Dialog: Wrapper,
    DialogContent: Wrapper,
    DialogHeader: Wrapper,
    DialogTitle: Wrapper,
    DialogFooter: Wrapper,
    DialogDescription: Wrapper,
  };
});

import TaskApprovalDialog from "./TaskApprovalDialog";

const baseTask: Task = {
  id: "task-1",
  name: "Research",
  assignedTo: "Ada Lovelace",
  assigneeId: "student-1",
  status: "Done",
  contributionPercent: 40,
  approved: false,
  deadline: "2026-07-22",
};

function renderDialog(task: Task) {
  render(
    <TaskApprovalDialog
      open
      onOpenChange={vi.fn()}
      task={task}
      onApprove={vi.fn()}
      onNeedRevision={vi.fn()}
    />,
  );
}

afterEach(cleanup);

describe("TaskApprovalDialog priority", () => {
  it("omits absent priority from the approval screen", () => {
    renderDialog(baseTask);

    expect(screen.queryByText("Priority")).not.toBeInTheDocument();
    expect(screen.queryByText("Medium")).not.toBeInTheDocument();
  });

  it.each(["Low", "Medium", "High"] as const)("preserves explicit %s", (priority) => {
    renderDialog({ ...baseTask, priority });

    expect(screen.getByText("Priority")).toBeInTheDocument();
    expect(screen.getByText(priority)).toBeInTheDocument();
  });
});
