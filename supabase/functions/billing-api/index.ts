import { getSupabaseAdmin, requireAuthUser } from "../_shared/auth.ts";
import { isAllowedOrigin, optionsResponse } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/ratelimit.ts";
import { ApiError, internalError, jsonError, jsonOk } from "../_shared/responses.ts";
import { buildVietQrQuickLink } from "../_shared/vietqr.ts";

const PLANS = {
  pro_group: { amount: 79_000 },
  pro_max: { amount: 129_000 },
} as const;

type PaidPlan = keyof typeof PLANS;

function newOrderReference(): string {
  return `TF${crypto.randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase()}`;
}

function requiredPaymentEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new ApiError("internal_error", "Thanh toán chưa được cấu hình.");
  return value;
}

function parsePlan(value: unknown): PaidPlan {
  if (value === "pro_group" || value === "pro_max") return value;
  throw new ApiError("bad_request", "Gói thanh toán không hợp lệ.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST" || !isAllowedOrigin(req)) {
    return new Response(null, { status: 405 });
  }

  try {
    const user = await requireAuthUser(req);
    await enforceRateLimit(`billing:create-order:${user.id}`);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ApiError("bad_request", "Dữ liệu gửi lên không hợp lệ.");
    }
    const plan = parsePlan((body as Record<string, unknown>).planId);
    const bankId = requiredPaymentEnv("PAYMENT_BANK_ID");
    const accountNumber = requiredPaymentEnv("PAYMENT_ACCOUNT_NO");
    const accountName = requiredPaymentEnv("PAYMENT_ACCOUNT_NAME");
    const amount = PLANS[plan].amount;
    const orderReference = newOrderReference();
    const qrUrl = buildVietQrQuickLink({
      bankId,
      accountNumber,
      amount,
      transferReference: orderReference,
      accountName,
    });
    const admin = getSupabaseAdmin();
    const { data: order, error } = await admin
      .from("orders")
      .insert({
        order_reference: orderReference,
        user_id: user.id,
        plan_id: plan,
        amount_vnd: amount,
      })
      .select("id,order_reference,amount_vnd,plan_id")
      .single();
    if (error || !order) throw error ?? new Error("Could not create payment order.");

    return jsonOk(req, {
      orderId: order.id,
      orderReference: order.order_reference,
      amount: order.amount_vnd,
      qrUrl,
    }, 201);
  } catch (error) {
    if (error instanceof ApiError) {
      console.error("billing-api rejected", {
        code: error.code,
        status: error.status,
        message: error.message,
      });
      return jsonError(req, error);
    }
    console.error("billing-api failed", { error: error instanceof Error ? error.message : "unknown" });
    return internalError(req);
  }
});
