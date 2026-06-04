import { describe, expect, it } from "vitest";
import { canStudentAccessPrivateContribution, canStudentCreateAppealFor, canStudentCreateWorkLogFor, canStudentLinkWorkLogTask } from "@/lib/studentAccess";
import { appealFormSchema } from "@/lib/studentAppeals";
import { calculateStudentContribution } from "@/lib/studentContribution";
import { validatePeerReviewSubmission } from "@/lib/studentPeerReview";
import { canStudentEditSubmission, canStudentOpenSubmission, canStudentStartTask, isLateSubmission } from "@/lib/studentTaskProgress";
import type { Task } from "@/context/TeamContext";

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  name: "Task demo",
  assignedTo: "Student A",
  assigneeId: "student-a",
  status: "Todo",
  contributionPercent: 20,
  approved: false,
  deadline: "2026-06-10",
  description: "",
  priority: "Medium",
  evidence: [],
  ...overrides,
});

const studentAId = "11111111-1111-1111-1111-111111111111";
const studentBId = "22222222-2222-2222-2222-222222222222";

describe("Student module business rules", () => {
  it("blocks students from accessing another student's private contribution score", () => {
    expect(canStudentAccessPrivateContribution("student-a", "student-a")).toBe(true);
    expect(canStudentAccessPrivateContribution("student-b", "student-a")).toBe(false);
  });

  it("allows start task only for assignee and only when status is To Do", () => {
    const ownTodoTask = makeTask();
    const otherTask = makeTask({ assigneeId: studentBId, assignedTo: "Student B" });
    const inProgressTask = makeTask({ status: "In Progress" });

    expect(canStudentStartTask(ownTodoTask, true).ok).toBe(true);
    expect(canStudentStartTask(otherTask, false)).toEqual({
      ok: false,
      message: "Bạn không có quyền cập nhật task này.",
    });
    expect(canStudentStartTask(inProgressTask, true)).toEqual({
      ok: false,
      message: "Không thể chuyển trạng thái không hợp lệ.",
    });
  });

  it("prevents submitting evidence for tasks not assigned to the student", () => {
    const ownTask = makeTask({ status: "In Progress" });
    const foreignTask = makeTask({ assigneeId: studentBId, assignedTo: "Student B", status: "In Progress" });

    expect(canStudentOpenSubmission(ownTask, true).ok).toBe(true);
    expect(canStudentOpenSubmission(foreignTask, false)).toEqual({
      ok: false,
      message: "Bạn không có quyền cập nhật task này.",
    });
  });

  it("prevents editing an approved submission", () => {
    const approvedTask = makeTask({ approved: true, status: "Done" });
    expect(canStudentEditSubmission(approvedTask, true)).toEqual({
      ok: false,
      message: "Task đã được duyệt nên không thể cập nhật.",
    });
  });

  it("allows resubmission only for need revision or rejected workflows", () => {
    const needRevisionTask = makeTask({ status: "Done", description: "[need_revision]" });
    const rejectedTask = makeTask({ status: "Done", description: "[rejected]" });
    const approvedTask = makeTask({ approved: true, status: "Done" });

    expect(canStudentOpenSubmission(needRevisionTask, true).ok).toBe(true);
    expect(canStudentOpenSubmission(rejectedTask, true).ok).toBe(true);
    expect(canStudentOpenSubmission(approvedTask, true).ok).toBe(false);
  });

  it("marks overdue submissions as late while still allowing submit", () => {
    const overdueTask = makeTask({ status: "In Progress", deadline: "2026-06-01" });
    expect(isLateSubmission(overdueTask)).toBe(true);
    expect(canStudentOpenSubmission(overdueTask, true).ok).toBe(true);
  });

  it("blocks self review and double submission in peer review", () => {
    const period = {
      id: "period-1",
      groupId: "group-1",
      title: "Dot danh gia",
      milestoneLabel: null,
      status: "open" as const,
      startAt: "2026-06-01T00:00:00.000Z",
      endAt: "2026-06-30T23:59:59.000Z",
      allowLeaderSummary: false,
    };
    const targets = [{ id: "student-b", fullName: "Student B", role: "Member" as const }];

    expect(
      validatePeerReviewSubmission({
        currentUserId: studentAId,
        period,
        targets: [{ id: studentBId, fullName: "Student B", role: "Member" }],
        honestyConfirmed: true,
        alreadySubmitted: false,
        reviews: [
          {
            revieweeId: studentAId,
            completionScore: 4,
            deadlineScore: 4,
            collaborationScore: 4,
            responsivenessScore: 4,
            overallScore: 4,
            comment: "",
          },
        ],
      }),
    ).toEqual({ ok: false, message: "Bạn không thể đánh giá chính mình." });

    expect(
      validatePeerReviewSubmission({
        currentUserId: studentAId,
        period,
        targets: [{ id: studentBId, fullName: "Student B", role: "Member" }],
        honestyConfirmed: true,
        alreadySubmitted: true,
        reviews: [
          {
            revieweeId: studentBId,
            completionScore: 4,
            deadlineScore: 4,
            collaborationScore: 4,
            responsivenessScore: 4,
            overallScore: 4,
            comment: "",
          },
        ],
      }),
    ).toEqual({ ok: false, message: "Bạn đã hoàn thành đánh giá chéo cho kỳ này." });
  });

  it("requires comment when peer review contains low scores and blocks closed periods", () => {
    const closedPeriod = {
      id: "period-2",
      groupId: "group-1",
      title: "Dot danh gia dong",
      milestoneLabel: null,
      status: "closed" as const,
      startAt: "2026-06-01T00:00:00.000Z",
      endAt: "2026-06-30T23:59:59.000Z",
      allowLeaderSummary: false,
    };
    const openPeriod = { ...closedPeriod, status: "open" as const };
    const targets = [{ id: studentBId, fullName: "Student B", role: "Member" as const }];

    expect(
      validatePeerReviewSubmission({
        currentUserId: studentAId,
        period: closedPeriod,
        targets,
        honestyConfirmed: true,
        alreadySubmitted: false,
        reviews: [],
      }),
    ).toEqual({ ok: false, message: "Kỳ đánh giá đã đóng." });

    expect(
      validatePeerReviewSubmission({
        currentUserId: studentAId,
        period: openPeriod,
        targets,
        honestyConfirmed: true,
        alreadySubmitted: false,
        reviews: [
          {
            revieweeId: studentBId,
            completionScore: 2,
            deadlineScore: 4,
            collaborationScore: 4,
            responsivenessScore: 4,
            overallScore: 4,
            comment: "ngan",
          },
        ],
      }),
    ).toEqual({ ok: false, message: "Vui lòng nhập nhận xét khi cho điểm thấp." });
  });

  it("creates appeals and work logs only for the current student and only links allowed tasks", () => {
    expect(canStudentCreateAppealFor(studentAId, studentAId)).toBe(true);
    expect(canStudentCreateAppealFor(studentBId, studentAId)).toBe(false);
    expect(canStudentCreateWorkLogFor(studentAId, studentAId)).toBe(true);
    expect(canStudentCreateWorkLogFor(studentBId, studentAId)).toBe(false);
    expect(canStudentLinkWorkLogTask("task-1", ["task-1", "task-2"])).toBe(true);
    expect(canStudentLinkWorkLogTask("task-3", ["task-1", "task-2"])).toBe(false);
  });

  it("validates appeal content and confirmation before submission", () => {
    const invalid = appealFormSchema.safeParse({
      appealType: "risk_flag",
      explanationContent: "quá ngắn",
      confirmationChecked: false,
    });

    expect(invalid.success).toBe(false);
  });

  it("shows risk reasons instead of only a label in contribution result", () => {
    const result = calculateStudentContribution({
      tasks: [
        makeTask({ approved: false, status: "In Progress", deadline: "2026-06-01" }),
        makeTask({ id: "task-2", approved: false, status: "Done", description: "[rejected]", deadline: "2026-06-01" }),
      ],
      workLogs: [],
      peerReviewAverage: 2.4,
      leaderReviews: [],
      now: new Date("2026-06-15T00:00:00.000Z"),
    });

    expect(result.riskLevel).toBe("high");
    expect(result.riskReasons).toContain("Có task trễ hạn.");
    expect(result.riskReasons).toContain("Có task bị từ chối hoặc cần làm lại.");
    expect(result.riskReasons.length).toBeGreaterThan(1);
  });
});
