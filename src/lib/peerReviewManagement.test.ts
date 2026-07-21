import { describe, expect, it } from "vitest";
import { canManagePeerReview, getPeerReviewEligibleTasks } from "@/lib/peerReviewManagement";
import { getTaskScopedPeerReviewTargets, validatePeerReviewSubmission } from "@/lib/studentPeerReview";
import type { Task } from "@/context/TeamContext";

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1", name: "Evidence", assignedTo: "Student B", assigneeId: "student-b", status: "Todo",
  contributionPercent: 20, approved: false, deadline: "2026-08-01", ...overrides,
});

describe("task scoped peer review", () => {
  it("limits period management to lecturer, admin, or current group leader", () => {
    expect(canManagePeerReview("lecturer", false)).toBe(true);
    expect(canManagePeerReview("admin", false)).toBe(true);
    expect(canManagePeerReview("student", true)).toBe(true);
    expect(canManagePeerReview("student", false)).toBe(false);
  });

  it("only permits task scope candidates with stable assignments", () => {
    expect(getPeerReviewEligibleTasks([task(), task({ id: "task-2", assigneeId: undefined })]).map(item => item.id)).toEqual(["task-1"]);
  });

  it("removes self-owned selected tasks while preserving multiple tasks for another member", () => {
    const targets = getTaskScopedPeerReviewTargets([
      { id: "student-a", fullName: "A", role: "Member", periodTaskId: "scope-a", taskTitle: "Own" },
      { id: "student-b", fullName: "B", role: "Member", periodTaskId: "scope-b1", taskTitle: "One" },
      { id: "student-b", fullName: "B", role: "Member", periodTaskId: "scope-b2", taskTitle: "Two" },
    ], "student-a");
    expect(targets.map(item => item.periodTaskId)).toEqual(["scope-b1", "scope-b2"]);
  });

  it("requires every selected task exactly once and keeps low-score comment rule", () => {
    const period = { id: "period", groupId: "group", title: "Review", milestoneLabel: null, status: "open" as const, startAt: "2026-07-01T00:00:00Z", endAt: "2030-07-01T00:00:00Z", allowLeaderSummary: true };
    const studentA = "11111111-1111-4111-8111-111111111111";
    const studentB = "22222222-2222-4222-8222-222222222222";
    const targets = [
      { id: studentB, fullName: "B", role: "Member" as const, periodTaskId: "scope-b1" },
      { id: studentB, fullName: "B", role: "Member" as const, periodTaskId: "scope-b2" },
    ];
    const base = { revieweeId: studentB, completionScore: 4, deadlineScore: 4, collaborationScore: 4, responsivenessScore: 4, overallScore: 4, comment: "" };
    expect(validatePeerReviewSubmission({ currentUserId: studentA, period, targets, honestyConfirmed: true, reviews: [{ ...base, periodTaskId: "scope-b1" }] }).ok).toBe(false);
    expect(validatePeerReviewSubmission({ currentUserId: studentA, period, targets, honestyConfirmed: true, reviews: [{ ...base, periodTaskId: "33333333-3333-4333-8333-333333333333" }, { ...base, periodTaskId: "scope-b2" }] })).toEqual({ ok: false, message: "Vui lòng đánh giá đầy đủ tất cả thành viên." });
    expect(validatePeerReviewSubmission({ currentUserId: studentA, period, targets, honestyConfirmed: true, reviews: [{ ...base, periodTaskId: "scope-b1" }, { ...base, periodTaskId: "scope-b2", overallScore: 2, comment: "short" }] })).toEqual({ ok: false, message: "Vui lòng nhập nhận xét khi cho điểm thấp." });
  });
});
