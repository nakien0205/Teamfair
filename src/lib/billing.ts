export type BillingPlan = "free" | "pro_group" | "pro_max";

export type Entitlements = {
  plan: BillingPlan;
  expiresAt: string | null;
  isActive: boolean;
};

export const PRO_GROUP_PRICE_VND = 79_000;
export const PRO_MAX_PRICE_VND = 129_000;

const PLAN_RANK: Record<BillingPlan, number> = {
  free: 0,
  pro_group: 1,
  pro_max: 2,
};

const PRO_GROUP_PLAN_IDS = new Set([
  "pro_group",
  "student_1m",
  "student_3m",
  "student_6m",
  "student_12m",
  "student_30d",
  "student_90d",
  "student_180d",
  "student_360d",
]);

const PRO_MAX_PLAN_IDS = new Set([
  "pro_max",
  "lecturer_1m",
  "lecturer_3m",
  "lecturer_6m",
  "lecturer_12m",
  "lecturer_30d",
  "lecturer_90d",
  "lecturer_180d",
  "lecturer_360d",
]);

export const FREE_ENTITLEMENTS: Entitlements = {
  plan: "free",
  expiresAt: null,
  isActive: false,
};

export function normalizeBillingPlanId(planId: unknown): BillingPlan {
  if (typeof planId !== "string") return "free";
  if (PRO_GROUP_PLAN_IDS.has(planId)) return "pro_group";
  if (PRO_MAX_PLAN_IDS.has(planId)) return "pro_max";
  return "free";
}

export function isPaidPlan(plan: BillingPlan): boolean {
  return plan === "pro_group" || plan === "pro_max";
}

export function hasProGroupFeatures(plan: BillingPlan): boolean {
  return isPaidPlan(plan);
}

export function hasProMaxFeatures(plan: BillingPlan): boolean {
  return plan === "pro_max";
}

export function isPlanDowngrade(currentPlan: BillingPlan, requestedPlan: BillingPlan): boolean {
  return PLAN_RANK[requestedPlan] < PLAN_RANK[currentPlan];
}

export function getPlanPurchaseState(
  currentPlan: BillingPlan,
  requestedPlan: BillingPlan,
): "available" | "current" | "included" {
  if (currentPlan === requestedPlan) return "current";
  return isPlanDowngrade(currentPlan, requestedPlan) ? "included" : "available";
}

export function normalizeEntitlements(value: unknown): Entitlements {
  if (!value || typeof value !== "object") return FREE_ENTITLEMENTS;
  const row = value as { plan_id?: unknown; expires_at?: unknown; is_active?: unknown };
  if (row.is_active !== true) return FREE_ENTITLEMENTS;
  const plan = normalizeBillingPlanId(row.plan_id);
  if (plan === "free") return FREE_ENTITLEMENTS;
  return {
    plan,
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : null,
    isActive: true,
  };
}
