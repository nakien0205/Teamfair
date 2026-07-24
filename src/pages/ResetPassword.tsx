import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { consumeRecoveryEventProof, isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { Clock, Eye, EyeOff } from "lucide-react";

type RecoveryProof = { userId: string };
type RecoveryState = "checking" | "ready" | "invalid" | "submitting" | "complete";

const RESET_WINDOW_SECONDS = 300; // 5 minutes

const ResetPassword = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [proof, setProof] = useState<RecoveryProof | null>(null);
  const proofReceived = useRef(false);
  const proofUserId = useRef<string | null>(null);
  const [state, setState] = useState<RecoveryState>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [timeLeft, setTimeLeft] = useState(RESET_WINDOW_SECONDS);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setState("invalid");
      return;
    }

    let active = true;
    const proveRecovery = (userId: string) => {
      if (!active) return;
      proofReceived.current = true;
      proofUserId.current = userId;
      setProof({ userId });
      setState("ready");
      setTimeLeft(RESET_WINDOW_SECONDS);
      window.history.replaceState({}, document.title, window.location.pathname);
    };
    const invalidateProof = () => {
      proofReceived.current = false;
      proofUserId.current = null;
      setProof(null);
      setState("invalid");
    };
    const bridgeProof = consumeRecoveryEventProof();
    if (bridgeProof) proveRecovery(bridgeProof.userId);
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session?.user) {
        const eventProof = consumeRecoveryEventProof();
        if (eventProof?.userId === session.user.id) proveRecovery(session.user.id);
      } else if (proofUserId.current && session?.user?.id !== proofUserId.current) {
        invalidateProof();
      }
    });

    const timer = window.setTimeout(() => {
      if (active && !proofReceived.current) setState(current => current === "checking" ? "invalid" : current);
    }, 2000);
    return () => {
      active = false;
      window.clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  // 5-minute expiry countdown timer
  useEffect(() => {
    if (state !== "ready") return;

    const interval = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          proofReceived.current = false;
          proofUserId.current = null;
          setProof(null);
          setState("invalid");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [state]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!proof || state !== "ready") return;
    if (password.length < 8) {
      setFormError(tr(language, "Mật khẩu phải có ít nhất 8 ký tự.", "Password must be at least 8 characters."));
      return;
    }
    if (password !== confirmation) {
      setFormError(tr(language, "Xác nhận mật khẩu không khớp.", "Password confirmation does not match."));
      return;
    }

    setFormError(null);
    setState("submitting");
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError || data.user?.id !== proof.userId) {
      proofReceived.current = false;
      proofUserId.current = null;
      setProof(null);
      setState("invalid");
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setState("invalid");
      return;
    }
    setPassword("");
    setConfirmation("");
    setState("complete");
    window.setTimeout(() => navigate("/login", { replace: true }), 1200);
  };

  const recoveryLink = <Link className="font-medium text-indigo-300 hover:text-indigo-200" to="/forgot-password">{tr(language, "Yêu cầu liên kết mới", "Request a new link")}</Link>;

  const formatMinutesSeconds = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <h1 className="text-2xl font-bold">{tr(language, "Chọn mật khẩu mới", "Choose a new password")}</h1>
        
        {(state === "ready" || state === "submitting") && (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300">
            <Clock className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              {tr(language, "Phiên hết hạn sau:", "Session expires in:")}{" "}
              <strong className="font-mono font-bold text-amber-200">{formatMinutesSeconds(timeLeft)}</strong>
            </span>
          </div>
        )}

        {state === "checking" && <p className="mt-4 text-slate-300">{tr(language, "Đang kiểm tra liên kết đặt lại...", "Checking reset link...")}</p>}
        {state === "invalid" && <div className="mt-4 space-y-4"><p>{tr(language, "Liên kết đặt lại không hợp lệ, đã hết hạn hoặc đã được sử dụng. Mật khẩu của bạn chưa thay đổi.", "This reset link is invalid, expired, or already used. Your password was not changed.")}</p>{recoveryLink}</div>}
        {state === "complete" && <p className="mt-4">{tr(language, "Mật khẩu đã được cập nhật. Đang chuyển đến trang đăng nhập...", "Password updated. Redirecting to sign in...")}</p>}
        {(state === "ready" || state === "submitting") && (
          <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="new-password">{tr(language, "Mật khẩu mới", "New password")}</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  disabled={state === "submitting"}
                  onChange={(event) => setPassword(event.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label={showPassword ? tr(language, "Ẩn mật khẩu", "Hide password") : tr(language, "Hiện mật khẩu", "Reveal password")}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">{tr(language, "Xác nhận mật khẩu", "Confirm password")}</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmation ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmation}
                  disabled={state === "submitting"}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmation(!showConfirmation)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  aria-label={showConfirmation ? tr(language, "Ẩn mật khẩu", "Hide password") : tr(language, "Hiện mật khẩu", "Reveal password")}
                >
                  {showConfirmation ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {formError && <p role="alert" className="text-sm text-rose-300">{formError}</p>}
            <Button type="submit" className="w-full" disabled={state === "submitting"}>{state === "submitting" ? tr(language, "Đang cập nhật...", "Updating...") : tr(language, "Cập nhật mật khẩu", "Update password")}</Button>
          </form>
        )}
      </section>
    </main>
  );
};

export default ResetPassword;
