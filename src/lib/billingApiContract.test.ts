import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "supabase/functions/billing-api/index.ts"),
  "utf8",
);

describe("billing API plan protection contract", () => {
  it("checks the server-authoritative current plan before creating payment details or an order", () => {
    const planLookup = source.indexOf('admin.rpc("billing_plan_for_user"');
    const downgradeGuard = source.indexOf('currentPlan === "pro_max" && plan === "pro_group"');
    const paymentConfigLookup = source.indexOf('requiredPaymentEnv("PAYMENT_BANK_ID")');
    const orderInsert = source.indexOf('.from("orders")');

    expect(planLookup).toBeGreaterThan(-1);
    expect(downgradeGuard).toBeGreaterThan(planLookup);
    expect(paymentConfigLookup).toBeGreaterThan(downgradeGuard);
    expect(orderInsert).toBeGreaterThan(downgradeGuard);
  });

  it("returns a conflict for Pro Max to Pro Group purchase attempts", () => {
    expect(source).toContain('new ApiError("conflict"');
    expect(source).toContain("Pro Group đã được bao gồm trong gói Pro Max hiện tại.");
  });
});
