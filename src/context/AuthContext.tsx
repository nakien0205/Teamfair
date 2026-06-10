import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { toast } from "sonner";
import { identifyUser, resetAnalytics } from "@/lib/analytics";

export type AppUserRole = "student" | "lecturer" | "admin";

export type AppUserProfile = {
  id: string;
  email: string;
  role: AppUserRole;
  full_name: string;
  profile_completed: boolean;
  last_name_change_at?: string | null;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: AppUserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  updateProfileName: (newName: string) => Promise<void>;
};

type ProfileQueryError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const PROFILE_TIMEOUT_MS = 8000; // Reduced from 15s to 8s
const PROFILE_RETRY_ATTEMPTS = 2; // Retry up to 2 times
const SIGN_OUT_TIMEOUT_MS = 2000; // Reduced from 5s to 2s for better UX
const PROFILE_TABLE_NAME = "users";

// Simple in-memory cache to avoid re-fetching profile immediately
const profileCache = new Map<string, { profile: AppUserProfile; timestamp: number }>();
const CACHE_TTL_MS = 30000; // Cache for 30 seconds

function getFallbackProfile(userObject: User): AppUserProfile {
  const email = userObject.email || "";
  const fallbackName =
    userObject.user_metadata?.full_name ||
    userObject.user_metadata?.name ||
    email.split("@")[0] ||
    `${userObject.id.slice(0, 8)}...`;

  return {
    id: userObject.id,
    email,
    role: "student",
    full_name: fallbackName,
    profile_completed: false,
    last_name_change_at: null,
  };
}

function logProfileQueryError(context: string, userId: string, error: ProfileQueryError | null | undefined) {
  console.error(`[AuthContext] ${context}`, {
    userId,
    table: PROFILE_TABLE_NAME,
    timeoutMs: PROFILE_TIMEOUT_MS,
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    status: error?.status,
  });
}

