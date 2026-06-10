import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User, GraduationCap, Presentation, ArrowRight, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

export const OnboardingNameModal: React.FC = () => {
  const { profile, refreshProfile } = useAuth();
  const { language } = useLanguage();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<"student" | "lecturer" | null>(null);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal is open ONLY when user is logged in, profile exists, but profile is not completed
  const isOpen = Boolean(profile && !profile.profile_completed);

  const handleNextStep = () => {
    if (!selectedRole) {
      toast.error(
        tr(language, "Vui lòng chọn một vai trò", "Please select a role")
      );
      return;
    }
    setStep(2);
  };

  const handlePrevStep = () => {
    setStep(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(
        tr(language, "Vui lòng nhập tên hợp lệ", "Please enter a valid name")
      );
      return;
    }
    if (!selectedRole) {
      toast.error(
        tr(language, "Vui lòng chọn một vai trò", "Please select a role")
      );
      return;
    }

    setLoading(true);
    try {
      const { error: rpcError } = await supabase.rpc("complete_signup_profile", {
        p_role: selectedRole,
        p_full_name: trimmed,
      });

      if (rpcError) {
        throw new Error(rpcError.message || "Failed to complete your profile setup.");
      }

      await refreshProfile();

      toast.success(
        tr(language, "Chào mừng đến với Teamfair!", "Welcome to Teamfair!")
      );
    } catch (err) {
      console.error("Error completing onboarding:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error(
        tr(language, "Không thể hoàn tất thiết lập hồ sơ", "Failed to complete profile setup"),
        { description: errorMessage }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-[460px] bg-slate-950/95 backdrop-blur-xl border border-slate-800 text-slate-100 rounded-3xl p-7 shadow-2xl z-[9999]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full mb-3">
            <span className="text-[11px] font-bold tracking-wider text-indigo-400 uppercase">
              {tr(language, `BƯỚC ${step} / 2`, `STEP ${step} OF 2`)}
            </span>
          </div>

          <DialogTitle className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-indigo-100 to-indigo-200 bg-clip-text text-transparent">
            {step === 1 
              ? tr(language, "Chọn vai trò của bạn", "Choose Your Role")
              : tr(language, "Thiết lập Họ và Tên", "Set Up Your Name")
            }
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm mt-2 max-w-sm">
            {step === 1
              ? tr(
                  language,
                  "Bạn sẽ sử dụng Teamfair với mục đích gì? Vui lòng chọn chính xác vai trò vì không thể tự thay đổi sau này.",
                  "How will you use Teamfair? Please choose accurately as you cannot change this role yourself later."
                )
              : tr(
                  language,
                  "Vui lòng nhập họ và tên thật của bạn để các thành viên khác và giảng viên có thể nhận diện.",
                  "Please enter your real full name so your peers and lecturers can identify you."
                )
            }
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 py-6">
            <div className="grid grid-cols-2 gap-4">
              {/* Student Card */}
              <button
                type="button"
                onClick={() => setSelectedRole("student")}
                className={`group flex flex-col items-center text-center p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden bg-slate-900/40 hover:bg-slate-900 cursor-pointer ${
                  selectedRole === "student"
                    ? "border-indigo-500 bg-indigo-950/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className={`p-3.5 rounded-xl transition-all duration-300 mb-3.5 ${
                  selectedRole === "student"
                    ? "bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 scale-110"
                    : "bg-slate-950 border border-slate-850 text-slate-400 group-hover:scale-105"
                }`}>
                  <GraduationCap className="h-6 w-6" />
                </div>
                <span className={`font-bold text-sm block transition-colors ${
                  selectedRole === "student" ? "text-indigo-300" : "text-slate-200"
                }`}>
                  {tr(language, "Sinh viên", "Student")}
                </span>
                <span className="text-[10px] text-slate-500 mt-1.5 leading-relaxed max-w-[140px]">
                  {tr(
                    language,
                    "Tham gia nhóm, gửi đánh giá chéo & báo cáo tiến độ.",
                    "Join groups, submit peer reviews & report progress."
                  )}
                </span>
              </button>

              {/* Lecturer Card */}
              <button
                type="button"
                onClick={() => setSelectedRole("lecturer")}
                className={`group flex flex-col items-center text-center p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden bg-slate-900/40 hover:bg-slate-900 cursor-pointer ${
                  selectedRole === "lecturer"
                    ? "border-violet-500 bg-violet-950/20 shadow-[0_0_20px_rgba(139,92,246,0.15)]"
                    : "border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className={`p-3.5 rounded-xl transition-all duration-300 mb-3.5 ${
                  selectedRole === "lecturer"
                    ? "bg-violet-500/20 border border-violet-500/30 text-violet-400 scale-110"
                    : "bg-slate-950 border border-slate-850 text-slate-400 group-hover:scale-105"
                }`}>
                  <Presentation className="h-6 w-6" />
                </div>
                <span className={`font-bold text-sm block transition-colors ${
                  selectedRole === "lecturer" ? "text-violet-300" : "text-slate-200"
                }`}>
                  {tr(language, "Giảng viên", "Lecturer")}
                </span>
                <span className="text-[10px] text-slate-500 mt-1.5 leading-relaxed max-w-[140px]">
                  {tr(
                    language,
                    "Tạo & quản lý dự án nhóm, chấm điểm & duyệt tiến trình.",
                    "Create & manage team projects, grade & approve progress."
                  )}
                </span>
              </button>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-900">
              <Button
                type="button"
                onClick={handleNextStep}
                disabled={!selectedRole}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl py-5 transition-all flex items-center justify-center gap-1.5 border-0 shadow-lg shadow-indigo-600/15 cursor-pointer"
              >
                {tr(language, "Tiếp tục", "Continue")}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 py-6">
            <div className="space-y-2">
              <Label htmlFor="fullname-input" className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
                {tr(language, "Họ và Tên đầy đủ", "Full Name")}
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600">
                  <User className="h-4.5 w-4.5" />
                </span>
                <Input
                  id="fullname-input"
                  required
                  autoFocus
                  placeholder={tr(language, "e.g. Nguyễn Văn A", "e.g. John Doe")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-700 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all py-5.5 pl-11 font-medium text-sm"
                />
              </div>
            </div>

            <DialogFooter className="pt-4 border-t border-slate-900 flex flex-row items-center gap-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handlePrevStep}
                disabled={loading}
                className="flex-1 bg-transparent hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 font-semibold rounded-xl py-5 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
                {tr(language, "Quay lại", "Back")}
              </Button>

              <Button
                type="submit"
                disabled={loading || !name.trim()}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl py-5 transition-all flex items-center justify-center gap-1.5 border-0 shadow-lg shadow-indigo-600/15 cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    {tr(language, "Đang lưu...", "Saving...")}
                  </>
                ) : (
                  <>
                    {tr(language, "Hoàn tất Thiết lập", "Complete Setup")}
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
