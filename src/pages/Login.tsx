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
import { t, tr } from "@/lib/i18n";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { dashboardPathForRole } from "@/lib/dashboardPath";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { language } = useLanguage();
  const { session, profile, loading: authLoading, refreshProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname;

  // Handle OAuth redirect errors
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    let hashParams = new URLSearchParams();
    if (window.location.hash) {
      const hashStr = window.location.hash.startsWith("#")
        ? window.location.hash.substring(1)
        : window.location.hash;
      hashParams = new URLSearchParams(hashStr);
    }

    const error = searchParams.get("error") || hashParams.get("error");
    const errorDescription = searchParams.get("error_description") || hashParams.get("error_description");
    const errorCode = searchParams.get("error_code") || hashParams.get("error_code");

    if (error) {
      const cleanError = decodeURIComponent(error);
      const cleanDescription = errorDescription ? decodeURIComponent(errorDescription) : "";
      const cleanCode = errorCode ? decodeURIComponent(errorCode) : "";

      console.error("OAuth redirect error:", { error: cleanError, description: cleanDescription, code: cleanCode });

      let friendlyTitle = t(language, "authGoogleFailed");
      let friendlyDescription = cleanDescription || cleanError;

      if (
        cleanError === "identity_provider_email_already_associated" ||
        cleanDescription.toLowerCase().includes("already associated") ||
        cleanDescription.toLowerCase().includes("already registered")
      ) {
        friendlyTitle = tr(
          language,
          "Tài khoản đã tồn tại với phương thức đăng nhập khác",
          "Account exists under another login provider"
        );
        friendlyDescription = tr(
          language,
          "Email này đã được đăng ký bằng một phương thức khác (như mật khẩu thông thường). Vui lòng đăng nhập bằng tài khoản/mật khẩu ban đầu.",
          "Your email is already registered using a different method (e.g. email/password). Please sign in using your original credentials."
        );
      } else if (
        cleanError === "unconfigured_provider" ||
        cleanError.includes("provider_not_enabled") ||
        cleanDescription.toLowerCase().includes("not enabled")
      ) {
        friendlyTitle = tr(
          language,
          "Nhà cung cấp chưa được kích hoạt",
          "Unconfigured provider"
        );
        friendlyDescription = tr(
          language,
          "Đăng nhập bằng Google hiện chưa được bật hoặc cấu hình trên hệ thống. Vui lòng liên hệ quản trị viên.",
          "Google sign-in is not currently enabled or configured on the server. Please contact support."
        );
      } else if (
        cleanError === "redirect_uri_mismatch" ||
        cleanDescription.toLowerCase().includes("redirect_uri_mismatch") ||
        cleanDescription.toLowerCase().includes("redirect uri mismatch")
      ) {
        friendlyTitle = tr(
          language,
          "Lỗi URL chuyển hướng",
          "Redirect URI mismatch"
        );
        friendlyDescription = tr(
          language,
          "Định cấu hình URL chuyển hướng trong hệ thống không chính xác hoặc không khớp với trang hiện tại.",
          "The redirect URI configured on the auth server does not match this site's URL."
        );
      } else if (
        cleanError === "access_denied" ||
        cleanError === "user_denied" ||
        cleanDescription.toLowerCase().includes("access_denied") ||
        cleanDescription.toLowerCase().includes("user denied")
      ) {
        friendlyTitle = tr(
          language,
          "Từ chối quyền truy cập",
          "Access denied"
        );
        friendlyDescription = tr(
          language,
          "Yêu cầu đăng nhập Google đã bị hủy hoặc từ chối.",
          "The Google authentication request was canceled or denied."
        );
      }

      toast.error(friendlyTitle, {
        description: friendlyDescription,
        duration: 8000,
      });

      // Clear the query / hash from URL preserving other parameters like role
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      url.searchParams.delete("error_description");
      url.searchParams.delete("error_code");
      if (url.hash) {
        const hashStr = url.hash.startsWith("#") ? url.hash.substring(1) : url.hash;
        const cleanHashParams = new URLSearchParams(hashStr);
        cleanHashParams.delete("error");
        cleanHashParams.delete("error_description");
        cleanHashParams.delete("error_code");
        const remainingHash = cleanHashParams.toString();
        url.hash = remainingHash ? `#${remainingHash}` : "";
      }
      
      window.history.replaceState({}, document.title, url.pathname + url.search + url.hash);
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    if (authLoading || !session?.user || !profile) return;
    if (location.pathname !== "/login") return;
    const dest = from && from !== "/login"
      ? from
      : dashboardPathForRole(profile.role);
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
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: email.split("@")[0] || "User",
            },
          },
        });
        if (error) {
          toast.error(t(language, "authSignUpFailed"), { description: error.message });
          return;
        }
        if (data.session) {
          await refreshProfile();
          const u = (await supabase.from("users").select("role, profile_completed").eq("id", data.user.id).maybeSingle()).data;
          const r = u?.role as AppUserRole | undefined;
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
        const u = (await supabase.from("users").select("role, profile_completed").eq("id", data.user.id).maybeSingle()).data;
        const r = u?.role as AppUserRole | undefined;
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
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/login`,
      },
    });
    setGoogleLoading(false);
    if (error) {
      toast.error(t(language, "authGoogleFailed"), { description: error.message });
    }
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
        </div>

        <div className="bg-card rounded-xl p-6 shadow-card space-y-4 border border-border">
          <Button type="button" variant="outline" className="w-full" disabled={googleLoading || loading} onClick={() => void handleGoogle()}>
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
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
            <Button type="submit" className="w-full" disabled={loading || googleLoading}>
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


      </div>
    </div>
  );
};

export default Login;