async function fetchProfileRow(userId: string, retryCount = 0): Promise<AppUserProfile | null> {
  // Check cache first
  const cached = profileCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log("[AuthContext] Using cached profile", { userId });
    return cached.profile;
  }

  try {
    const { data, error } = await supabase
      .from(PROFILE_TABLE_NAME)
      .select("id,email,role,full_name,profile_completed,last_name_change_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      logProfileQueryError("Profile query failed", userId, error);
      
      // Retry on timeout or network errors
      if (retryCount < PROFILE_RETRY_ATTEMPTS && (error.message?.includes("timeout") || error.message?.includes("network"))) {
        console.warn(`[AuthContext] Retrying profile fetch (attempt ${retryCount + 1}/${PROFILE_RETRY_ATTEMPTS})`, { userId });
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait 500ms before retry
        return fetchProfileRow(userId, retryCount + 1);
      }
      
      return null;
    }

    if (!data) {
      console.warn("[AuthContext] Profile row not found", {
        userId,
        table: PROFILE_TABLE_NAME,
      });
      return null;
    }

    const profile: AppUserProfile = {
      id: data.id,
      email: data.email,
      role: data.role as AppUserRole,
      full_name: data.full_name,
      profile_completed: data.profile_completed,
      last_name_change_at: data.last_name_change_at,
    };

    // Cache the profile
    profileCache.set(userId, { profile, timestamp: Date.now() });

    return profile;
  } catch (error) {
    console.error("[AuthContext] Unexpected error fetching profile", { userId, error });
    
    // Retry on unexpected errors
    if (retryCount < PROFILE_RETRY_ATTEMPTS) {
      console.warn(`[AuthContext] Retrying profile fetch after error (attempt ${retryCount + 1}/${PROFILE_RETRY_ATTEMPTS})`, { userId });
      await new Promise(resolve => setTimeout(resolve, 500));
      return fetchProfileRow(userId, retryCount + 1);
    }
    
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const loadingProfileUserId = useRef<string | null>(null);

  const loadProfile = useCallback(async (userId: string, userObject?: User | null, useFallbackImmediately = false) => {
    if (!isSupabaseConfigured) {
      setProfile(null);
      return;
    }

    // If we want to use fallback immediately (e.g., after timeout), do it
    if (useFallbackImmediately && userObject) {
      const fallback = getFallbackProfile(userObject);
      console.warn("[AuthContext] Using fallback profile immediately", {
        userId,
        fullName: fallback.full_name,
        email: fallback.email,
      });
      setProfile(fallback);
      return;
    }

    try {
      const profileRow = await fetchProfileRow(userId);
      if (profileRow) {
        setProfile(profileRow);
        return;
      }
    } catch (error) {
      console.error("[AuthContext] Error loading profile", { userId, error });
    }

    // Fallback if profile fetch failed
    const targetUser = userObject || (await supabase.auth.getUser()).data.user;
    if (targetUser && targetUser.id === userId) {
      const fallback = getFallbackProfile(targetUser);
      console.warn("[AuthContext] Using fallback profile after failed fetch", {
        userId,
        fullName: fallback.full_name,
        email: fallback.email,
      });
      setProfile(fallback);
      return;
    }

    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }

    // Clear cache to force fresh fetch
    profileCache.delete(uid);
    await loadProfile(uid, session.user);
  }, [session, loadProfile]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadProfileWithTimeout = async (uid: string, activeUser: User) => {
      if (loadingProfileUserId.current === uid) {
        console.log("[AuthContext] Profile already loading for user", { uid });
        return;
      }
      loadingProfileUserId.current = uid;

      let timer: NodeJS.Timeout | null = null;
      let timedOut = false;

      const timeoutPromise = new Promise<void>((resolve) => {
        timer = setTimeout(() => {
          timedOut = true;
          console.warn("[AuthContext] Profile load timeout, using fallback", {
            userId: uid,
            timeoutMs: PROFILE_TIMEOUT_MS,
          });
          resolve();
        }, PROFILE_TIMEOUT_MS);
      });

      const loadPromise = loadProfile(uid, activeUser).finally(() => {
        if (timer) clearTimeout(timer);
      });

      try {
        await Promise.race([loadPromise, timeoutPromise]);
        
        // If timed out, use fallback but don't throw
        if (timedOut) {
          console.warn("[AuthContext] Using fallback after timeout");
          await loadProfile(uid, activeUser, true); // Use fallback immediately
        }
      } catch (error) {
        console.error("[AuthContext] Profile load failed during auth flow", {
          userId: uid,
          table: PROFILE_TABLE_NAME,
          timeoutMs: PROFILE_TIMEOUT_MS,
          error,
        });
        // Always set fallback on error, never throw
        setProfile(getFallbackProfile(activeUser));
      } finally {
        if (timer) {
          clearTimeout(timer);
        }

        if (loadingProfileUserId.current === uid) {
          loadingProfileUserId.current = null;
        }
      }
    };

    const init = async () => {
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (cancelled) return;

        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user?.id) {
          // Don't await - let it load in background, we'll use fallback if needed
          loadProfileWithTimeout(currentSession.user.id, currentSession.user).catch(error => {
            console.error("[AuthContext] Profile load error in init", error);
          });
        } else {
          // No session, we can stop loading immediately
          setLoading(false);
        }
      } catch (error) {
        console.error("[AuthContext] Error during auth session initialization", error);
        toast.error("Lỗi khi tải thông tin tài khoản", {
          description: "Không thể kết nối với máy chủ xác thực. Vui lòng kiểm tra kết nối mạng.",
          duration: 6000,
        });
      } finally {
        // Always stop loading after a reasonable time
        if (!cancelled) {
          setTimeout(() => {
            if (!cancelled) {
              setLoading(false);
            }
          }, 1000); // Give it 1 second max for initial load
        }
      }
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (cancelled) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user?.id) {
        // Load profile in background, use fallback on error
        loadProfileWithTimeout(nextSession.user.id, nextSession.user).catch(error => {
          console.error("[AuthContext] Profile load error in auth state change", {
            userId: nextSession.user.id,
            error,
          });
        });
      } else {
        setProfile(null);
        profileCache.clear(); // Clear cache on sign out
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  useEffect(() => {
    if (!user?.id || !profile) return;

    identifyUser(user.id, {
      email: profile.email,
      role: profile.role,
      name: profile.full_name,
      profile_completed: profile.profile_completed,
    });
  }, [profile, user?.id]);

  const signOut = useCallback(async () => {
    resetAnalytics();
    if (!isSupabaseConfigured) return;

    const signOutPromise = supabase.auth.signOut();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout signing out after ${SIGN_OUT_TIMEOUT_MS}ms`)), SIGN_OUT_TIMEOUT_MS);
    });

    try {
      await Promise.race([signOutPromise, timeoutPromise]);
    } catch (error) {
      console.error("[AuthContext] Sign out request failed", {
        timeoutMs: SIGN_OUT_TIMEOUT_MS,
        error,
      });
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
      profileCache.clear(); // Clear cache on sign out
    }
  }, []);

  const updateProfileName = useCallback(
    async (newName: string) => {
      if (!isSupabaseConfigured || !user?.id) return;

      const { error } = await supabase
        .from(PROFILE_TABLE_NAME)
        .update({ full_name: newName })
        .eq("id", user.id);

      if (error) {
        logProfileQueryError("Failed to update profile name", user.id, error);
        throw error;
      }

      // Clear cache and refresh
      profileCache.delete(user.id);
      await refreshProfile();
    },
    [user, refreshProfile],
  );

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      loading,
      refreshProfile,
      signOut,
      updateProfileName,
    }),
    [session, user, profile, loading, refreshProfile, signOut, updateProfileName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
