import { describe, expect, it } from "vitest";
import { buildRevisionTaskEmailPayload } from "./taskEmailPayload";

describe("revision task email payload", () => {
  it("omits blank priority", () => {
    const payload = buildRevisionTaskEmailPayload({
      assigneeId: "student-1",
      task: { name: "Research", deadline: "2026-07-22", priority: undefined },
      groupName: "Capstone",
      feedback: "Add citations",
    });

    expect(payload.priority).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("Medium");
  });

  it.each(["Low", "Medium", "High"] as const)("preserves %s", (priority) => {
    expect(buildRevisionTaskEmailPayload({
      assigneeId: "student-1",
      task: { name: "Research", deadline: "2026-07-22", priority },
      feedback: "Add citations",
    }).priority).toBe(priority);
  });
});
