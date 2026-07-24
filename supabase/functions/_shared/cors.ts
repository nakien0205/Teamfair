const ALLOWED_ORIGINS = new Set([
  "https://teamfair.company",
  "https://www.teamfair.company",
  "https://teamfair.vercel.app",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

const TEAMFAIR_VERCEL_PREVIEW_ORIGIN = /^https:\/\/teamfair(?:-[a-z0-9-]+)+\.vercel\.app$/;

function isAllowedOriginValue(origin: string | null): boolean {
  if (!origin || ALLOWED_ORIGINS.has(origin)) return true;

  try {
    const parsed = new URL(origin);
    return parsed.protocol === "https:" && TEAMFAIR_VERCEL_PREVIEW_ORIGIN.test(origin);
  } catch {
    return false;
  }
}

export function isAllowedOrigin(req: Request): boolean {
  return isAllowedOriginValue(req.headers.get("Origin"));
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, sentry-trace, baggage",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (origin && isAllowedOriginValue(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

export function optionsResponse(req: Request): Response {
  if (!isAllowedOrigin(req)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders(req),
  });
}
