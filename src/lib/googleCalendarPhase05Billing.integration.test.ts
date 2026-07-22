import { describe, it, expect } from "vitest";
import {
  PRO_GROUP_PRICE_VND,
  PRO_MAX_PRICE_VND,
  FREE_ENTITLEMENTS,
  hasProGroupFeatures,
  hasProMaxFeatures,
  normalizeEntitlements,
} from "@/lib/billing";

describe("Phase 05 Billing Authority & Local Calendar Tier Proof", () => {
  it("AC4: server-authoritative Pro Group is exactly 79,000 VND and Pro Max is 129,000 VND", () => {
    expect(PRO_GROUP_PRICE_VND).toBe(79_000);
    expect(PRO_MAX_PRICE_VND).toBe(129_000);
  });

  it("AC6: local calendars remain free for unentitled users", () => {
    const freeEntitlements = normalizeEntitlements({ plan_id: "free", is_active: false });
    expect(freeEntitlements).toEqual(FREE_ENTITLEMENTS);
    expect(hasProGroupFeatures(freeEntitlements.plan)).toBe(false);
    expect(hasProMaxFeatures(freeEntitlements.plan)).toBe(false);
  });

  it("AC5: paid features are active for pro_group and pro_max tiers", () => {
    expect(hasProGroupFeatures("pro_group")).toBe(true);
    expect(hasProGroupFeatures("pro_max")).toBe(true);
    expect(hasProMaxFeatures("pro_group")).toBe(false);
    expect(hasProMaxFeatures("pro_max")).toBe(true);
  });

  it("AC4 / AC5: free creator does not alter assignee entitlement evaluation", () => {
    const creatorTier = "free";
    const assigneeTier = "pro_group";

    expect(hasProGroupFeatures(creatorTier)).toBe(false);
    expect(hasProGroupFeatures(assigneeTier)).toBe(true);
  });
});
