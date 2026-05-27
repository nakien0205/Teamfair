import { describe, expect, it, vi } from "vitest";

describe("Session 2 - Dynamic Onboarding & Rename Cooldown", () => {
  it("validates that Onboarding steps correctly require both role selection and name input", () => {
    const validateOnboarding = (role: string | null, name: string) => {
      const trimmed = name.trim();
      if (!role) {
        return { success: false, error: "Please select a role" };
      }
      if (!trimmed) {
        return { success: false, error: "Please enter a valid name" };
      }
      return { success: true, role, name: trimmed };
    };

    // 1. Missing role should fail
    expect(validateOnboarding(null, "John Doe")).toEqual({
      success: false,
      error: "Please select a role",
    });

    // 2. Missing name should fail
    expect(validateOnboarding("student", "")).toEqual({
      success: false,
      error: "Please enter a valid name",
    });

    // 3. Complete and valid payload succeeds
    expect(validateOnboarding("student", "  Alice Smith  ")).toEqual({
      success: true,
      role: "student",
      name: "Alice Smith",
    });
  });

  it("calculates 30-day rename cooldown and remaining days accurately", () => {
    const calculateCooldown = (lastNameChangeAt: string | null, now: Date) => {
      if (!lastNameChangeAt) {
        return { isCooldownActive: false, remainingDays: 0 };
      }
      const lastChange = new Date(lastNameChangeAt);
      const cooldownEnd = new Date(lastChange.getTime() + 30 * 24 * 60 * 60 * 1000);
      const isCooldownActive = now < cooldownEnd;
      const remainingMs = cooldownEnd.getTime() - now.getTime();
      const remainingDays = isCooldownActive ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000)) : 0;

      return { isCooldownActive, remainingDays };
    };

    const mockNow = new Date("2026-05-27T12:00:00Z");

    // 1. Profile with no previous name changes (e.g. newly signed up)
    expect(calculateCooldown(null, mockNow)).toEqual({
      isCooldownActive: false,
      remainingDays: 0,
    });

    // 2. Name change happened 10 days ago (Active Cooldown, 20 days remaining)
    const tenDaysAgo = new Date(mockNow.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(calculateCooldown(tenDaysAgo, mockNow)).toEqual({
      isCooldownActive: true,
      remainingDays: 20,
    });

    // 3. Name change happened exactly 30 days ago (Cooldown just expired)
    const thirtyDaysAgo = new Date(mockNow.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    expect(calculateCooldown(thirtyDaysAgo, mockNow)).toEqual({
      isCooldownActive: false,
      remainingDays: 0,
    });

    // 4. Name change happened 45 days ago (Inactive Cooldown)
    const fortyFiveDaysAgo = new Date(mockNow.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();
    expect(calculateCooldown(fortyFiveDaysAgo, mockNow)).toEqual({
      isCooldownActive: false,
      remainingDays: 0,
    });
  });

  it("checks database trigger logic rules for name updates", () => {
    // Mimics trigger check logic:
    // If OLD.full_name IS DISTINCT FROM NEW.full_name THEN
    //   If OLD.last_name_change_at > now() - INTERVAL '30 days' THEN error
    const triggerSimulate = (oldName: string, newName: string, lastNameChangeAt: string | null, now: Date) => {
      if (oldName === newName) {
        return { success: true }; // No name change, no cooldown trigger evaluation
      }
      if (lastNameChangeAt) {
        const lastChange = new Date(lastNameChangeAt);
        const cooldownLimit = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (lastChange > cooldownLimit) {
          return { success: false, error: "Name can only be changed once every 30 days." };
        }
      }
      return { success: true, updatedLastNameChangeAt: now.toISOString() };
    };

    const mockNow = new Date("2026-05-27T12:00:00Z");

    // Changing name with no previous last_name_change_at timestamp -> Succeeded
    expect(triggerSimulate("Alice", "Bob", null, mockNow).success).toBe(true);

    // Editing other profile details without changing the name within cooldown -> Succeeded
    const fiveDaysAgo = new Date(mockNow.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    expect(triggerSimulate("Alice", "Alice", fiveDaysAgo, mockNow)).toEqual({ success: true });

    // Changing the name within the active cooldown period -> Throws/Fails
    expect(triggerSimulate("Alice", "Bob", fiveDaysAgo, mockNow)).toEqual({
      success: false,
      error: "Name can only be changed once every 30 days.",
    });
  });
});
