import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Copy,
  Globe2,
  Link2,
  Loader2,
  LockKeyhole,
  Mail,
  UserCircle2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam, type ProjectInvite } from "@/context/TeamContext";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useShareModalStore } from "@/hooks/useShareModalStore";
import {
  createGroupEmailInvite,
  listGroupEmailInvites,
  sendGroupEmailInviteEmail,
  type GroupEmailInvite,
} from "@/lib/teamPersistence";
import { tr } from "@/lib/i18n";

type AccessMode = "restricted" | "anyone";
type ApprovalMode = "auto" | "requires_approval";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseEmailList(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(/[,\s]+/)
        .map(email => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function isInviteUsable(invite: ProjectInvite) {
  const expired = invite.expires_at ? new Date(invite.expires_at) <= new Date() : false;
  const usedUp = invite.max_uses !== null && invite.uses_count >= invite.max_uses;
  return !expired && !usedUp;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "T").concat(parts[parts.length - 1]?.[0] ?? "").toUpperCase();
}

export const ShareProjectModal: React.FC = () => {
  const { isOpen, closeShareModal } = useShareModalStore();
  const { profile } = useAuth();
  const { language } = useLanguage();
  const {
    groups,
    currentGroupIndex,
    members,
    currentUserName,
    activeInvites,
    generateInviteCode,
    fetchActiveInvites,
    revokeInvite,
  } = useTeam();

  const [accessMode, setAccessMode] = useState<AccessMode>("restricted");
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>("requires_approval");
  const [peopleInput, setPeopleInput] = useState("");
  const [message, setMessage] = useState("");
  const [inviteRows, setInviteRows] = useState<GroupEmailInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const currentGroup = groups[currentGroupIndex] || groups[0];

  const generalInvite = useMemo(
    () => activeInvites.find(invite => invite.max_uses === null && invite.approval_mode === approvalMode && isInviteUsable(invite))
      ?? activeInvites.find(invite => invite.max_uses === null && isInviteUsable(invite))
      ?? null,
    [activeInvites, approvalMode],
  );

  const shareUrl = useMemo(() => {
    if (!generalInvite) return "";
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/projects?invite=${generalInvite.id}`;
  }, [generalInvite]);

  const loadSharingState = useCallback(async () => {
    if (!currentGroup?.id) return;
    setLoadingInvites(true);
    try {
      await fetchActiveInvites();
      const rows = await listGroupEmailInvites(currentGroup.id).catch(() => []);
      setInviteRows(rows);
    } finally {
      setLoadingInvites(false);
    }
  }, [currentGroup?.id, fetchActiveInvites]);

  useEffect(() => {
    if (isOpen) {
      void loadSharingState();
    }
  }, [isOpen, loadSharingState]);

  useEffect(() => {
    setAccessMode(generalInvite ? "anyone" : "restricted");
  }, [generalInvite]);

  const ensureGeneralInvite = async () => {
    if (generalInvite) return generalInvite;
    const invite = await generateInviteCode(null, null, approvalMode);
    await fetchActiveInvites();
    return invite;
  };

  const copyText = async (value: string, copiedValue: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedCode(copiedValue);
    toast.success(label);
    window.setTimeout(() => setCopiedCode(null), 1800);
  };

  const handleCopyLink = async () => {
    setLinkLoading(true);
    try {
      const invite = await ensureGeneralInvite();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      await copyText(
        `${origin}/projects?invite=${invite.id}`,
        invite.id,
        tr(language, "Đã sao chép liên kết.", "Link copied."),
      );
    } catch (error) {
      toast.error(tr(language, "Không thể tạo liên kết chia sẻ.", "Could not create share link."), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLinkLoading(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    await copyText(code, code, tr(language, "Đã sao chép mã mời.", "Invite code copied."));
  };

  const handleAccessModeChange = async (nextMode: AccessMode) => {
    setAccessMode(nextMode);
    setLinkLoading(true);
    try {
      if (nextMode === "anyone") {
        await ensureGeneralInvite();
      } else {
        const revokes = activeInvites
          .filter(invite => invite.max_uses === null)
          .map(invite => revokeInvite(invite.id));
        await Promise.all(revokes);
        await fetchActiveInvites();
      }
    } catch (error) {
      toast.error(tr(language, "Không thể cập nhật quyền truy cập.", "Could not update access."), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLinkLoading(false);
    }
  };

  const handleApprovalModeChange = async (value: ApprovalMode) => {
    setApprovalMode(value);
    if (accessMode !== "anyone") return;
    setLinkLoading(true);
    try {
      const matching = activeInvites.find(invite => invite.max_uses === null && invite.approval_mode === value && isInviteUsable(invite));
      if (!matching) {
        await generateInviteCode(null, null, value);
        await fetchActiveInvites();
      }
    } catch (error) {
      toast.error(tr(language, "Không thể cập nhật chế độ tham gia.", "Could not update join mode."), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLinkLoading(false);
    }
  };

  const handleSendPeopleInvites = async () => {
    if (!currentGroup) return;
    const emails = parseEmailList(peopleInput);
    const invalid = emails.find(email => !EMAIL_RE.test(email));
    if (emails.length === 0 || invalid) {
      toast.error(tr(language, "Vui lòng nhập email hợp lệ.", "Enter valid email addresses."));
      return;
    }

    setSendLoading(true);
    try {
      for (const email of emails) {
        const { invite } = await createGroupEmailInvite(currentGroup.id, email, message.trim() || null);
        await sendGroupEmailInviteEmail({
          recipientEmail: email,
          senderName: currentUserName || profile?.full_name || profile?.email || "Teamfair",
          groupName: currentGroup.name,
          inviteCode: invite.id,
          note: message.trim() || null,
        }).catch(() => ({ skipped: true }));
      }
      setPeopleInput("");
      setMessage("");
      await loadSharingState();
      toast.success(tr(language, "Đã gửi lời mời.", "Invites sent."));
    } catch (error) {
      toast.error(tr(language, "Không thể gửi lời mời.", "Could not send invites."), {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setSendLoading(false);
    }
  };

  const recentEmailInvites = inviteRows
    .filter(invite => invite.status === "pending" || invite.status === "sent")
    .slice(0, 3);

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeShareModal()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl sm:max-w-[560px] sm:rounded-lg">
        <div className="px-6 pb-5 pt-5">
          <DialogHeader className="space-y-1 pr-10">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className="truncate text-[22px] font-normal leading-7 text-slate-900">
                  {tr(language, "Chia sẻ", "Share")} "{currentGroup?.name ?? "Project"}"
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {tr(language, "Quản lý quyền chia sẻ dự án.", "Manage project sharing access.")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="mt-5 flex gap-2">
            <Input
              value={peopleInput}
              onChange={(event) => setPeopleInput(event.target.value)}
              placeholder={tr(language, "Thêm người bằng email", "Add people by email")}
              className="h-12 rounded border-slate-300 bg-white text-[15px] shadow-none focus-visible:ring-blue-600"
            />
            <Button
              type="button"
              disabled={sendLoading || !peopleInput.trim()}
              onClick={() => void handleSendPeopleInvites()}
              className="h-12 rounded bg-blue-600 px-6 text-sm font-medium text-white shadow-none hover:bg-blue-700"
            >
              {sendLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : tr(language, "Gửi", "Send")}
            </Button>
          </div>

          {peopleInput.trim() ? (
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={tr(language, "Tin nhắn", "Message")}
              className="mt-3 min-h-20 resize-none rounded border-slate-300 bg-white text-sm shadow-none focus-visible:ring-blue-600"
            />
          ) : null}

          <section className="mt-6">
            <h3 className="text-base font-medium text-slate-900">
              {tr(language, "Người có quyền truy cập", "People with access")}
            </h3>
            <div className="mt-3 space-y-3">
              {(members.length > 0 ? members : [{ id: profile?.id, name: currentUserName || "You", role: "Leader", completedTasks: 0, contributionPercent: 0, lecturerScore: null }]).map(member => {
                const isCurrentUser = member.id === profile?.id;
                const displayName = `${member.name}${isCurrentUser ? tr(language, " (bạn)", " (you)") : ""}`;
                return (
                  <div key={member.id ?? member.name} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500 text-sm font-medium text-white">
                      {initials(member.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{displayName}</p>
                      <p className="truncate text-xs text-slate-500">{member.id || profile?.email || "Teamfair user"}</p>
                    </div>
                    <span className="shrink-0 text-sm text-slate-500">
                      {member.role === "Leader"
                        ? tr(language, "Chủ sở hữu", "Owner")
                        : member.role === "Lecturer"
                          ? tr(language, "Giảng viên", "Lecturer")
                          : tr(language, "Thành viên", "Editor")}
                    </span>
                  </div>
                );
              })}
            </div>

            {recentEmailInvites.length > 0 ? (
              <div className="mt-4 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-600">
                  <Mail className="h-3.5 w-3.5" />
                  {tr(language, "Lời mời đang chờ", "Pending invites")}
                </div>
                <div className="space-y-1">
                  {recentEmailInvites.map(invite => (
                    <div key={invite.id} className="flex items-center justify-between gap-3 text-xs text-slate-600">
                      <span className="truncate">{invite.invited_email}</span>
                      <button
                        type="button"
                        onClick={() => void handleCopyCode(invite.invite_code)}
                        className="shrink-0 rounded px-2 py-1 font-mono text-blue-700 hover:bg-blue-50"
                      >
                        {invite.invite_code}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          <Separator className="my-5 bg-slate-200" />

          <section>
            <h3 className="text-base font-medium text-slate-900">
              {tr(language, "Quyền truy cập chung", "General access")}
            </h3>
            <div className="mt-3 flex items-start gap-3">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${accessMode === "anyone" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                {accessMode === "anyone" ? <Globe2 className="h-5 w-5" /> : <LockKeyhole className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
                  <Select value={accessMode} onValueChange={(value: AccessMode) => void handleAccessModeChange(value)}>
                    <SelectTrigger className="h-9 rounded border-0 bg-transparent px-0 text-left text-sm font-medium shadow-none focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="restricted">{tr(language, "Bị hạn chế", "Restricted")}</SelectItem>
                      <SelectItem value="anyone">{tr(language, "Bất kỳ ai có liên kết", "Anyone with the link")}</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={approvalMode} onValueChange={(value: ApprovalMode) => void handleApprovalModeChange(value)}>
                    <SelectTrigger className="h-9 rounded border-0 bg-transparent px-0 text-left text-sm text-slate-700 shadow-none focus:ring-0 sm:justify-end">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-lg">
                      <SelectItem value="requires_approval">{tr(language, "Cần phê duyệt", "Needs approval")}</SelectItem>
                      <SelectItem value="auto">{tr(language, "Có thể tham gia", "Can join")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-sm text-slate-500">
                  {accessMode === "anyone"
                    ? tr(language, "Bất kỳ ai có liên kết đều có thể yêu cầu tham gia dự án.", "Anyone with the link can request access to this project.")
                    : tr(language, "Chỉ những người được thêm hoặc thành viên hiện tại mới có thể truy cập.", "Only added people and current members can access.")}
                </p>
                {generalInvite ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <Link2 className="h-3.5 w-3.5" />
                    <span className="font-mono text-slate-700">{generalInvite.id}</span>
                    <button type="button" className="text-blue-700 hover:underline" onClick={() => void handleCopyCode(generalInvite.id)}>
                      {copiedCode === generalInvite.id ? tr(language, "Đã sao chép", "Copied") : tr(language, "Sao chép mã", "Copy code")}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={linkLoading || loadingInvites}
            onClick={() => void handleCopyLink()}
            className="h-9 rounded-full border-slate-300 px-4 text-sm font-medium text-blue-700 shadow-none hover:bg-blue-50 hover:text-blue-800"
          >
            {linkLoading || loadingInvites ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
            {generalInvite && copiedCode === generalInvite.id
              ? tr(language, "Đã sao chép", "Copied")
              : tr(language, "Sao chép liên kết", "Copy link")}
          </Button>
          <Button
            type="button"
            onClick={closeShareModal}
            className="h-9 rounded-full bg-blue-600 px-6 text-sm font-medium text-white shadow-none hover:bg-blue-700"
          >
            {tr(language, "Xong", "Done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
