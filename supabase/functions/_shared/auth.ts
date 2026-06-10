import { createClient } from "https://esm.sh/@supabase/supabase-js@2.105.4";
import { ApiError } from "./responses.ts";

type SupabaseClient = ReturnType<typeof createClient>;

function requiredEnv(...names: string[]): string {
  for (const name of names) {
    const value = Deno.env.get(name);
    if (value) return value;
  }

  throw new Error(`Missing required environment variable: ${names.join(" or ")}`);
}

export function getSupabaseAdmin(): SupabaseClient {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export function getSupabaseForAuth(): SupabaseClient {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export async function requireAuthUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new ApiError("unauthorized", "Bạn cần đăng nhập để thực hiện thao tác này.");
  }

  const token = authHeader.slice("Bearer ".length);
  const supabase = getSupabaseForAuth();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new ApiError("unauthorized", "Phiên đăng nhập không hợp lệ.");
  }

  return data.user;
}
