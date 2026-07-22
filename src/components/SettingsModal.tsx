import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Settings, User, Mail, Shield, Check, Copy, AlertTriangle, Crown, ChevronDown, ShieldAlert, Share2, Trash2, X, Users } from "lucide-react";
import { toast } from "sonner";
import { useTeam } from "@/context/TeamContext";
import { supabase } from "@/lib/supabaseClient";
import { useShareModalStore } from "@/hooks/useShareModalStore";
import { GoogleCalendarConnectionCard } from "@/components/GoogleCalendarConnectionCard";
import { useEntitlements } from "@/context/EntitlementContext";

interface SettingsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultToMember?: boolean;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ open, onOpenChange, defaultToMember = false }) => {
  const { profile, updateProfileName } = useAuth();
  const { language } = useLanguage();
  const { groups, currentGroupIndex, members, loadPersistedState, deleteProject } = useTeam();
  const openShareModal = useShareModalStore((state) => state.openShareModal);

  let userPlan: any = "free";
  try {
    const entitlements = useEntitlements();
    userPlan = entitlements.plan;
  } catch {
    userPlan = "free";
  }

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Accordion and resignation step states
  const [isLeaderSecOpen, setIsLeaderSecOpen] = useState(false);
  const [resignStep, setResignStep] = useState<"none" | "verify" | "successor">("none");
  const [resignText, setResignText] = useState("");
  const [successorId, setSuccessorId] = useState("");

  // Danger Zone states
  const [isDangerSecOpen, setIsDangerSecOpen] = useState(false);
  const [deleteStep, setDeleteStep] = useState<"none" | "confirm">("none");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const currentGroup = groups[currentGroupIndex];
  const isCallerLeader = !defaultToMember && currentGroup && members.some(m => m.id === profile?.id && m.role === 'Leader');
  const otherMembers = currentGroup ? members.filter(m => m.id && m.id !== profile?.id) : [];

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

