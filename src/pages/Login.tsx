import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Users, Loader2 } from "lucide-react";
import LanguageSwitcherButton from "@/components/LanguageSwitcherButton";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth, type AppUserRole } from "@/context/AuthContext";
import { t } from "@/lib/i18n";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { dashboardPathForRole } from "@/lib/dashboardPath";
import { clearDemoSession, setDemoSession } from "@/lib/demoSession";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const roleParam = params.get("role") || "student";
  const role = roleParam === "lecturer" ? "lecturer" : "student";
  const { language } = useLanguage();
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  useEffect(() => {
    if (!isSupabaseConfigured || authLoading || !session?.user?.id) return;
    const pending = sessionStorage.getItem("oauth_signup_role");
    if (pending !== "student" && pending !== "lecturer") return;
    void (async () => {
      const { error } = await supabase.rpc("set_signup_role", { p_role: pending });
      if (error) {
        console.error(error);
        toast.error(t(language, "authOAuthRoleFailed"));
      }
      sessionStorage.removeItem("oauth_signup_role");
      await refreshProfile();
    })();
  }, [session?.user?.id, authLoading, language, refreshProfile]);

  useEffect(() => {
    if (authLoading || !session?.user || !profile) return;
    if (sessionStorage.getItem("oauth_signup_role")) return;
    if (location.pathname !== "/login") return;
    const dest = from && from !== "/login" ? from : dashboardPathForRole(profile.role);
    navigate(dest, { replace: true });
  }, [session, profile, authLoading, navigate, location.pathname, from]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSupabaseConfigured) {
      toast.error(t(language, "authSupabaseNotConfigured"));
      return;
    }
    setLoading(true);
    try {
      clearDemoSession();
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName.trim() || email.split("@")[0] || "User",
              app_role: role === "lecturer" ? "lecturer" : "student",
            },
          },
        });
        if (error) {
          toast.error(t(language, "authSignUpFailed"), { description: error.message });
          return;
        }
        if (data.session) {
          await refreshProfile();
          const r = (await supabase.from("users").select("role").eq("id", data.user.id).maybeSingle()).data?.role as
            | AppUserRole
            | undefined;
          navigate(dashboardPathForRole(r ?? "student"), { replace: true });
        } else {
          toast.message(t(language, "authSignUpConfirmEmail"));
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(t(language, "authSignInFailed"), { description: error.message });
          return;
        }
        await refreshProfile();
        const r = (await supabase.from("users").select("role").eq("id", data.user.id).maybeSingle()).data?.role as
          | AppUserRole
          | undefined;
        navigate(dashboardPathForRole(r ?? "student"), { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!isSupabaseConfigured) {
      toast.error(t(language, "authSupabaseNotConfigured"));
      return;
    }
    setLoading(true);
    clearDemoSession();
    sessionStorage.setItem("oauth_signup_role", role === "lecturer" ? "lecturer" : "student");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login?role=${role}`,
      },
    });
    setLoading(false);
    if (error) {
      sessionStorage.removeItem("oauth_signup_role");
      toast.error(t(language, "authGoogleFailed"), { description: error.message });
    }
  };

  const handleDemo = (demoRole: "student" | "lecturer") => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setDemoSession();
      navigate(demoRole === "lecturer" ? "/dashboard-lecturer" : "/dashboard-student");
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcherButton />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Users className="h-7 w-7 text-primary" />
            <span className="font-display text-2xl font-bold">TEAMFAIR</span>
          </div>
          <h1 className="font-display text-xl font-bold mb-1">{t(language, "loginTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {t(language, "loginRoleLabel")}: {role === "lecturer" ? t(language, "lecturer") : t(language, "student")}
          </p>
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card space-y-4 border border-border">
          <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={() => void handleGoogle()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t(language, "loginWithGoogle")}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {language === "vi" ? "Hoặc email" : "Or email"}
              </span>
            </div>
          </div>

          <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
            {isSignUp ? (
              <div className="space-y-2">
                <Label htmlFor="fullName">{t(language, "loginFullNameOptional")}</Label>
                <Input id="fullName" type="text" autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t(language, "loginPassword")}</Label>
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isSignUp ? t(language, "loginSubmitSignUp") : t(language, "loginSubmitSignIn")}
            </Button>
          </form>

          <button
            type="button"
            className="w-full text-center text-sm text-primary hover:underline"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp ? t(language, "loginSignInMode") : t(language, "loginSignUpMode")}
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-center text-sm text-muted-foreground">{language === "vi" ? "Hoặc trải nghiệm demo" : "Or try the demo"}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => handleDemo("student")} disabled={loading}>
              {t(language, "demoStudent")}
            </Button>
            <Button variant="outline" onClick={() => handleDemo("lecturer")} disabled={loading}>
              {t(language, "demoLecturer")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
