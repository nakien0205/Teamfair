import { getSupabaseAdmin, requireAuthUser } from "../_shared/auth.ts";
import { isAllowedOrigin, optionsResponse } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/ratelimit.ts";
import { ApiError, internalError, jsonError, jsonOk } from "../_shared/responses.ts";

function userIdFromBody(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("bad_request", "Dữ liệu gửi lên không hợp lệ.");
  }
  const userId = (value as { user_id?: unknown }).user_id;
  if (typeof userId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new ApiError("bad_request", "Mã người dùng không hợp lệ.");
  }
  return userId;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  if (req.method !== "POST") {
    return jsonError(req, new ApiError("not_found", "Không tìm thấy endpoint."));
  }

  if (!isAllowedOrigin(req)) {
    return jsonError(req, new ApiError("forbidden", "Origin không được phép."));
  }

  try {
    const user = await requireAuthUser(req);
    await enforceRateLimit(`${user.id}:delete-user-auth`);

    const requestedUserId = userIdFromBody(await req.json());
    if (requestedUserId !== user.id) {
      throw new ApiError("forbidden", "Bạn chỉ có thể xóa tài khoản của chính mình.");
    }

    const admin = getSupabaseAdmin();
    const { error } = await admin.auth.admin.deleteUser(requestedUserId);
    if (error) {
      console.error("auth.admin.deleteUser failed:", error.message);
      return internalError(req);
    }

    return jsonOk(req, { user_id: requestedUserId });
  } catch (error) {
    if (error instanceof ApiError) return jsonError(req, error);
    console.error("delete-user-auth internal error:", error);
    return internalError(req);
  }
});
