import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { FREE_ENTITLEMENTS, normalizeEntitlements, type Entitlements } from "@/lib/billing";

type EntitlementContextValue = Entitlements & {
  loading: boolean;
  error: boolean;
  refreshEntitlements: () => Promise<void>;
};

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [entitlements, setEntitlements] = useState<Entitlements>(FREE_ENTITLEMENTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const refreshEntitlements = useCallback(async () => {
    if (authLoading) {
      setLoading(true);
      return;
    }
    if (!isSupabaseConfigured || !user?.id) {
      setEntitlements(FREE_ENTITLEMENTS);
      setError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const { data, error } = await supabase.rpc("get_my_entitlements");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setEntitlements(normalizeEntitlements(row));
    } catch (error) {
      console.warn("Could not load billing entitlements:", error);
      setEntitlements(FREE_ENTITLEMENTS);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [authLoading, user?.id]);

  useEffect(() => {
    void refreshEntitlements();
  }, [refreshEntitlements]);

  const value = useMemo(
    () => ({ ...entitlements, loading, error, refreshEntitlements }),
    [entitlements, error, loading, refreshEntitlements],
  );
  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlements(): EntitlementContextValue {
  const context = useContext(EntitlementContext);
  if (!context) throw new Error("useEntitlements must be used within EntitlementProvider");
  return context;
}
