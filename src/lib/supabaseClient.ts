import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const safeUrl = supabaseUrl ?? "https://example.supabase.co";
const safeKey = supabaseAnonKey ?? "public-anon-key";

export const supabase = createClient(safeUrl, safeKey);

type RecoveryEventProof = { userId: string };

let recoveryEventProof: RecoveryEventProof | null = null;

// Register before React mounts. This preserves the provider-issued recovery
// event even when Supabase consumes the URL fragment before ResetPassword is
// rendered. URL state itself is never treated as proof.
if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session?.user?.id) {
      recoveryEventProof = { userId: session.user.id };
    } else if (recoveryEventProof && session?.user?.id !== recoveryEventProof.userId) {
      recoveryEventProof = null;
    }
  });
}

export function consumeRecoveryEventProof(): RecoveryEventProof | null {
  const proof = recoveryEventProof;
  recoveryEventProof = null;
  return proof;
}
