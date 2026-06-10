const ALLOWED_ORIGINS = new Set([
  "https://teamfair.company",
  "https://www.teamfair.company",
  "https://teamfair.vercel.app",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
]);

export function isAllowedOrigin(req: Request): boolean {
  const origin = req.headers.get("Origin");
  return !origin || ALLOWED_ORIGINS.has(origin);
}

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
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
