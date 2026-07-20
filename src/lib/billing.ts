export type BillingPlan = "free" | "pro_group" | "pro_max";

export type Entitlements = {
  plan: BillingPlan;
  expiresAt: string | null;
  isActive: boolean;
};

export const PRO_GROUP_PRICE_VND = 69_000;
export const PRO_MAX_PRICE_VND = 129_000;

export const FREE_ENTITLEMENTS: Entitlements = {
  plan: "free",
  expiresAt: null,
  isActive: false,
};

export function isPaidPlan(plan: BillingPlan): boolean {
  return plan === "pro_group" || plan === "pro_max";
}

export function hasProGroupFeatures(plan: BillingPlan): boolean {
  return isPaidPlan(plan);
}

export function hasProMaxFeatures(plan: BillingPlan): boolean {
  return plan === "pro_max";
}

export function normalizeEntitlements(value: unknown): Entitlements {
  if (!value || typeof value !== "object") return FREE_ENTITLEMENTS;
  const row = value as { plan_id?: unknown; expires_at?: unknown; is_active?: unknown };
  const plan = row.plan_id === "pro_group" || row.plan_id === "pro_max" ? row.plan_id : "free";
  if (row.is_active !== true || plan === "free") return FREE_ENTITLEMENTS;
  return {
    plan,
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
    isActive: true,
  };
}
