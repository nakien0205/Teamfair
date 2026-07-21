import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { consumeRecoveryEventProof, isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

type RecoveryProof = { userId: string };
type RecoveryState = "checking" | "ready" | "invalid" | "submitting" | "complete";

const ResetPassword = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [proof, setProof] = useState<RecoveryProof | null>(null);
  const proofReceived = useRef(false);
  const proofUserId = useRef<string | null>(null);
  const [state, setState] = useState<RecoveryState>("checking");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <h1 className="text-2xl font-bold">{tr(language, "Chọn mật khẩu mới", "Choose a new password")}</h1>
        {state === "checking" && <p className="mt-4 text-slate-300">{tr(language, "Đang kiểm tra liên kết đặt lại...", "Checking reset link...")}</p>}
        {state === "invalid" && <div className="mt-4 space-y-4"><p>{tr(language, "Liên kết đặt lại không hợp lệ, đã hết hạn hoặc đã được sử dụng. Mật khẩu của bạn chưa thay đổi.", "This reset link is invalid, expired, or already used. Your password was not changed.")}</p>{recoveryLink}</div>}
        {state === "complete" && <p className="mt-4">{tr(language, "Mật khẩu đã được cập nhật. Đang chuyển đến trang đăng nhập...", "Password updated. Redirecting to sign in...")}</p>}
        {(state === "ready" || state === "submitting") && (
          <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-2"><Label htmlFor="new-password">{tr(language, "Mật khẩu mới", "New password")}</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} disabled={state === "submitting"} onChange={(event) => setPassword(event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="confirm-password">{tr(language, "Xác nhận mật khẩu", "Confirm password")}</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirmation} disabled={state === "submitting"} onChange={(event) => setConfirmation(event.target.value)} /></div>
            {formError && <p role="alert" className="text-sm text-rose-300">{formError}</p>}
            <Button type="submit" className="w-full" disabled={state === "submitting"}>{state === "submitting" ? tr(language, "Đang cập nhật...", "Updating...") : tr(language, "Cập nhật mật khẩu", "Update password")}</Button>
          </form>
        )}
      </section>
    </main>
  );
};

export default ResetPassword;
