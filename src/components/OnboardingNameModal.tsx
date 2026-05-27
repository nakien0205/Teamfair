import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, User } from "lucide-react";
import { toast } from "sonner";

export const OnboardingNameModal: React.FC = () => {
  const { profile, updateProfileName } = useAuth();
  const { language } = useLanguage();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  // Modal is open ONLY when user is logged in, profile exists, but profile is not completed
  const isOpen = Boolean(profile && !profile.profile_completed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(
        tr(language, "Vui lòng nhập tên hợp lệ", "Please enter a valid name")
      );
      return;
    }

    setLoading(true);
    try {
      await updateProfileName(trimmed);
      toast.success(
        tr(language, "Chào mừng đến với Teamfair!", "Welcome to Teamfair!")
      );
    } catch (err) {
      console.error("Error setting name:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error(
        tr(language, "Không thể lưu tên của bạn", "Failed to save your name"),
        { description: errorMessage }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent 
        className="sm:max-w-[420px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl z-[9999]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="flex flex-col items-center text-center">
          <div className="p-3.5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 shadow-md mb-3">
            <User className="h-6 w-6 text-indigo-400" />
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
            {tr(language, "Thiết lập Hồ sơ", "Set Up Your Profile")}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm mt-1.5">
            {tr(
              language,
              "Chào mừng! Vui lòng nhập tên đầy đủ của bạn để tiếp tục. Tên này sẽ hiển thị với đồng nghiệp và giảng viên.",
              "Welcome! Please enter your full name to continue. This is how you will appear to peers and lecturers."
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5 py-4">
          <div className="space-y-2">
            <Label htmlFor="fullname-input" className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
              {tr(language, "Họ và Tên", "Full Name")}
            </Label>
            <Input
              id="fullname-input"
              required
              placeholder="e.g. Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all py-5 font-medium"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl py-5 transition-all flex items-center justify-center gap-2 border-0 shadow-lg shadow-indigo-600/15"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  {tr(language, "Đang lưu...", "Saving...")}
                </>
              ) : (
                tr(language, "Hoàn tất Thiết lập", "Complete Setup")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
