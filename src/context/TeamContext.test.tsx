import { describe, expect, it } from "vitest";
import { clearLastProjectAfterDeletion, nextGroupIndexAfterDeletion } from "./TeamContext";

describe("project deletion context state", () => {
  it("keeps the selected project stable after deleting another project and selects a valid neighbor after deleting the active one", () => {
    expect(nextGroupIndexAfterDeletion(1, 0, 3)).toBe(0);
    expect(nextGroupIndexAfterDeletion(1, 1, 3)).toBe(1);
    expect(nextGroupIndexAfterDeletion(2, 2, 3)).toBe(1);
    expect(nextGroupIndexAfterDeletion(0, 0, 1)).toBe(0);
  });

  it("clears only the deleted project from the current user's last-project key", () => {
    localStorage.setItem("teamfair_last_project_user-a", "project-a");
    localStorage.setItem("teamfair_last_project_user-b", "project-b");

    clearLastProjectAfterDeletion("user-a", "project-a");

    expect(localStorage.getItem("teamfair_last_project_user-a")).toBeNull();
    expect(localStorage.getItem("teamfair_last_project_user-b")).toBe("project-b");
  });
});