  // Cooldown calculation
  const lastChange = profile?.last_name_change_at ? new Date(profile.last_name_change_at) : null;
  const cooldownEnd = lastChange ? new Date(lastChange.getTime() + 30 * 24 * 60 * 60 * 1000) : null;
  const now = new Date();
  const isCooldownActive = cooldownEnd ? now < cooldownEnd : false;
  const remainingMs = cooldownEnd ? cooldownEnd.getTime() - now.getTime() : 0;
  const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCooldownActive) {
      toast.error(
        tr(
          language,
          `Bạn chỉ có thể đổi tên sau ${remainingDays} ngày nữa.`,
          `You can change your name again in ${remainingDays} days.`
        )
      );
      return;
    }

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

  // Promotion/Demotion Member Role update
  const handleUpdateMemberRole = async (targetUserId: string, newRole: 'student' | 'lecturer') => {
    if (!currentGroup?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.rpc("update_member_role", {
        p_group_id: currentGroup.id,
        p_target_user_id: targetUserId,
        p_new_role: newRole
      });
      if (error) throw new Error(error.message);
      toast.success(tr(language, "Cập nhật vai trò thành công!", "Role updated successfully!"));
      await loadPersistedState();
    } catch (err) {
      console.error("Error updating member role:", err);
      toast.error(tr(language, "Lỗi cập nhật vai trò", "Failed to update role"), {
        description: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setLoading(false);
    }
  };

  // Start Resignation flow
  const handleStartResign = () => {
    if (otherMembers.length === 0) {
      toast.error(
        tr(
          language,
          "Không thể từ chức vì nhóm không có thành viên khác để bàn giao.",
          "Cannot resign because the group has no other members to handover to."
        )
      );
      return;
    }
    setResignStep("verify");
    setResignText("");
    setSuccessorId("");
  };

  // Verify resignation text phrase
  const handleVerifyResign = () => {
    if (resignText !== "I resign my row") {
      toast.error(
        tr(
          language,
          "Vui lòng nhập chính xác cụm từ yêu cầu.",
          "Please type the exact verification phrase."
        )
      );
      return;
    }
    setResignStep("successor");
    if (otherMembers[0]?.id) {
      setSuccessorId(otherMembers[0].id);
    }
  };

  // Confirm resignation and successor handover
  const handleResignLeader = async () => {
    if (!currentGroup?.id || !successorId) {
      toast.error(tr(language, "Vui lòng chọn người kế nhiệm", "Please select a successor"));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.rpc("resign_as_leader", {
        p_group_id: currentGroup.id,
        p_new_leader_id: successorId
      });
      if (error) throw new Error(error.message);
      toast.success(tr(language, "Bàn giao quyền trưởng nhóm thành công!", "Leader role transferred successfully!"));
      setResignStep("none");
      onOpenChange(false);

      // Perform full page reload and redirect back to the home/projects view to rebuild workspace context
      window.location.href = "/";
    } catch (err) {
      console.error("Error during resignation:", err);
      toast.error(tr(language, "Lỗi từ chức", "Resignation failed"), {
        description: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setLoading(false);
    }
  };

  // Project sharing — open the invite creation form
  const handleShareProject = () => {
    onOpenChange(false);
    openShareModal();
  };

  // Project deletion handler
  const handleDeleteProject = async () => {
    if (!currentGroup?.id || deleteConfirmText !== currentGroup.name) return;
    setLoading(true);
    try {
      await deleteProject(currentGroup.id);
      toast.success(tr(language, "Xóa dự án thành công!", "Project deleted successfully!"));
      setDeleteStep("none");
      setDeleteConfirmText("");
      onOpenChange(false);
      window.location.href = "/projects";
    } catch (err) {
      console.error("Error during project deletion:", err);
      toast.error(tr(language, "Lỗi xóa dự án", "Project deletion failed"), {
        description: err instanceof Error ? err.message : String(err)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => {
      if (!val) {
        setResignStep("none");
        setDeleteStep("none");
      }
      onOpenChange(val);
    }}>
      <DialogContent className="sm:max-w-[520px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl z-[9999] animate-in zoom-in-95 duration-200">

        {resignStep === "none" && deleteStep === "none" && (
          <>
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
                    disabled={loading || isCooldownActive}
                    className={`bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-600 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500 transition-all py-5 font-medium ${isCooldownActive ? "opacity-60 cursor-not-allowed" : ""
                      }`}
                  />

                  {/* Cooldown warning & remaining time */}
                  {isCooldownActive && (
                    <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl text-xs animate-in fade-in slide-in-from-top-1 duration-200">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        {tr(
                          language,
                          `Tên hiển thị chỉ được thay đổi 30 ngày một lần. Vui lòng quay lại sau ${remainingDays} ngày nữa.`,
                          `Display name can only be changed once every 30 days. Please return in ${remainingDays} days.`
                        )}
                      </span>
                    </div>
                  )}
                </div>

                {/* Google Calendar Integration */}
                <div className="pt-2 border-t border-slate-800">
                  <GoogleCalendarConnectionCard userPlan={userPlan} />
                </div>

                {/* Member Management & Resign (Only for active Project Leader) */}
                {isCallerLeader && (
                  <div className="pt-2 border-t border-slate-850 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" />
                        {tr(language, "Quản lý Dự án & Thành viên", "Project & Member Management")}
                      </h3>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsLeaderSecOpen(!isLeaderSecOpen)}
                        className="p-1 h-auto text-indigo-400 hover:text-indigo-300 hover:bg-slate-800 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                      >
                        {isLeaderSecOpen ? tr(language, "Thu gọn", "Collapse") : tr(language, "Mở rộng", "Expand")}
                        <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isLeaderSecOpen ? "rotate-180" : ""}`} />
                      </Button>
                    </div>

                    {isLeaderSecOpen && (
                      <div className="space-y-4 p-4 bg-slate-950/40 border border-slate-850 rounded-2xl animate-in slide-in-from-top-2 duration-200 shadow-inner">
                        {/* Member Directory */}
                        <div className="space-y-2.5">
                          <Label className="text-[11px] font-bold text-slate-450 uppercase tracking-wider block">
                            {tr(language, "Danh sách Thành viên (Vai trò Hệ thống)", "Member Directory (Global Roles)")}
                          </Label>

                          <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                            {members.map((m) => {
                              const isSelf = m.id === profile?.id;
                              return (
                                <div key={m.id || m.name} className="flex items-center justify-between p-2 bg-slate-900/60 border border-slate-800/50 rounded-xl">
                                  <div className="min-w-0 flex-1 mr-2">
                                    <p className="text-xs font-bold text-slate-200 truncate">{m.name}</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">{m.role} (Group)</p>
                                  </div>

                                  {isSelf ? (
                                    <span className="text-[10px] px-2 py-1 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-lg font-semibold shrink-0">
                                      {m.role === "Leader"
                                        ? tr(language, "Trưởng nhóm", "Leader")
                                        : m.role === "Lecturer"
                                          ? tr(language, "Giảng viên", "Lecturer")
                                          : tr(language, "Thành viên", "Member")}
                                    </span>
                                  ) : (
                                    <select
                                      disabled={loading}
                                      value={m.globalRole || "student"}
                                      onChange={(e) => m.id && handleUpdateMemberRole(m.id, e.target.value as 'student' | 'lecturer')}
                                      className="bg-slate-950 border border-slate-800 text-slate-300 rounded-lg py-1 px-2 text-xs font-semibold focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer hover:bg-slate-900 transition-colors shrink-0 outline-none"
                                    >
                                      <option value="student">{tr(language, "Sinh viên", "Student")}</option>
                                      <option value="lecturer">{tr(language, "Giảng viên", "Lecturer")}</option>
                                    </select>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Resignation Button */}
                        {members.some(m => m.id === profile?.id && m.role === 'Leader') && (
                          <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-rose-400">{tr(language, "Từ chức Trưởng nhóm", "Resign Leadership")}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                                {tr(
                                  language,
                                  "Từ chức và nhượng lại quyền quản trị dự án hiện tại cho thành viên khác.",
                                  "Resign and hand over current project ownership to a peer."
                                )}
                              </p>
                            </div>
                            <Button
                              type="button"
                              onClick={handleStartResign}
                              className="bg-rose-500/10 border border-rose-500/20 hover:bg-rose-600 hover:border-rose-500 hover:text-white text-rose-400 font-bold text-xs rounded-xl px-4 py-3 h-auto transition-all cursor-pointer shrink-0"
                            >
                              {tr(language, "Từ chức", "Resign")}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Danger Zone Accordion */}
                    <div className="pt-2 border-t border-rose-950/40 space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-orange-500 uppercase tracking-widest flex items-center gap-1.5">
                          <ShieldAlert className="h-3.5 w-3.5 text-orange-500 animate-pulse" />
                          {tr(language, "Vùng Nguy Hiểm", "Danger Zone")}
                        </h3>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setIsDangerSecOpen(!isDangerSecOpen)}
                          className="p-1 h-auto text-orange-500 hover:text-orange-400 hover:bg-slate-800 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
                        >
                          {isDangerSecOpen ? tr(language, "Thu gọn", "Collapse") : tr(language, "Mở rộng", "Expand")}
                          <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${isDangerSecOpen ? "rotate-180" : ""}`} />
                        </Button>
                      </div>

                      {isDangerSecOpen && (
                        <div className="space-y-4 p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl animate-in slide-in-from-top-2 duration-200 shadow-inner">
                          {/* Option 1: Share Project */}
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-200">{tr(language, "Chia sẻ Dự án", "Share my Project")}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                                {tr(
                                  language,
                                  "Tạo mã mời để chia sẻ dự án này với các cộng tác viên.",
                                  "Generate invite codes to share this project with collaborators."
                                )}
                              </p>
                            </div>
                            <Button
                              type="button"
                              onClick={handleShareProject}
                              className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white font-bold text-xs rounded-xl px-4 py-3 h-auto transition-all cursor-pointer shrink-0"
                            >
                              <Share2 className="h-3.5 w-3.5 mr-1" />
                              {tr(language, "Mã mời", "Invite")}
                            </Button>
                          </div>

                          {/* Option 2: Delete Project */}
                          <div className="pt-3 border-t border-rose-950/30 flex items-center justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-rose-450">{tr(language, "Xóa Dự án", "Delete my Project")}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-normal">
                                {tr(
                                  language,
                                  "Xóa vĩnh viễn dự án này và toàn bộ dữ liệu. Hành động này không thể hoàn tác.",
                                  "Permanently delete this project workspace and all its data. This cannot be undone."
                                )}
                              </p>
                            </div>
                            <Button
                              type="button"
                              onClick={() => setDeleteStep("confirm")}
                              className="bg-rose-500/10 border border-rose-500/20 hover:bg-rose-600 hover:border-rose-500 hover:text-white text-rose-400 font-bold text-xs rounded-xl px-4 py-3 h-auto transition-all cursor-pointer shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1" />
                              {tr(language, "Xóa Dự án", "Delete Project")}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                  disabled={loading || isCooldownActive || name.trim() === profile?.full_name}
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
          </>
        )}

        {resignStep === "verify" && (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-rose-400 flex items-center gap-2.5">
                <AlertTriangle className="h-5.5 w-5.5" />
                {tr(language, "Xác nhận Từ chức Trưởng nhóm", "Confirm Leader Resignation")}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm mt-1">
                {tr(
                  language,
                  "Hành động này sẽ nhượng lại quyền Trưởng nhóm dự án hiện tại cho thành viên khác.",
                  "This action will hand over your current Project Leader position to another member."
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-4 text-sm leading-relaxed">
                {tr(
                  language,
                  "Cảnh báo: Bạn sẽ mất các quyền quản trị dự án, bao gồm quyền phân công và phê duyệt nhiệm vụ. Để tiếp tục, vui lòng nhập chính xác cụm từ bên dưới:",
                  "Warning: You will lose all project management rights, including assigning and approving tasks. To proceed, please type the exact phrase below:"
                )}
                <div className="mt-3 font-mono bg-slate-950/60 border border-slate-800 rounded px-3 py-1.5 text-center text-rose-400 font-bold select-all tracking-wide">
                  I resign my row
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {tr(language, "Nhập cụm từ xác nhận", "Verification Phrase")}
                </Label>
                <Input
                  required
                  autoFocus
                  value={resignText}
                  onChange={(e) => setResignText(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-700 rounded-xl focus-visible:ring-rose-500 focus-visible:border-rose-500 py-5 font-mono text-center text-sm font-semibold"
                  placeholder={tr(language, "Nhập cụm từ tại đây...", "Type phrase here...")}
                />
              </div>
            </div>

            <DialogFooter className="flex items-center gap-2 sm:justify-end pt-2 border-t border-slate-800/60">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setResignStep("none")}
                className="text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800/50"
              >
                {tr(language, "Hủy bỏ", "Cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleVerifyResign}
                disabled={resignText !== "I resign my row"}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl px-5 border-0 shadow-lg shadow-rose-600/15"
              >
                {tr(language, "Xác minh", "Verify")}
              </Button>
            </DialogFooter>
          </div>
        )}

        {resignStep === "successor" && (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-amber-400 flex items-center gap-2.5">
                <Crown className="h-5.5 w-5.5" />
                {tr(language, "Bàn giao Quyền lực", "Handover Leadership")}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm mt-1">
                {tr(
                  language,
                  "Vui lòng chọn thành viên kế nhiệm làm Trưởng nhóm mới của dự án.",
                  "Please select the successor who will assume the Project Leader role."
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                  {tr(language, "Chọn Trưởng nhóm mới", "Select New Leader")}
                </Label>
                <select
                  value={successorId}
                  onChange={(e) => setSuccessorId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 text-slate-100 rounded-xl p-3.5 focus:ring-amber-500 focus:border-amber-500 font-medium text-sm transition-all outline-none cursor-pointer"
                >
                  {otherMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <DialogFooter className="flex items-center gap-2 sm:justify-end pt-2 border-t border-slate-800/60">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setResignStep("verify")}
                className="text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800/50"
              >
                {tr(language, "Quay lại", "Back")}
              </Button>
              <Button
                type="button"
                onClick={handleResignLeader}
                disabled={loading || !successorId}
                className="bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl px-5 border-0 shadow-lg shadow-amber-600/15 flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {tr(language, "Xác nhận Bàn giao", "Confirm Handover")}
              </Button>
            </DialogFooter>
          </div>
        )}

        {deleteStep === "confirm" && (
          <div className="space-y-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold tracking-tight text-rose-500 flex items-center gap-2.5">
                <AlertTriangle className="h-5.5 w-5.5 text-rose-500" />
                {tr(language, "Xác nhận Xóa Dự án", "Confirm Project Deletion")}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-sm mt-1">
                {tr(
                  language,
                  "Hành động này sẽ xóa vĩnh viễn dự án hiện tại và tất cả dữ liệu liên quan.",
                  "This action will permanently delete the current project and all associated data."
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-4 text-sm leading-relaxed">
                {tr(
                  language,
                  "Cảnh báo: Hành động này không thể hoàn tác. Tất cả các task, tài liệu, logs, và báo cáo sẽ bị xóa vĩnh viễn. Để tiếp tục, vui lòng nhập chính xác tên dự án bên dưới:",
                  "Warning: This action cannot be undone. All tasks, materials, logs, and reports will be permanently purged. To proceed, please type the exact project name below:"
                )}
                <div className="mt-3 font-mono bg-slate-950/60 border border-slate-800 rounded px-3 py-1.5 text-center text-rose-450 font-bold select-all tracking-wide">
                  {currentGroup?.name}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  {tr(language, "Nhập tên dự án để xác nhận", "Project Name Verification")}
                </Label>
                <Input
                  required
                  autoFocus
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-700 rounded-xl focus-visible:ring-rose-500 focus-visible:border-rose-500 py-5 text-center text-sm font-semibold"
                  placeholder={tr(language, "Nhập tên dự án tại đây...", "Type project name here...")}
                />
              </div>
            </div>

            <DialogFooter className="flex items-center gap-2 sm:justify-end pt-2 border-t border-slate-800/60">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDeleteStep("none");
                  setDeleteConfirmText("");
                }}
                className="text-slate-400 hover:text-slate-200 rounded-xl hover:bg-slate-800/50"
              >
                {tr(language, "Hủy bỏ", "Cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleDeleteProject}
                disabled={loading || deleteConfirmText !== currentGroup?.name}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl px-5 border-0 shadow-lg shadow-rose-600/15 flex items-center gap-2"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {tr(language, "Tôi hiểu hệ quả, xóa dự án này", "I understand, delete this project")}
              </Button>
            </DialogFooter>
          </div>
        )}

      </DialogContent>
    </Dialog>
  );
};
