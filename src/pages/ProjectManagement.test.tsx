import { describe, expect, it } from "vitest";
import { isExactProjectNameConfirmation } from "./ProjectManagement";

describe("project deletion confirmation", () => {
  it("requires the exact rendered project name before deletion can proceed", () => {
    expect(isExactProjectNameConfirmation("Capstone", "Capstone")).toBe(true);
    expect(isExactProjectNameConfirmation("capstone", "Capstone")).toBe(false);
    expect(isExactProjectNameConfirmation("Capstone ", "Capstone")).toBe(false);
    expect(isExactProjectNameConfirmation("Capstone", undefined)).toBe(false);
  });
});
