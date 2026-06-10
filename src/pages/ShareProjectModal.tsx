import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam } from "@/context/TeamContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"; // Component Dialog (ví dụ Shadcn)
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner"; // Hoặc thư viện toast bạn đang dùng
import { Share2, Clock, Users, Zap, ShieldCheck, Loader2, Check, Copy, Trash2, Shield } from "lucide-react";
import { useShareModalStore } from "@/hooks/useShareModalStore"; // Store vừa tạo ở Bước 2

// Hàm dịch ngôn ngữ (giữ nguyên hàm của bạn)
const tr = (lang: string, vi: string, en: string) => (lang === "vi" ? vi : en);

export const ShareProjectModal: React.FC = () => {
    
  // Lấy trạng thái đóng mở toàn cục từ Zustand Store
  const { isOpen, closeShareModal, openShareModal } = useShareModalStore();
  console.log("2. Trạng thái Modal hiện tại làisOpen =", isOpen);

  // Các hook dữ liệu hiện tại của bạn
  const { profile } = useAuth();
  const { language } = useLanguage();
  const { generateInviteCode, fetchActiveInvites, revokeInvite, activeInvites } = useTeam();

  // Toàn bộ State cũ của panel Share Project
  const [shareStep, setShareStep] = useState<"none" | "form">("form"); // Mặc định là "form" luôn vì đây là Modal Share riêng biệt
  const [shareExpiration, setShareExpiration] = useState<string>("never");
  const [shareMaxUses, setShareMaxUses] = useState<string>("");
  const [shareApprovalMode, setShareApprovalMode] = useState<"auto" | "requires_approval">("auto");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // --- TOÀN BỘ CÁC HÀM XỬ LÝ CỦA BẠN (GIỮ NGUYÊN LOGIC) ---
  const handleCopyUid = () => {
    if (profile?.id) {
      void navigator.clipboard.writeText(profile.id);
      setCopied(true);
      toast.success(tr(language, "Đã sao chép UID!", "UID copied!"));
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getExpirationDate = (): Date | null => {
    const now = new Date();
    switch (shareExpiration) {
      case "1h": return new Date(now.getTime() + 60 * 60 * 1000);
      case "24h": return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case "7d": return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case "30d": return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default: return null;
    }
  };

  const handleGenerateInvite = async () => {
    setInviteLoading(true);
    try {
      const maxUses = shareMaxUses.trim() ? parseInt(shareMaxUses, 10) : null;
      if (maxUses !== null && (isNaN(maxUses) || maxUses <= 0)) {
        toast.error(tr(language, "Số lượt sử dụng phải là số nguyên dương.", "Max uses must be a positive integer."));
        return;
      }
      const invite = await generateInviteCode(getExpirationDate(), maxUses, shareApprovalMode);
      setGeneratedCode(invite.id);
      toast.success(tr(language, "Tạo mã mời thành công!", "Invite code generated!"));
      void fetchActiveInvites(); // Tải lại danh sách sau khi tạo
    } catch (err) {
      console.error("Error generating invite:", err);
      toast.error(tr(language, "Lỗi tạo mã mời", "Failed to generate invite"), {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyCode = (code: string) => {
    void navigator.clipboard.writeText(code);
    setCodeCopied(true);
    toast.success(tr(language, "Đã sao chép mã mời!", "Invite code copied!"));
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await revokeInvite(inviteId);
      toast.success(tr(language, "Đã thu hồi mã mời.", "Invite revoked."));
    } catch (err) {
      toast.error(tr(language, "Lỗi thu hồi mã mời", "Failed to revoke invite"), {
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const formatInviteExpiry = (expiresAt: string | null): string => {
    if (!expiresAt) return tr(language, "Không hết hạn", "Never");
    const d = new Date(expiresAt);
    const now = new Date();
    if (d <= now) return tr(language, "Đã hết hạn", "Expired");
    const diff = d.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d ${hours % 24}h`;
    return `${hours}h`;
  };

  // Tự động gọi fetch danh sách khi modal mở ra
  React.useEffect(() => {
    if (isOpen) {
      void fetchActiveInvites();
    }
  }, [isOpen]);
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeShareModal()}>
      <DialogContent className="sm:max-w-[480px] bg-slate-900 border-slate-800 text-slate-100 max-h-[90vh] overflow-y-auto">
        <div className="space-y-5">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2.5">
            <Share2 className="h-5.5 w-5.5 text-indigo-400" />
            {tr(language, "Chia sẻ Dự án", "Share Project")}
          </DialogTitle>
        </DialogHeader>
        
        {/* Đưa UID hiển thị vào bên trong Modal */}
        <div className="space-y-2 mb-4">
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

        {/* Đoạn UI Share Form của bạn */}
        {shareStep === "form" && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-300 bg-clip-text text-transparent flex items-center gap-2.5">
                <Share2 className="h-5.5 w-5.5 text-indigo-400" />
                {tr(language, "Chia sẻ Dự án", "Share Project")}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm mt-1">
                {tr(
                  language,
                  "Tạo mã mời với cấu hình bảo mật tùy chỉnh để chia sẻ dự án với người khác.",
                  "Generate secure invite codes with custom settings to share your project."
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              {/* Expiration Dropdown */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {tr(language, "Thời gian hết hạn", "Expiration")}
                </Label>
                <select
                  value={shareExpiration}
                  onChange={(e) => setShareExpiration(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl p-3 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-sm transition-all outline-none cursor-pointer"
                >
                  <option value="never">{tr(language, "Không hết hạn", "Never")}</option>
                  <option value="1h">{tr(language, "1 giờ", "1 hour")}</option>
                  <option value="24h">{tr(language, "24 giờ", "24 hours")}</option>
                  <option value="7d">{tr(language, "7 ngày", "7 days")}</option>
                  <option value="30d">{tr(language, "30 ngày", "30 days")}</option>
                </select>
              </div>

              {/* Max Uses Input */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {tr(language, "Số lượt sử dụng tối đa", "Max Uses")}
                </Label>
                <Input
                  type="number"
                  min={1}
                  placeholder={tr(language, "Không giới hạn", "Unlimited")}
                  value={shareMaxUses}
                  onChange={(e) => setShareMaxUses(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500 py-3 font-medium"
                />
              </div>

              {/* Approval Mode Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {tr(language, "Chế độ phê duyệt", "Approval Mode")}
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShareApprovalMode("auto")}
                    className={`relative p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${shareApprovalMode === "auto"
                      ? "border-emerald-500/60 bg-emerald-500/5 shadow-md shadow-emerald-500/10"
                      : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                    }`}
                  >
                    <Zap className={`h-4.5 w-4.5 mb-2 ${shareApprovalMode === "auto" ? "text-emerald-400" : "text-slate-500"}`} />
                    <span className={`block text-xs font-bold ${shareApprovalMode === "auto" ? "text-emerald-300" : "text-slate-400"}`}>
                      {tr(language, "Tham gia Ngay", "Join Instantly")}
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-1 leading-snug">
                      {tr(language, "Tự động phê duyệt", "Auto-approve")}
                    </span>
                    {shareApprovalMode === "auto" && (
                      <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50 animate-pulse" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setShareApprovalMode("requires_approval")}
                    className={`relative p-3.5 rounded-xl border-2 text-left transition-all duration-200 ${shareApprovalMode === "requires_approval"
                      ? "border-amber-500/60 bg-amber-500/5 shadow-md shadow-amber-500/10"
                      : "border-slate-800 bg-slate-950/50 hover:border-slate-700"
                    }`}
                  >
                    <ShieldCheck className={`h-4.5 w-4.5 mb-2 ${shareApprovalMode === "requires_approval" ? "text-amber-400" : "text-slate-500"}`} />
                    <span className={`block text-xs font-bold ${shareApprovalMode === "requires_approval" ? "text-amber-300" : "text-slate-400"}`}>
                      {tr(language, "Cần Phê duyệt", "Requires Approval")}
                    </span>
                    <span className="block text-[10px] text-slate-500 mt-1 leading-snug">
                      {tr(language, "Trưởng nhóm duyệt", "Leader approves")}
                    </span>
                    {shareApprovalMode === "requires_approval" && (
                      <div className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-amber-400 shadow-lg shadow-amber-400/50 animate-pulse" />
                    )}
                  </button>
                </div>
              </div>

              {/* Generate Button */}
              <Button
                type="button"
                onClick={() => void handleGenerateInvite()}
                disabled={inviteLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl py-3 h-auto transition-all flex items-center justify-center gap-2 border-0 shadow-lg shadow-indigo-600/15"
              >
                {inviteLoading ? (
                  <>
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                    {tr(language, "Đang tạo...", "Generating...")}
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    {tr(language, "Tạo mã mời", "Generate Invite Code")}
                  </>
                )}
              </Button>

              {/* Generated Code Display */}
              {generatedCode && (
                <div className="bg-gradient-to-r from-indigo-950/40 to-violet-950/40 border border-indigo-500/30 rounded-2xl p-4 animate-in fade-in zoom-in-95 duration-300">
                  <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">
                    {tr(language, "Mã mời đã tạo", "Generated Invite Code")}
                  </p>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xl font-extrabold text-white tracking-wider select-all">
                      {generatedCode}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => handleCopyCode(generatedCode)}
                      className="p-2 h-auto hover:bg-indigo-500/20 rounded-xl text-indigo-400 hover:text-white transition-all"
                    >
                      {codeCopied ? <Check className="h-4.5 w-4.5 text-emerald-400" /> : <Copy className="h-4.5 w-4.5" />}
                    </Button>
                  </div>
                </div>
              )}

              {/* Active Invites List */}
              {activeInvites.length > 0 && (
                <div className="space-y-2.5 pt-3 border-t border-slate-800/60">
                  <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {tr(language, "Mã mời đang hoạt động", "Active Invites")} ({activeInvites.length})
                  </h4>
                  <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                    {activeInvites.map((inv) => {
                      const isExpired = inv.expires_at && new Date(inv.expires_at) <= new Date();
                      const isMaxed = inv.max_uses !== null && inv.uses_count >= inv.max_uses;
                      return (
                        <div
                          key={inv.id}
                          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${isExpired || isMaxed
                            ? "bg-slate-950/40 border-rose-900/30 opacity-60"
                            : "bg-slate-950/60 border-slate-800/50 hover:border-slate-700"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="font-mono text-xs font-bold text-slate-200 tracking-wide">
                              {inv.id}
                            </span>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-500">
                                {inv.uses_count}/{inv.max_uses ?? "∞"} {tr(language, "lượt", "uses")}
                              </span>
                              <span className="text-[10px] text-slate-600">•</span>
                              <span className={`text-[10px] ${isExpired ? "text-rose-400" : "text-slate-500"}`}>
                                {formatInviteExpiry(inv.expires_at)}
                              </span>
                              <span className="text-[10px] text-slate-600">•</span>
                              <span className={`text-[10px] font-semibold ${inv.approval_mode === "auto" ? "text-emerald-400" : "text-amber-400"}`}>
                                {inv.approval_mode === "auto" ? tr(language, "Tự động", "Auto") : tr(language, "Duyệt", "Approval")}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyCode(inv.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-400 hover:bg-indigo-950/20 transition-all"
                              title="Copy"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRevokeInvite(inv.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all"
                              title="Revoke"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            
          </div>
          
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
};