import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings, User, Mail, Shield, Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onOpenChange }) => {
  const { profile, updateProfileName } = useAuth();
  const { language } = useLanguage();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (profile?.full_name) {
      setName(profile.full_name);
    }
  }, [profile]);

  const handleCopyUid = () => {
    if (!profile?.id) return;
    void navigator.clipboard.writeText(profile.id);
    setCopied(true);
    toast.success(tr(language, "Đã sao chép UID!", "UID Copied!"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error(tr(language, "Vui lòng nhập tên hợp lệ", "Please enter a valid name"));
      return;
    }

    setLoading(true);
    try {
      await updateProfileName(trimmed);
      toast.success(tr(language, "Cập nhật hồ sơ thành công!", "Profile updated successfully!"));
      onOpenChange(false);
    } catch (err) {
      console.error("Error updating profile:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      toast.error(tr(language, "Lỗi cập nhật hồ sơ", "Failed to update profile"), { description: errorMessage });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl z-[9999] animate-in zoom-in-95 duration-200">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-300 bg-clip-text text-transparent flex items-center gap-2.5">
            <Settings className="h-5.5 w-5.5 text-indigo-400" />
            {tr(language, "Cấu hình Tài khoản", "Account Settings")}
          </DialogTitle>
          <DialogDescription className="text-slate-400 text-sm mt-1">
            {tr(
              language,
              "Quản lý thông tin hồ sơ cá nhân và thông tin tài khoản Teamfair của bạn.",
              "Manage your personal profile details and Teamfair account credentials."
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSave(e)} className="space-y-6 py-4">
          <div className="space-y-4">
            {/* Email (Read Only) */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                Email
              </Label>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 text-slate-400 text-sm select-all">
                {profile?.email || "—"}
              </div>
            </div>

            {/* Supabase UID (Copyable) */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" />
                UID
              </Label>
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-2.5 flex items-center justify-between gap-2 shadow-inner">
                <span className="font-mono text-xs text-slate-300 truncate tracking-tight select-all flex-1">
                  {profile?.id || "—"}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCopyUid}
                  className="p-1 h-auto hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400 animate-in fade-in" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Display Name Input */}
            <div className="space-y-2">
              <Label htmlFor="settings-fullname" className="text-xs font-bold text-indigo-400 uppercase tracking-widest flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {tr(language, "Tên Hiển Thị", "Display Name")}
              </Label>
              <Input
                id="settings-fullname"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all py-5 font-medium"
              />
            </div>
          </div>

          <DialogFooter className="flex items-center gap-2 sm:justify-end pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800/50"
            >
              {tr(language, "Hủy bỏ", "Cancel")}
            </Button>
            <Button
              type="submit"
              disabled={loading || name.trim() === profile?.full_name}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl px-5 transition-all flex items-center gap-2 border-0 shadow-lg shadow-indigo-600/15"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  {tr(language, "Đang lưu...", "Saving...")}
                </>
              ) : (
                tr(language, "Lưu Thay Đổi", "Save Changes")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
