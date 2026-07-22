import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const safeUrl = supabaseUrl ?? "https://example.supabase.co";
const safeKey = supabaseAnonKey ?? "public-anon-key";

export const supabase = createClient(safeUrl, safeKey);

type RecoveryEventProof = { userId: string; timestamp: number };

let recoveryEventProof: RecoveryEventProof | null = null;
const RECOVERY_PROOF_MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

// Register before React mounts. This preserves the provider-issued recovery
// event even when Supabase consumes the URL fragment before ResetPassword is
// rendered. URL state itself is never treated as proof.
if (isSupabaseConfigured) {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY" && session?.user?.id) {
      recoveryEventProof = { userId: session.user.id, timestamp: Date.now() };
    } else if (recoveryEventProof && session?.user?.id !== recoveryEventProof.userId) {
      recoveryEventProof = null;
    }
  });
}

export function consumeRecoveryEventProof(): RecoveryEventProof | null {
  const proof = recoveryEventProof;
  recoveryEventProof = null;
  if (!proof) return null;
  if (Date.now() - proof.timestamp > RECOVERY_PROOF_MAX_AGE_MS) {
    return null;
  }
  return proof;
}

