import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Users, Loader2, Home, CheckSquare, 
  FileText, Scale, Sparkles, ChevronRight,
  Mail, Lock
} from "lucide-react";
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
    <div className="min-h-screen w-full flex bg-white dark:bg-slate-950 transition-colors duration-300">
      
      {/* Left Pane: Marketing & Branding Board */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-950 p-16 text-white flex-col justify-between relative overflow-hidden">
        {/* Decorative background glows */}
        <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-indigo-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[100px]" />
        
        {/* Brand Logo */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
            <Users className="h-5.5 w-5.5 text-indigo-400" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white uppercase">
            TeamFair
          </span>
        </div>

        {/* Brand Value Propositions */}
        <div className="my-auto space-y-8 relative z-10 max-w-md">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-indigo-300 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              {tr(language, "Minh bạch đóng góp", "Transparent Contribution")}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-emerald-300 text-xs font-semibold backdrop-blur-sm">
              {tr(language, "Giảm tranh cãi", "Reduced Disputes")}
            </span>
          </div>

          <h1 className="font-display text-4xl font-extrabold tracking-tight leading-[1.2] text-white">
            {tr(language, "Công bằng hơn trong đánh giá teamwork", "Fairer in teamwork evaluation")}
          </h1>

          <p className="text-slate-300 text-base leading-relaxed">
            {tr(
              language,
              "TeamFair giúp giảng viên theo dõi tiến độ nhóm, xem minh chứng làm việc, phân tích điểm đóng góp và chấm điểm bằng rubric một cách minh bạch.",
              "TeamFair helps instructors track group progress, view work evidence, analyze contribution points, and grade using rubrics transparently."
            )}
          </p>

          {/* Marketing Value Pillars */}
          <div className="space-y-5 pt-6 border-t border-white/10">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0 mt-0.5">
                <CheckSquare className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200">
                  {tr(language, "1. Theo dõi công việc", "1. Task Tracking")}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {tr(language, "Quản lý Task, Deadline & Trạng thái.", "Manage tasks, deadlines & statuses.")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 flex-shrink-0 mt-0.5">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200">
                  {tr(language, "2. Ghi nhận minh chứng", "2. Evidence Collection")}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {tr(language, "Lưu trữ File nộp & Lịch sử hoạt động.", "Store files, logs and history.")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-xl bg-violet-500/20 flex items-center justify-center text-violet-400 flex-shrink-0 mt-0.5">
                <Scale className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-200">
                  {tr(language, "3. Chấm điểm công bằng", "3. Fair Grading")}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {tr(language, "Đánh giá chéo & chấm điểm rubric.", "Peer reviews & rubrics system.")}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Left Footer */}
        <div className="text-slate-400 text-xs relative z-10">
          © {new Date().getFullYear()} TeamFair. All rights reserved.
        </div>
      </div>

      {/* Right Pane: Login Form UI */}
      <div className="w-full lg:w-1/2 p-8 md:p-16 flex flex-col justify-center relative bg-white dark:bg-slate-950 transition-colors duration-300">
        
        {/* Floating Utilities */}
        <div className="absolute top-6 left-6 z-10">
          <Button
            type="button"
            variant="ghost"
            className="gap-2 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 text-slate-700 dark:text-slate-300 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            onClick={() => navigate("/")}
          >
            <Home className="h-4 w-4" />
            {language === "vi" ? "Về trang chủ" : "Back to home"}
          </Button>
        </div>
        
        <div className="absolute top-6 right-6 z-10">
          <LanguageSwitcherButton />
        </div>

        <div className="max-w-md w-full mx-auto space-y-6">
          <div>
            {/* Small screen mobile logo */}
            <div className="lg:hidden flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-6">
              <Users className="h-6 w-6" />
              <span className="font-display font-bold text-lg tracking-tight uppercase">TeamFair</span>
            </div>
            
            <h2 className="font-display text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">
              {isSignUp ? t(language, "loginSubmitSignUp") : t(language, "loginSubmitSignIn")}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5">
              {tr(language, "Truy cập không gian làm việc học tập", "Access your academic workspace")}
            </p>
          </div>

          {/* Social Google Sign-in */}
          <Button 
            type="button" 
            variant="outline" 
            className="w-full h-11 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-xl flex items-center justify-center gap-2 font-medium text-slate-750 dark:text-slate-250 transition-all duration-200" 
            disabled={googleLoading || loading} 
            onClick={() => void handleGoogle()}
          >
            {googleLoading ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            {t(language, "loginWithGoogle")}
          </Button>

          {/* Separation line */}
          <div className="relative flex items-center justify-center my-4">
            <div className="absolute w-full border-t border-slate-100 dark:border-slate-800" />
            <span className="relative bg-white dark:bg-slate-950 px-3 text-xs uppercase text-slate-400 dark:text-slate-500 font-semibold tracking-wider">
              {language === "vi" ? "Hoặc email" : "Or email"}
            </span>
          </div>

          {/* Login Form */}
          <form onSubmit={(e) => void handleLogin(e)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider">
                Email
              </Label>
              <div className="relative group/input">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within/input:text-indigo-600 transition-colors">
                  <Mail className="h-4.5 w-4.5" />
                </span>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-205 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-bold text-xs uppercase tracking-wider">
                {t(language, "loginPassword")}
              </Label>
              <div className="relative group/input">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within/input:text-indigo-600 transition-colors">
                  <Lock className="h-4.5 w-4.5" />
                </span>
                <Input
                  id="password"
                  type="password"
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 h-11 rounded-xl bg-slate-50 dark:bg-slate-900 border-slate-205 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-950 focus:ring-2 focus:ring-indigo-500/20 transition-all duration-200"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {!isSignUp && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  {tr(language, "Quên mật khẩu?", "Forgot password?")}
                </button>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white font-semibold shadow-md shadow-indigo-600/20 hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2" 
              disabled={loading || googleLoading}
            >
              {loading ? (
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
              ) : (
                <ChevronRight className="h-4.5 w-4.5" />
              )}
              {isSignUp ? t(language, "loginSubmitSignUp") : t(language, "loginSubmitSignIn")}
            </Button>
          </form>

          {/* Toggle Action */}
          <button
            type="button"
            className="w-full text-center text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
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
