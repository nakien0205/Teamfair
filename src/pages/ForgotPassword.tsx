import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";

const ForgotPassword = () => {
  const { language } = useLanguage();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setEmailError(tr(language, "Nhập địa chỉ email hợp lệ.", "Enter a valid email address."));
      return;
    }

    setEmailError(null);
    setSubmitting(true);
    try {
      if (isSupabaseConfigured) {
        await supabase.auth.resetPasswordForEmail(normalizedEmail, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
      }
    } catch {
      // Deliberately keep this indistinguishable from a successful request.
    } finally {
      setSubmitting(false);
      setComplete(true);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <section className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <h1 className="text-2xl font-bold">{tr(language, "Đặt lại mật khẩu", "Reset your password")}</h1>
        {complete ? (
          <div className="mt-4 space-y-5">
            <p>{tr(language, "Nếu tài khoản phù hợp tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu. Hãy kiểm tra email của bạn.", "If a matching account exists, password-reset instructions have been sent. Check your email.")}</p>
            <Link className="font-medium text-indigo-300 hover:text-indigo-200" to="/login">
              {tr(language, "Quay lại đăng nhập", "Back to sign in")}
            </Link>
          </div>
        ) : (
          <form className="mt-5 space-y-4" onSubmit={(event) => void handleSubmit(event)}>
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Email</Label>
              <Input
                id="recovery-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={Boolean(emailError)}
                aria-describedby={emailError ? "recovery-email-error" : undefined}
              />
              {emailError && <p id="recovery-email-error" role="alert" className="text-sm text-rose-300">{emailError}</p>}
            </div>
            <Button className="w-full" disabled={submitting} type="submit">
              {submitting ? tr(language, "Đang gửi...", "Sending...") : tr(language, "Gửi liên kết đặt lại", "Send reset link")}
            </Button>
            <Link className="block text-center text-sm font-medium text-indigo-300 hover:text-indigo-200" to="/login">
              {tr(language, "Quay lại đăng nhập", "Back to sign in")}
            </Link>
          </form>
        )}
      </section>
    </main>
  );
};

export default ForgotPassword;
