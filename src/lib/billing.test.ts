import { describe, expect, it } from "vitest";
import {
  FREE_ENTITLEMENTS,
  PRO_GROUP_PRICE_VND,
  PRO_MAX_PRICE_VND,
  hasProGroupFeatures,
  hasProMaxFeatures,
  normalizeEntitlements,
} from "@/lib/billing";

describe("billing entitlement contract", () => {
  it("keeps Pro Group at 69,000 VND and Pro Max at 129,000 VND", () => {
    expect(PRO_GROUP_PRICE_VND).toBe(69_000);
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
});
