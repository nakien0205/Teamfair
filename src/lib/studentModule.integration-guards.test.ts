import { describe, expect, it, vi } from "vitest";
import type { Group, Task } from "@/context/TeamContext";
import { getAccessibleRubricProjects, canAccessRubricProject } from "@/lib/rubricProjectAccess";
import { dashboardPathForRole } from "@/lib/dashboardPath";
import { getTaskReviewStatus, getTaskWorkflowStatus, isTaskOverdue } from "@/lib/studentWorkflow";
import { isTaskAssignedToStudent } from "@/lib/studentTaskProgress";
import { createTaskSubmission, uploadTaskEvidenceFiles } from "@/lib/taskSubmissions";
import { uploadWorkLogAttachment } from "@/lib/workLogs";
import { createStudentAppeal, uploadAppealAttachment } from "@/lib/studentAppeals";

vi.mock("@/lib/supabaseClient", () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  name: "Prepare demo",
  assignedTo: "Ada Lovelace",
  assigneeId: "student-1",
  status: "Todo",
  contributionPercent: 20,
  approved: false,
  deadline: "2026-06-15",
  description: "",
  priority: "Medium",
  evidence: [],
  ...overrides,
});

const makeGroup = (overrides: Partial<Group>): Group => ({
  id: "group-1",
  name: "Capstone",
  lecturer_id: "lecturer-1",
  members: [],
  tasks: [],
  activityLog: [],
  ...overrides,
});

describe("student module integration guards", () => {
  it("routes users to the role-specific dashboard after auth", () => {
    expect(dashboardPathForRole("student")).toBe("/student/dashboard");
    expect(dashboardPathForRole("lecturer")).toBe("/dashboard-lecturer");
    expect(dashboardPathForRole("admin")).toBe("/dashboard-lecturer");
    expect(dashboardPathForRole(null)).toBe("/student/dashboard");
  });

  it("keeps rubric project access scoped to admins or the owning lecturer", () => {
    const groups = [
      makeGroup({ id: "group-owned", lecturer_id: "lecturer-1" }),
      makeGroup({ id: "group-other", lecturer_id: "lecturer-2" }),
    ];

    expect(getAccessibleRubricProjects(groups, "lecturer-1", "lecturer").map((group) => group.id)).toEqual([
      "group-owned",
    ]);
    expect(getAccessibleRubricProjects(groups, "admin-1", "admin").map((group) => group.id)).toEqual([
      "group-owned",
      "group-other",
    ]);
    expect(getAccessibleRubricProjects(groups, "student-1", "student")).toEqual([]);

    expect(canAccessRubricProject("group-owned", groups, "lecturer-1", "lecturer")).toBe(true);
    expect(canAccessRubricProject("group-other", groups, "lecturer-1", "lecturer")).toBe(false);
    expect(canAccessRubricProject(null, groups, "admin-1", "admin")).toBe(false);
  });

  it("classifies task workflow and review status without marking approved or invalid-date tasks overdue", () => {
    const now = new Date("2026-06-20T12:00:00.000Z");

    expect(getTaskWorkflowStatus(makeTask({ approved: true, deadline: "2026-06-01" }), now)).toBe("approved");
    expect(getTaskReviewStatus(makeTask({ description: "[need_revision]", status: "Done" }), now)).toBe(
      "need_revision",
    );
    expect(getTaskWorkflowStatus(makeTask({ description: "[rejected]", status: "Done" }), now)).toBe("rejected");
    expect(isTaskOverdue(makeTask({ deadline: "not-a-date" }), now)).toBe(false);
  });

  it("matches student task ownership by stable user id before falling back to normalized name", () => {
    expect(isTaskAssignedToStudent(makeTask({ assigneeId: "student-1" }), "student-1", "Different Name")).toBe(true);
    expect(isTaskAssignedToStudent(makeTask({ assigneeId: undefined }), null, "  ADA LOVELACE  ")).toBe(true);
    expect(isTaskAssignedToStudent(makeTask({ assigneeId: "student-2" }), "student-1", "Ada Lovelace")).toBe(true);
    expect(isTaskAssignedToStudent(makeTask(), "student-2", "Grace Hopper")).toBe(false);
  });

  it("creates offline task submissions with pending-review status and sanitized evidence metadata", async () => {
    const evidence = await uploadTaskEvidenceFiles({
      groupId: "group-1",
      taskId: "task-1",
      studentId: "student-1",
      files: [new File(["demo"], "demo report (final).pdf", { type: "application/pdf" })],
    });

    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({
      fileName: "demo_report__final_.pdf",
      fileSize: 4,
      mimeType: "application/pdf",
    });
    expect(evidence[0].storagePath).toBeUndefined();

    const submission = await createTaskSubmission({
      taskId: "task-1",
      groupId: "group-1",
      studentId: "student-1",
      submissionNote: "Finished the requested prototype evidence.",
      evidenceLinks: ["https://example.com/demo"],
      evidenceFiles: evidence,
      checklistConfirmed: true,
      lateReason: null,
      isLate: false,
    });

    expect(submission).toMatchObject({
      taskId: "task-1",
      groupId: "group-1",
      studentId: "student-1",
      submissionStatus: "pending_review",
      evidenceLinks: ["https://example.com/demo"],
      evidenceFiles: evidence,
      checklistConfirmed: true,
      isLate: false,
    });
  });

  it("sanitizes offline work-log and appeal attachment metadata without storage paths", async () => {
    const workLogAttachment = await uploadWorkLogAttachment({
      groupId: "group-1",
      studentId: "student-1",
      file: new File(["hours"], "week 1 notes!.txt", { type: "text/plain" }),
    });
    const appealAttachment = await uploadAppealAttachment({
      groupId: "group-1",
      studentId: "student-1",
      file: new File(["appeal"], "appeal evidence#.png", { type: "image/png" }),
    });

    expect(workLogAttachment).toMatchObject({
      fileName: "week_1_notes_.txt",
      fileSize: 5,
      mimeType: "text/plain",
    });
    expect(workLogAttachment.storagePath).toBeUndefined();
    expect(appealAttachment).toMatchObject({
      fileName: "appeal_evidence_.png",
      fileSize: 6,
      mimeType: "image/png",
    });
    expect(appealAttachment.storagePath).toBeUndefined();
  });

  it("creates offline student appeals as drafts with student-owned payload data", async () => {
    const appeal = await createStudentAppeal({
      groupId: "group-1",
      studentId: "student-1",
      appealType: "low_contribution",
      relatedTaskId: "task-1",
      relatedFeedbackId: null,
      relatedPeriodId: null,
      relatedMilestone: "Milestone 1",
      explanationContent:
        "I am providing additional context for the contribution calculation with supporting evidence and work logs.",
      evidenceLinks: ["https://example.com/context"],
      attachments: [],
      status: "draft",
    });

    expect(appeal).toMatchObject({
      groupId: "group-1",
      studentId: "student-1",
      appealType: "low_contribution",
      relatedTaskId: "task-1",
      relatedMilestone: "Milestone 1",
      evidenceLinks: ["https://example.com/context"],
      status: "draft",
      submittedAt: null,
    });
  });
});
