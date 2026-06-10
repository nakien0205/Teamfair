import { describe, expect, it, vi } from "vitest";
import type { LecturerStudentReview, Task } from "@/context/TeamContext";
import { buildFallbackFeedback, listStudentFeedback, replyStudentFeedback } from "@/lib/studentFeedback";

vi.mock("@/lib/supabaseClient", () => ({
  isSupabaseConfigured: false,
  supabase: {},
}));

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  name: "Prepare demo",
  assignedTo: "Ada Lovelace",
  assigneeId: "student-1",
  status: "Done",
  contributionPercent: 20,
  approved: false,
  deadline: "2026-06-15",
  description: "",
  priority: "Medium",
  evidence: [],
  ...overrides,
});

const makeReview = (overrides: Partial<LecturerStudentReview> = {}): LecturerStudentReview => ({
  id: "review-1",
  groupId: "group-1",
  studentName: "Ada Lovelace",
  lecturer: "Dr. Nguyen",
  rating: 5,
  comment: "Strong contribution with clear evidence.",
  timestamp: new Date("2026-06-10T08:00:00.000Z"),
  awardBadge: false,
  ...overrides,
});

describe("studentFeedback", () => {
  it("builds fallback feedback from rejected tasks and matching lecturer reviews newest first", () => {
    const feedback = buildFallbackFeedback({
      studentId: "student-1",
      studentName: " ada lovelace ",
      tasks: [
        makeTask({
          id: "task-rejected",
          name: "Final report",
          description: "Needs more evidence. [rejected]",
        }),
      ],
      lecturerReviews: [
        makeReview({
          id: "low-review",
          rating: 2,
          comment: "Evidence is incomplete.",
          timestamp: new Date("2026-06-09T08:00:00.000Z"),
        }),
        makeReview({
          id: "other-student-review",
          studentName: "Grace Hopper",
        }),
      ],
    });

    expect(feedback).toHaveLength(2);
    expect(feedback.map((item) => item.id)).toContain("rejected-task-rejected");
    expect(feedback.map((item) => item.id)).toContain("low-review");
    expect(feedback.map((item) => item.id)).not.toContain("other-student-review");
    expect(feedback[0].createdAt >= feedback[1].createdAt).toBe(true);
    expect(feedback.find((item) => item.id === "low-review")).toMatchObject({
      feedbackType: "warning",
      allowsReply: true,
      suggestedAction: "Rà soát lại minh chứng, task và work log trước mốc đánh giá tiếp theo.",
    });
  });

  it("uses the configured fallback list when Supabase is unavailable", async () => {
    const fallback = buildFallbackFeedback({
      studentId: "student-1",
      studentName: "Ada Lovelace",
      tasks: [makeTask({ description: "[rejected]" })],
      lecturerReviews: [],
    });

    await expect(listStudentFeedback("student-1", fallback)).resolves.toBe(fallback);
    await expect(listStudentFeedback("student-1")).resolves.toEqual([]);
  });

  it("requires clear reply text before attempting persistence", async () => {
    await expect(replyStudentFeedback("feedback-1", "too short")).rejects.toThrow(
      "Vui lòng nhập nội dung phản hồi rõ ràng hơn.",
    );
    await expect(replyStudentFeedback("feedback-1", "Tôi sẽ bổ sung minh chứng chi tiết hơn.")).resolves.toBeUndefined();
  });
});
