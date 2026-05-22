import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { clearDemoSession } from "@/lib/demoSession";

export type AppUserRole = "student" | "lecturer" | "admin";

export type AppUserProfile = {
  id: string;
  email: string;
  role: AppUserRole;
  full_name: string;
  profile_completed: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: AppUserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfileRow (userId: string): Promise<AppUserProfile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id,email,role,full_name,profile_completed")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id,
    email: data.email,
    role: data.role as AppUserRole,
    full_name: data.full_name,
    profile_completed: data.profile_completed,
  };
}

export function AuthProvider ({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string, userObject?: User | null) => {
    if (!isSupabaseConfigured) {
      setProfile(null);
      return;
    }
    const row = await fetchProfileRow(userId);
    if (row) {
      setProfile(row);
      return;
    }

    // Fallback profile if row is missing but we have a valid session
    const targetUser = userObject || (await supabase.auth.getUser()).data.user;
    if (targetUser && targetUser.id === userId) {
      setProfile({
        id: targetUser.id,
        email: targetUser.email || "",
        role: (targetUser.user_metadata?.app_role || "student") as AppUserRole,
        full_name: targetUser.user_metadata?.full_name || targetUser.email?.split("@")[0] || "User",
        profile_completed: false,
      });
    } else {
      setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    await loadProfile(uid, session?.user);
  }, [session?.user, loadProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const init = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        if (cancelled) return;
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user?.id) {
          await Promise.race([
            loadProfile(s.user.id, s.user),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout loading profile")), 5000))
          ]);
        }
      } catch (error) {
        console.error("Error during auth session initialization:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (cancelled) return;
      setSession(s);
      setUser(s?.user ?? null);
      try {
        if (s?.user?.id) {
          await Promise.race([
            loadProfile(s.user.id, s.user),
            new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout loading profile")), 5000))
          ]);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Error during auth state change:", error);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    clearDemoSession();
    if (!isSupabaseConfigured) return;
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      refreshProfile,
      signOut,
    }),
    [session, user, profile, loading, refreshProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth (): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
