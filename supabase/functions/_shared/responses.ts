import { corsHeaders } from "./cors.ts";

export type ApiErrorCode =
  | "bad_request"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "gone"
  | "rate_limited"
  | "internal_error";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  gone: 410,
  rate_limited: 429,
  internal_error: 500,
};

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  retryAfterSecs?: number;

  constructor(code: ApiErrorCode, message: string, status = STATUS_BY_CODE[code], retryAfterSecs?: number) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.retryAfterSecs = retryAfterSecs;
  }
}

export function jsonOk<T>(req: Request, data: T, status = 200): Response {
  return new Response(JSON.stringify({ ok: true, data }), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "X-Frame-Options": "DENY",
    },
  });
}

export function jsonError(req: Request, error: ApiError): Response {
  const headers: Record<string, string> = {
    ...corsHeaders(req),
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "X-Frame-Options": "DENY",
  };
  if (error.code === "rate_limited" && error.retryAfterSecs !== undefined) {
    headers["Retry-After"] = String(error.retryAfterSecs);
  }
  return new Response(JSON.stringify({
    ok: false,
    error: {
      code: error.code,
      message: error.message,
    },
  }), {
    status: error.status,
    headers,
  });
}

export function internalError(req: Request): Response {
  return jsonError(req, new ApiError("internal_error", "Không thể xử lý yêu cầu. Vui lòng thử lại sau."));
}
