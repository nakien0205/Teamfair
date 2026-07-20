import { getSupabaseAdmin } from "../_shared/auth.ts";

type SePayPayload = {
  id: number;
  code: string | null;
  content: string;
  transferType: string;
  transferAmount: number;
};

function success(): Response {
  return new Response('{"success":true}', {
    status: 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function failure(status: number): Response {
  return new Response('{"success":false}', {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function fixedTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

async function hmacSha256(secret: string, value: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return [...new Uint8Array(signature)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isSePayPayload(value: unknown): value is SePayPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Number.isInteger(row.id)
    && typeof row.content === "string"
    && typeof row.transferType === "string"
    && typeof row.transferAmount === "number";
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return failure(405);

  try {
    const secret = Deno.env.get("SEPAY_WEBHOOK_SECRET");
    const signature = req.headers.get("X-SePay-Signature");
    const timestampHeader = req.headers.get("X-SePay-Timestamp");
    if (!secret || !signature || !timestampHeader || !/^\d+$/.test(timestampHeader)) return failure(401);

    const timestamp = Number(timestampHeader);
    if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > 300) return failure(401);

    const rawBody = await req.text();
    const expectedSignature = `sha256=${await hmacSha256(secret, `${timestampHeader}.${rawBody}`)}`;
    if (!fixedTimeEqual(signature, expectedSignature)) return failure(401);

    const payload: unknown = JSON.parse(rawBody);
    if (!isSePayPayload(payload) || payload.transferType.toLowerCase() !== "in" || payload.transferAmount <= 0) return failure(400);

    const reference = (payload.code || payload.content.match(/TF[A-Z0-9]{8,32}/i)?.[0] || "").toUpperCase();
    if (!/^TF[A-Z0-9]{8,32}$/.test(reference)) return failure(404);

    const admin = getSupabaseAdmin();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id,status,amount_vnd")
      .eq("order_reference", reference)
      .maybeSingle();
    if (orderError || !order) return failure(404);
    if (order.status === "PAID") return success();
    if (order.status !== "PENDING" || payload.transferAmount < order.amount_vnd) return failure(400);

    const { data: activated, error: activationError } = await admin.rpc("activate_paid_order", {
      p_order_id: order.id,
      p_provider_transaction_id: String(payload.id),
      p_paid_at: new Date().toISOString(),
    });
    if (activationError) throw activationError;
    if (!activated) return success();
    return success();
  } catch (error) {
    console.error("sepay-webhook failed", { error: error instanceof Error ? error.message : "unknown" });
    return failure(500);
  }
});
