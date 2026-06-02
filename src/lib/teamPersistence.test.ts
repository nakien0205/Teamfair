import { describe, expect, it } from "vitest";
import {
  buildTaskInsert,
  mapTeamRowsToSnapshot,
  taskStatusFromDb,
  taskStatusToDb,
} from "./teamPersistence";

describe("teamPersistence", () => {
  it("maps task status values between UI and Supabase", () => {
    expect(taskStatusToDb("Todo")).toBe("todo");
    expect(taskStatusToDb("In Progress")).toBe("in_progress");
    expect(taskStatusToDb("Done")).toBe("done");

    expect(taskStatusFromDb("todo")).toBe("Todo");
    expect(taskStatusFromDb("in_progress")).toBe("In Progress");
    expect(taskStatusFromDb("done")).toBe("Done");
  });

  it("builds a task insert payload with assignee identity and bounded legacy weight", () => {
    expect(
      buildTaskInsert("group-1", {
        name: "Research",
        assignedTo: "Ada Lovelace",
        assigneeId: "student-1",
        status: "Todo",
        contributionPercent: 80,
        approved: false,
        deadline: "2026-06-01",
        description: "Read sources",
        priority: "High",
      }),
    ).toEqual({
      group_id: "group-1",
      title: "Research",
      description: "Read sources",
      assignee_id: "student-1",
      status: "todo",
      weight: 8,
      contribution_percent: 80,
      approved: false,
      deadline: "2026-06-01",
      priority: "High",
      evidence: [],
    });
  });

  it("maps persisted rows into the TeamContext snapshot shape", () => {
    const snapshot = mapTeamRowsToSnapshot({
      groups: [{ id: "group-1", project_name: "Capstone" }],
      members: [
        {
          group_id: "group-1",
          student_id: "student-1",
          users: { id: "student-1", full_name: "Ada Lovelace", role: "student" },
        },
        {
          group_id: "group-1",
          student_id: "student-2",
          users: { id: "student-2", full_name: "Grace Hopper", role: "student" },
        },
      ],
      tasks: [
        {
          id: "task-1",
          group_id: "group-1",
          title: "Prototype",
          description: "Build first pass",
          assignee_id: "student-1",
          status: "done",
          weight: 5,
          contribution_percent: 60,
          approved: true,
          deadline: "2026-06-10",
          priority: "Medium",
          evidence: [{ fileName: "demo.pdf", uploadTime: "2026-05-01T00:00:00.000Z" }],
        },
        {
          id: "task-2",
          group_id: "group-1",
          title: "Report",
          description: null,
          assignee_id: "student-2",
          status: "in_progress",
          weight: 4,
          contribution_percent: 40,
          approved: false,
          deadline: null,
          priority: null,
          evidence: [],
        },
      ],
      activityLogs: [
        {
          id: "log-1",
          group_id: "group-1",
          description: "Prototype approved",
          created_at: "2026-05-02T00:00:00.000Z",
        },
      ],
      reports: [
        {
          id: "report-1",
          group_id: "group-1",
          from_name: "Ada Lovelace",
          to_name: "Grace Hopper",
          reason: "Blocked",
          notes: "Needs help",
          reviewed: false,
          created_at: "2026-05-03T00:00:00.000Z",
        },
      ],
      materials: [
        {
          id: "material-1",
          group_id: "group-1",
          file_name: "Rubric.pdf",
          file_size: 1024,
          uploaded_by_name: "Lecturer",
          created_at: "2026-05-04T00:00:00.000Z",
        },
      ],
      lecturerStudentReviews: [
        {
          id: "review-1",
          group_id: "group-1",
          student_name: "Ada Lovelace",
          rating: 5,
          comment: "Strong work",
          award_badge: true,
          created_at: "2026-05-05T00:00:00.000Z",
        },
      ],
      verifiedBadges: [
        {
          id: "badge-1",
          group_id: "group-1",
          student_name: "Ada Lovelace",
          rating: 5,
          comment: "Strong work",
          awarded_at: "2026-05-05T00:00:00.000Z",
          link: "https://www.linkedin.com/",
        },
      ],
    });

    expect(snapshot.groups[0].members).toEqual([
      {
        id: "student-1",
        name: "Ada Lovelace",
        role: "Member",
        completedTasks: 1,
        contributionPercent: 100,
        lecturerScore: null,
        globalRole: "student",
      },
      {
        id: "student-2",
        name: "Grace Hopper",
        role: "Member",
        completedTasks: 0,
        contributionPercent: 0,
        lecturerScore: null,
        globalRole: "student",
      },
    ]);
    expect(snapshot.groups[0].tasks[0].evidence?.[0].uploadTime).toBeInstanceOf(Date);
    expect(snapshot.reports[0].timestamp).toBeInstanceOf(Date);
    expect(snapshot.materialsByGroupId["group-1"][0].fileName).toBe("Rubric.pdf");
    expect(snapshot.lecturerStudentReviews[0].lecturer).toBe("lecturer");
    expect(snapshot.studentBadges[0].awardedAt).toBeInstanceOf(Date);
  });
});
