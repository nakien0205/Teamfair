import { describe, expect, it, vi } from "vitest";
import { calculateContributionScore, invokeTeamApi, normalizeInviteCode, TeamApiError } from "./teamApi";
import { supabase } from "./supabaseClient";

vi.mock("./supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

const invokeMock = vi.mocked(supabase.functions.invoke);

describe("teamApi", () => {
  it("normalizes invite codes before API submission", () => {
    expect(normalizeInviteCode("  iv-a1b2c3  ")).toBe("IV-A1B2C3");
  });

  it("uses the documented contribution score formula", () => {
    expect(calculateContributionScore({ completedTasks: 0, contributionPercent: 0 })).toBe(0);
    expect(calculateContributionScore({ completedTasks: 1, contributionPercent: 50 })).toBe(50);
    expect(calculateContributionScore({ completedTasks: 4, contributionPercent: 100 })).toBe(100);
  });

  it("returns data from successful API responses", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { ok: true, data: { value: 42 } },
      error: null,
    });

    await expect(invokeTeamApi("calculate_contribution_snapshot", { groupId: "group-1" })).resolves.toEqual({ value: 42 });
  });

  it("throws typed errors from API error responses", async () => {
    invokeMock.mockResolvedValueOnce({
      data: { ok: false, error: { code: "forbidden", message: "No access" } },
      error: null,
    });

    await expect(invokeTeamApi("list_invites", { groupId: "group-1" })).rejects.toMatchObject<TeamApiError>({
      code: "forbidden",
      message: "No access",
    });
  });
});
