import { describe, expect, it } from "vitest";
import {
  FREE_ENTITLEMENTS,
  PRO_GROUP_PRICE_VND,
  PRO_MAX_PRICE_VND,
  getPlanPurchaseState,
  hasProGroupFeatures,
  hasProMaxFeatures,
  isPlanDowngrade,
  normalizeBillingPlanId,
  normalizeEntitlements,
} from "@/lib/billing";

describe("billing entitlement contract", () => {
  it("keeps Pro Group at 79,000 VND and Pro Max at 129,000 VND", () => {
    expect(PRO_GROUP_PRICE_VND).toBe(79_000);
    expect(PRO_MAX_PRICE_VND).toBe(129_000);
  });

  it("does not grant paid features to free accounts", () => {
    expect(hasProGroupFeatures("free")).toBe(false);
    expect(hasProMaxFeatures("free")).toBe(false);
  });

  it("grants Pro Group features only to paid account tiers", () => {
    expect(hasProGroupFeatures("pro_group")).toBe(true);
    expect(hasProGroupFeatures("pro_max")).toBe(true);
    expect(hasProMaxFeatures("pro_group")).toBe(false);
    expect(hasProMaxFeatures("pro_max")).toBe(true);
  });

  it("treats malformed or expired RPC data as free", () => {
    expect(normalizeEntitlements(null)).toEqual(FREE_ENTITLEMENTS);
    expect(normalizeEntitlements({ plan_id: "pro_group", is_active: false })).toEqual(FREE_ENTITLEMENTS);
    expect(normalizeEntitlements({ plan_id: "untrusted", is_active: true })).toEqual(FREE_ENTITLEMENTS);
  });

  it("should map every approved subscription SKU to its canonical tier and fail closed for unknown or inactive input", () => {
    const proGroupPlanIds = [
      "pro_group",
      "student_1m",
      "student_3m",
      "student_6m",
      "student_12m",
      "student_30d",
      "student_90d",
      "student_180d",
      "student_360d",
    ];
    const proMaxPlanIds = [
      "pro_max",
      "lecturer_1m",
      "lecturer_3m",
      "lecturer_6m",
      "lecturer_12m",
      "lecturer_30d",
      "lecturer_90d",
      "lecturer_180d",
      "lecturer_360d",
    ];

    for (const planId of proGroupPlanIds) {
      expect(normalizeBillingPlanId(planId)).toBe("pro_group");
    }
    for (const planId of proMaxPlanIds) {
      expect(normalizeBillingPlanId(planId)).toBe("pro_max");
    }

    expect(normalizeBillingPlanId(null)).toBe("free");
    expect(normalizeBillingPlanId("student_enterprise")).toBe("free");
    expect(normalizeBillingPlanId("lecturer_1m_extra")).toBe("free");
    expect(normalizeEntitlements({ plan_id: "student_1m", is_active: false })).toEqual(FREE_ENTITLEMENTS);
  });

  it("normalizes active product SKUs before exposing account entitlements", () => {
    expect(
      normalizeEntitlements({
        plan_id: "student_3m",
        expires_at: "2026-11-12T00:00:00.000Z",
        is_active: true,
      }),
    ).toEqual({
      plan: "pro_group",
      expiresAt: "2026-11-12T00:00:00.000Z",
      isActive: true,
    });

    expect(
      normalizeEntitlements({
        plan_id: "lecturer_12m",
        expires_at: "2027-08-14T00:00:00.000Z",
        is_active: true,
      }),
    ).toEqual({
      plan: "pro_max",
      expiresAt: "2027-08-14T00:00:00.000Z",
      isActive: true,
    });
  });

  it("marks lower tiers as included instead of purchasable", () => {
    expect(isPlanDowngrade("pro_max", "pro_group")).toBe(true);
    expect(isPlanDowngrade("pro_group", "free")).toBe(true);
    expect(isPlanDowngrade("pro_group", "pro_max")).toBe(false);
    expect(isPlanDowngrade("pro_max", "pro_max")).toBe(false);

    expect(getPlanPurchaseState("pro_max", "pro_group")).toBe("included");
    expect(getPlanPurchaseState("pro_group", "pro_group")).toBe("current");
    expect(getPlanPurchaseState("pro_group", "pro_max")).toBe("available");
  });
});
