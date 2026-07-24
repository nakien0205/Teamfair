import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  Crown,
  FolderOpen,
  Mail,
  RefreshCcw,
  ShieldAlert,
  TimerOff,
  Users,
  UserMinus,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { GroupDetailSkeleton } from "@/components/skeletons";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam, type ActivityLogEntry, type MemberStat, type Task } from "@/context/TeamContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import {
  claimGroupEmailInvitesForCurrentUser,
  listMyGroupEmailInvites,
  respondToGroupEmailInvite,
  type GroupEmailInvite,
} from "@/lib/teamPersistence";

type ActivityLevel = "normal" | "attention" | "risk";

type MemberProfile = {
  email?: string;
  full_name?: string;
  role?: string;
};

type ActivityKind = {
  label: string;
  badgeClassName: string;
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const formatDate = (value?: string | Date | null) => {
  if (!value) return "Chưa cập nhật";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Chưa cập nhật";
  return dateFormatter.format(parsed);
};

const formatDateTime = (value: Date) => {
  if (Number.isNaN(value.getTime())) return "Không rõ thời gian";
  return dateTimeFormatter.format(value);
};

const parseDeadline = (value?: string) => {
  if (!value) return Number.POSITIVE_INFINITY;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
};

const isOverdueTask = (task: Task) => {
  if (!task.deadline) return false;
  const deadline = new Date(task.deadline);
  if (Number.isNaN(deadline.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return deadline.getTime() < today.getTime() && task.status !== "Done" && !task.approved;
};

const getMemberActivityLevel = (tasks: Task[]): ActivityLevel => {
  if (tasks.length === 0) return "attention";
  const overdueCount = tasks.filter(isOverdueTask).length;
  const pendingCount = tasks.filter(task => task.status === "Done" && !task.approved).length;
  const approvedCount = tasks.filter(task => task.approved).length;

  if (overdueCount >= 2 || (approvedCount === 0 && tasks.length >= 3)) {
    return "risk";
  }
  if (overdueCount > 0 || pendingCount >= 2 || approvedCount / tasks.length < 0.35) {
    return "attention";
  }
  return "normal";
};

const memberActivityMeta: Record<ActivityLevel, { label: string; className: string }> = {
  normal: {
    label: "Bình thường",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  attention: {
    label: "Cần chú ý",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  risk: {
    label: "Rủi ro",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const groupStatusMeta = {
  stable: {
    label: "Ổn định",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  attention: {
    label: "Cần chú ý",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  risk: {
    label: "Rủi ro tiến độ",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const activityKindMeta = (description: string): ActivityKind => {
  const normalized = description.toLowerCase();
  if (normalized.includes("được tạo") || normalized.includes("đã tạo") || normalized.includes("task \"")) {
    return {
      label: "Task tạo mới",
      badgeClassName: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }
  if (normalized.includes("hoàn thành task") || normalized.includes("bắt đầu task")) {
    return {
      label: "Task cập nhật",
      badgeClassName: "border-indigo-200 bg-indigo-50 text-indigo-700",
    };
  }
  if (normalized.includes("được duyệt")) {
    return {
      label: "Task được duyệt",
      badgeClassName: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (normalized.includes("deadline")) {
    return {
      label: "Deadline cập nhật",
      badgeClassName: "border-orange-200 bg-orange-50 text-orange-700",
    };
  }
  if (normalized.includes("feedback") || normalized.includes("đánh giá") || normalized.includes("work log")) {
    return {
      label: "Phản hồi / nhật ký",
      badgeClassName: "border-violet-200 bg-violet-50 text-violet-700",
    };
  }
  return {
    label: "Hoạt động nhóm",
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
  };
};

const EmptyBlock = ({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof FolderOpen;
}) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-background/70 px-6 py-10 text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
      <Icon className="h-5 w-5" />
    </div>
    <p className="text-base font-semibold">{title}</p>
    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
);

const LoadingPage = () => (
  <div className="space-y-6">
    <Card className="rounded-3xl border-0 shadow-card">
      <CardContent className="space-y-4 p-6">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      </CardContent>
    </Card>
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <Skeleton className="h-[420px] rounded-3xl" />
      <Skeleton className="h-[420px] rounded-3xl" />
    </div>
    <Skeleton className="h-[360px] rounded-3xl" />
  </div>
);

const MemberRow = ({
  member,
  profile,
  tasks,
  isCallerLeader,
  onKickClick,
}: {
  member: MemberStat;
  profile?: MemberProfile;
  tasks: Task[];
  isCallerLeader: boolean;
  onKickClick?: (member: MemberStat) => void;
}) => {
  const assignedTasks = tasks.length;
  const approvedTasks = tasks.filter(task => task.approved).length;
  const overdueTasks = tasks.filter(isOverdueTask).length;
  const activityLevel = getMemberActivityLevel(tasks);
  const roleLabel = member.role === "Leader" ? "Nhóm trưởng" : "Thành viên";
  const identifier = profile?.email?.trim() || member.id || "Chưa có thông tin";

  return (
    <div className={cn("rounded-3xl border bg-background/80 p-4 shadow-sm", member.role === "Leader" ? "border-primary/30" : "border-border")}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold">{profile?.full_name || member.name}</p>
            {member.role === "Leader" ? (
              <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                <Crown className="mr-1 h-3 w-3" />
                Nhóm trưởng
              </Badge>
            ) : null}
            {isCallerLeader && member.role !== "Leader" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onKickClick?.(member)}
                className="h-7 border-rose-500/30 hover:border-rose-500 bg-rose-500/5 hover:bg-rose-500/20 text-rose-400 text-xs rounded-xl px-2.5 transition-all font-semibold animate-in fade-in"
              >
                <UserMinus className="mr-1 h-3.5 w-3.5" />
                Xóa khỏi nhóm
              </Button>
            )}
            <Badge className={cn("border", memberActivityMeta[activityLevel].className)}>
              {memberActivityMeta[activityLevel].label}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              {identifier}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {roleLabel}
            </span>
          </div>
        </div>

        <div className="grid min-w-[260px] gap-3 rounded-2xl border border-border/70 bg-card p-3 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Task được giao</p>
            <p className="mt-1 text-xl font-semibold">{assignedTasks}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Đã hoàn thành</p>
            <p className="mt-1 text-xl font-semibold">{approvedTasks}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Trễ hạn</p>
            <p className="mt-1 text-xl font-semibold">{overdueTasks}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

const StudentMyGroup = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { profile, loading: authLoading, signOut } = useAuth();
  const {
    groups,
    currentGroupIndex,
    dataLoading,
    connectionError,
    loadPersistedState,
  } = useTeam();

  const [profilesById, setProfilesById] = useState<Record<string, MemberProfile>>({});
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [emailInvites, setEmailInvites] = useState<GroupEmailInvite[]>([]);
  const [invitesLoading, setInvitesLoading] = useState(false);
  const [inviteActionLoading, setInviteActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading || !profile) return;
    if (profile.role === "lecturer" || profile.role === "admin") {
      navigate("/dashboard-lecturer", { replace: true });
    }
  }, [authLoading, navigate, profile]);

  const group = groups[currentGroupIndex] || groups[0];

  const isCallerLeader = useMemo(() => {
    return !!(group && profile?.id && group.members.some(m => m.id === profile.id && m.role === 'Leader'));
  }, [group, profile?.id]);

  const otherMembers = useMemo(() => {
    if (!group || !profile?.id) return [];
    return group.members.filter(m => m.id && m.id !== profile.id);
  }, [group, profile?.id]);

  // Kick member states
  const [kickTarget, setKickTarget] = useState<MemberStat | null>(null);
  const [isKickDialogOpen, setIsKickDialogOpen] = useState(false);
  const [kickLoading, setKickLoading] = useState(false);

  // Resignation states
  const [resignStep, setResignStep] = useState<"none" | "verify" | "successor">("none");
  const [resignText, setResignText] = useState("");
  const [successorId, setSuccessorId] = useState("");
  const [resignLoading, setResignLoading] = useState(false);

  // Overdue tasks dialog
  const [overdueDialogOpen, setOverdueDialogOpen] = useState(false);

  const overdueTasks = useMemo(() => {
    if (!group) return [];
    return group.tasks.filter(isOverdueTask).map(task => {
      const assigneeName = task.assignedTo;
      const deadlineDate = new Date(task.deadline!);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysOverdue = Math.ceil((today.getTime() - deadlineDate.getTime()) / (1000 * 60 * 60 * 24));
      return { ...task, daysOverdue, assigneeName };
    });
  }, [group]);

  const handleKickMember = async () => {
    if (!group?.id || !kickTarget?.id) return;
    setKickLoading(true);
    try {
      const { error } = await supabase.rpc("kick_member", {
        p_group_id: group.id,
        p_target_user_id: kickTarget.id,
      });
      if (error) throw new Error(error.message);

      toast({
        title: "Đã xóa thành viên",
        description: `Thành viên ${kickTarget.name} đã bị xóa khỏi nhóm thành công.`,
      });
      setIsKickDialogOpen(false);
      setKickTarget(null);
      await loadPersistedState();
    } catch (error) {
      console.error("Error kicking member:", error);
      toast({
        title: "Lỗi xóa thành viên",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setKickLoading(false);
    }
  };

  const handleStartResign = () => {
    if (otherMembers.length === 0) {
      toast({
        title: "Không thể từ chức",
        description: "Nhóm không có thành viên khác để bàn giao quyền trưởng nhóm.",
        variant: "destructive",
      });
      return;
    }
    setResignStep("verify");
    setResignText("");
    setSuccessorId("");
  };

  const handleVerifyResign = () => {
    if (resignText !== "I resign my row") {
      toast({
        title: "Xác thực không chính xác",
        description: "Vui lòng nhập chính xác cụm từ yêu cầu.",
        variant: "destructive",
      });
      return;
    }
    setResignStep("successor");
    if (otherMembers[0]?.id) {
      setSuccessorId(otherMembers[0].id);
    }
  };

  const handleResignLeader = async () => {
    if (!group?.id || !successorId) {
      toast({
        title: "Thiếu thông tin",
        description: "Vui lòng chọn người kế nhiệm",
        variant: "destructive",
      });
      return;
    }
    setResignLoading(true);
    try {
      const { error } = await supabase.rpc("resign_as_leader", {
        p_group_id: group.id,
        p_new_leader_id: successorId,
      });
      if (error) throw new Error(error.message);

      toast({
        title: "Bàn giao quyền trưởng nhóm thành công!",
        description: "Quyền trưởng nhóm đã được chuyển giao cho thành viên mới.",
      });
      setResignStep("none");
      window.location.href = "/";
    } catch (err) {
      console.error("Error during resignation:", err);
      toast({
        title: "Lỗi từ chức",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setResignLoading(false);
    }
  };

  const loadEmailInvites = useCallback(async () => {
    setInvitesLoading(true);
    try {
      const claimedCount = await claimGroupEmailInvitesForCurrentUser().catch(() => 0);
      if (claimedCount) {
        await loadPersistedState();
      }
      const rows = await listMyGroupEmailInvites();
      setEmailInvites(rows);
    } catch (error) {
      console.error("Error loading email invites:", error);
    } finally {
      setInvitesLoading(false);
    }
  }, [loadPersistedState]);

  const pendingEmailInvites = useMemo(
    () => emailInvites.filter(invite => invite.status === "pending" || invite.status === "sent"),
    [emailInvites],
  );

  const handleRespondInvite = async (inviteId: string, response: "accepted" | "rejected") => {
    setInviteActionLoading(inviteId);
    try {
      await respondToGroupEmailInvite(inviteId, response);
      await loadPersistedState();
      await loadEmailInvites();
      toast({
        title: response === "accepted"
          ? t(language, "Đã chấp nhận lời mời", "Invite accepted")
          : t(language, "Đã từ chối lời mời", "Invite rejected"),
        description: response === "accepted"
          ? t(language, "Nhóm đã được cập nhật trong tài khoản của bạn.", "The group has been added to your account.")
          : t(language, "Lời mời đã được cập nhật.", "The invite has been updated."),
      });
    } catch (error) {
      console.error("Invite response failed:", error);
      toast({
        title: t(language, "Không thể xử lý lời mời", "Could not process invite"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setInviteActionLoading(null);
    }
  };

  useEffect(() => {
    if (authLoading || !profile || profile.role !== "student") return;
    void loadEmailInvites();
  }, [authLoading, loadEmailInvites, profile]);

  useEffect(() => {
    if (!group) return;
    if (!isSupabaseConfigured) {
      setProfilesById({});
      setProfileLoading(false);
      setProfileError("");
      return;
    }

    const targetIds = Array.from(
      new Set([
        ...group.members.map(member => member.id).filter(Boolean) as string[],
        ...(group.lecturers || []).map(member => member.id).filter(Boolean) as string[],
        group.lecturer_id,
      ].filter(Boolean)),
    );

    if (targetIds.length === 0) {
      setProfilesById({});
      setProfileLoading(false);
      setProfileError("");
      return;
    }

    let cancelled = false;
    setProfileLoading(true);
    setProfileError("");

    void supabase
      .from("users")
      .select("id,full_name,email,role")
      .in("id", targetIds)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setProfileError("Không thể tải đầy đủ thông tin thành viên nhóm.");
          setProfilesById({});
          return;
        }

        const mapped = (data || []).reduce<Record<string, MemberProfile>>((acc, item) => {
          acc[item.id] = {
            full_name: item.full_name,
            email: item.email,
            role: item.role,
          };
          return acc;
        }, {});

        setProfilesById(mapped);
      })
      .catch(() => {
        if (!cancelled) {
          setProfileError("Không thể tải đầy đủ thông tin thành viên nhóm.");
          setProfilesById({});
        }
      })
      .finally(() => {
        if (!cancelled) {
          setProfileLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [group]);

  const memberTasksById = useMemo(() => {
    if (!group) return {};
    return group.tasks.reduce<Record<string, Task[]>>((acc, task) => {
      const key = task.assigneeId || group.members.find(member => member.name === task.assignedTo)?.id || task.assignedTo;
      if (!key) return acc;
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});
  }, [group]);

  const leader = useMemo(() => {
    if (!group) return null;
    return group.members.find(member => member.role === "Leader") || group.members[0] || null;
  }, [group]);

  const lecturerName = useMemo(() => {
    if (group?.lecturers && group.lecturers.length > 0) {
      return group.lecturers.map(l => l.name).join(", ");
    }
    if (!group?.lecturer_id) return "Chưa cập nhật";
    return profilesById[group.lecturer_id]?.full_name || "Chưa cập nhật";
  }, [group?.lecturer_id, group?.lecturers, profilesById]);

  const groupDeadline = useMemo(() => {
    if (!group) return null;
    const tasksWithDeadline = group.tasks.filter(task => task.deadline);
    if (tasksWithDeadline.length === 0) return null;
    return tasksWithDeadline.sort((left, right) => parseDeadline(right.deadline) - parseDeadline(left.deadline))[0]?.deadline || null;
  }, [group]);

  const groupProgress = useMemo(() => {
    if (!group) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        pendingTasks: 0,
        overdueTasks: 0,
        progressPercent: 0,
        status: "stable" as const,
      };
    }

    const totalTasks = group.tasks.length;
    const completedTasks = group.tasks.filter(task => task.approved).length;
    const pendingTasks = group.tasks.filter(task => !task.approved).length;
    const overdueTasks = group.tasks.filter(isOverdueTask).length;
    const progressPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

    let status: "stable" | "attention" | "risk" = "stable";
    if (overdueTasks >= 2 || progressPercent < 25) {
      status = "risk";
    } else if (overdueTasks > 0 || progressPercent < 60) {
      status = "attention";
    }

    return {
      totalTasks,
      completedTasks,
      pendingTasks,
      overdueTasks,
      progressPercent,
      status,
    };
  }, [group]);

  const timeline = useMemo(() => {
    if (!group) return [] as ActivityLogEntry[];
    return [...group.activityLog]
      .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
      .slice(0, 8);
  }, [group]);

  const courseName = useMemo(() => {
    if (!group) return "Chưa cập nhật học phần";
    if (group.name.includes(" - ")) {
      return group.name.split(" - ")[0] || "Chưa cập nhật học phần";
    }
    return "Chưa cập nhật học phần";
  }, [group]);

  if (dataLoading) {
    return (
      <>
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_42%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--card))_100%)]">
          <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
            <GroupDetailSkeleton />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50/50 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.05),_transparent_50%)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
          {connectionError || profileError ? (
            <Card className="rounded-3xl border border-amber-200 shadow-xl shadow-amber-500/5 overflow-hidden">
              <CardContent className="p-6">
                <Alert className="rounded-2xl border-amber-300 bg-amber-50 text-amber-950 [&>svg]:text-amber-700 shadow-sm">
                  <AlertCircle className="h-5 w-5" />
                  <AlertTitle className="font-bold text-amber-900">Không thể tải đầy đủ dữ liệu nhóm</AlertTitle>
                  <AlertDescription className="mt-2 flex flex-col gap-4 text-amber-900/90">
                    <p>{profileError || "Đã có lỗi khi đồng bộ thông tin nhóm của bạn. Vui lòng thử tải lại."}</p>
                    <div>
                      <Button variant="outline" className="border-amber-300 bg-white hover:bg-amber-100 text-amber-955 shadow-sm rounded-xl font-semibold" onClick={() => void loadPersistedState()}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Tải lại dữ liệu
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : null}

          {emailInvites.length > 0 ? (
            <Card className="rounded-3xl border border-indigo-200 bg-white shadow-md">
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-indigo-100 pb-4">
                <div>
                  <CardTitle className="text-xl text-indigo-950 font-bold">{t(language, "Lời mời nhóm", "Group invites")}</CardTitle>
                  <CardDescription className="text-indigo-900/70 mt-0.5">
                    {t(language, "Bạn có thể chấp nhận hoặc từ chối từng lời mời ngay tại đây.", "You can accept or reject each invite right here.")}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-indigo-600 bg-indigo-50 hover:bg-indigo-100 hover:text-indigo-700 rounded-xl px-3 font-semibold" onClick={() => void loadEmailInvites()}>
                  <RefreshCcw className={`mr-2 h-4 w-4 ${invitesLoading ? "animate-spin" : ""}`} />
                  {t(language, "Làm mới", "Refresh")}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {pendingEmailInvites.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/30 p-6 text-sm text-indigo-900/70 text-center font-medium">
                    {t(language, "Không còn lời mời đang chờ.", "No pending invites left.")}
                  </div>
                ) : (
                  pendingEmailInvites.map(invite => {
                    const inviteGroupName = groups.find(group => group.id === invite.group_id)?.name ?? t(language, "Nhóm chưa xác định", "Unknown group");
                    return (
                      <div key={invite.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary" className="bg-slate-100 text-slate-800 border border-slate-200 rounded-lg font-semibold">{inviteGroupName}</Badge>
                              <Badge className="bg-indigo-100 text-indigo-800 border border-indigo-200 hover:bg-indigo-200 rounded-lg font-semibold">{inviteStatusLabel(invite.status)}</Badge>
                            </div>
                            <p className="text-sm text-slate-700 font-semibold">{invite.note || t(language, "Không có ghi chú.", "No note provided.")}</p>
                            <p className="text-xs text-slate-600 bg-slate-100 inline-block px-2.5 py-1 rounded-md border border-slate-200">
                              {t(language, "Mã tham gia", "Join code")}: <span className="font-mono font-bold text-indigo-700 ml-1">{invite.invite_code}</span>
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2 self-end lg:self-start">
                            <Button
                              onClick={() => void handleRespondInvite(invite.id, "accepted")}
                              disabled={inviteActionLoading === invite.id}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm font-semibold"
                            >
                              <BadgeCheck className="mr-2 h-4 w-4" />
                              {t(language, "Chấp nhận", "Accept")}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => void handleRespondInvite(invite.id, "rejected")}
                              disabled={inviteActionLoading === invite.id}
                              className="border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 rounded-xl font-semibold"
                            >
                              {t(language, "Từ chối", "Reject")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          ) : null}

          {!group ? (
            <Card className="rounded-3xl border border-dashed border-slate-300 bg-white shadow-sm">
              <CardContent className="p-10 flex flex-col items-center justify-center">
                <EmptyBlock
                  title="Bạn chưa được phân vào nhóm nào."
                  description="Khi được thêm vào dự án, thông tin nhóm và thành viên sẽ xuất hiện tại đây."
                  icon={Users}
                />
                <div className="mt-6 flex justify-center">
                  <Button onClick={() => navigate("/projects")} className="bg-primary hover:bg-primary/90 text-white font-bold rounded-xl px-6 shadow-md shadow-primary/10">Đi tới quản lý dự án</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* KHU VỰC ĐÃ FIX LỖI HIỂN THỊ VÀ TĂNG TƯƠNG PHẢN MÀU SẮC */}
              <Card className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-b from-slate-50/50 to-white px-6 py-6 border-b border-slate-150">
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-50 px-3 py-0.5 rounded-full font-bold">
                          Sinh viên
                        </Badge>
                        <Badge className={cn("border px-3 py-0.5 rounded-full font-bold shadow-sm text-slate-900", groupStatusMeta[groupProgress.status].className)}>
                          {groupStatusMeta[groupProgress.status].label}
                        </Badge>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Nhóm của bạn</p>
                        <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{group.name}</h1>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {/* Hộp Giảng Viên */}
                        <div className="rounded-2xl border border-violet-200 border-l-4 border-l-violet-600 bg-violet-50/50 p-5 pl-6 transition-all hover:bg-violet-50 shadow-sm">
                          <p className="text-xs font-bold uppercase tracking-[0.05em] text-violet-700">GIẢNG VIÊN</p>
                          <p className="mt-2 text-base font-extrabold text-slate-900">{profileLoading ? "Đang tải..." : lecturerName}</p>
                        </div>
                        {/* Hộp Deadline Dự Án */}
                        <div className="rounded-2xl border border-sky-200 border-l-4 border-l-sky-600 bg-sky-50/50 p-5 pl-6 transition-all hover:bg-sky-50 shadow-sm">
                          <p className="text-xs font-bold uppercase tracking-[0.05em] text-sky-700">DEADLINE DỰ ÁN</p>
                          <p className="mt-2 text-base font-extrabold text-slate-900">{formatDate(groupDeadline)}</p>
                        </div>
                        {/* Hộp Tiến Độ Nhóm */}
                        <div className="rounded-2xl border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50/50 p-5 pl-6 transition-all hover:bg-emerald-50 shadow-sm">
                          <p className="text-xs font-bold uppercase tracking-[0.05em] text-emerald-700">TIẾN ĐỘ NHÓM</p>
                          <p className="mt-2 text-base font-extrabold text-slate-900">{groupProgress.progressPercent}% hoàn thành</p>
                        </div>
                        {/* Hộp Tổng Thành Viên */}
                        <div className="rounded-2xl border border-amber-200 border-l-4 border-l-amber-600 bg-amber-50/50 p-5 pl-6 transition-all hover:bg-amber-50 shadow-sm">
                          <p className="text-xs font-bold uppercase tracking-[0.05em] text-amber-700">TỔNG THÀNH VIÊN</p>
                          <p className="mt-2 text-base font-extrabold text-slate-900">{group.members.length} người</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                <Card className="rounded-3xl border border-slate-200 bg-white shadow-md flex flex-col justify-between">
                  <div>
                    <CardHeader className="pb-4 border-b border-slate-100">
                      <CardTitle className="text-xl font-bold text-slate-900">Thành viên nhóm</CardTitle>
                      <CardDescription className="text-slate-600 font-medium">
                        Chỉ hiển thị số lượng task tổng quát của từng thành viên, không hiển thị breakdown điểm đóng góp riêng tư.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                      {group.members.length === 0 ? (
                        <EmptyBlock
                          title="Chưa có thành viên nào trong nhóm."
                          description="Khi nhóm được thêm thành viên, danh sách sẽ xuất hiện tại đây."
                          icon={Users}
                        />
                      ) : (
                        <div className="space-y-3">
                          {group.members.map(member => (
                            <MemberRow
                              key={member.id || member.name}
                              member={member}
                              profile={member.id ? profilesById[member.id] : undefined}
                              tasks={(member.id && memberTasksById[member.id]) || []}
                              isCallerLeader={isCallerLeader}
                              onKickClick={(m) => {
                                setKickTarget(m);
                                setIsKickDialogOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </div>
                </Card>

                <div className="space-y-6">
                  <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl font-bold text-slate-900">Tiến độ nhóm</CardTitle>
                      <CardDescription className="text-slate-600 font-medium">Tiến độ chung dựa trên tổng task đã được duyệt trong nhóm.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-sm hover:bg-blue-100/70 transition-colors">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-blue-700">Tổng task nhóm</p>
                          <p className="mt-1 text-2xl font-black text-blue-950">{groupProgress.totalTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm hover:bg-emerald-100/70 transition-colors">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Đã hoàn thành</p>
                          <p className="mt-1 text-2xl font-black text-emerald-950">{groupProgress.completedTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm hover:bg-amber-100/70 transition-colors">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Đang chờ xử lý</p>
                          <p className="mt-1 text-2xl font-black text-amber-955">{groupProgress.pendingTasks}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setOverdueDialogOpen(true)}
                          className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-left hover:border-rose-400 hover:bg-rose-100 shadow-sm transition-all cursor-pointer w-full group"
                        >
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-700">Task trễ hạn</p>
                          <p className="mt-1 text-2xl font-black text-rose-950 group-hover:scale-[1.02] origin-left transition-transform">{groupProgress.overdueTasks}</p>
                        </button>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-bold text-slate-800">Tỷ lệ hoàn thành nhóm</p>
                          <Badge className="border border-indigo-300 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 rounded-lg px-2.5 font-black shadow-sm">
                            {groupProgress.progressPercent}%
                          </Badge>
                        </div>
                        <Progress value={groupProgress.progressPercent} className="h-3 bg-slate-200 rounded-full overflow-hidden [&>div]:bg-indigo-600" />
                      </div>

                      <Alert className="rounded-2xl border border-slate-300 bg-slate-100 text-slate-800 shadow-sm">
                        <ShieldAlert className="h-4 w-4 text-slate-600" />
                        <AlertTitle className="font-bold text-slate-900">Giới hạn quyền xem</AlertTitle>
                        <AlertDescription className="leading-6 text-slate-700 text-xs mt-0.5 font-medium">
                          Bạn chỉ có thể xem trạng thái tổng quát của thành viên. Điểm đóng góp chi tiết, khiếu nại hoặc giải trình riêng tư của người khác sẽ không hiển thị tại đây.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>

                  {isCallerLeader && (
                    <Card className="rounded-3xl bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 border border-slate-800 text-slate-100 shadow-[0_10px_30px_-10px_rgba(99,102,241,0.25)]">
                      <CardHeader className="pb-3 border-b border-slate-880/80">
                        <CardTitle className="text-lg font-bold text-indigo-400 flex items-center gap-2">
                          <Crown className="h-5 w-5 text-amber-400 fill-amber-400/20" />
                          Quản trị Trưởng nhóm
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
                        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/[0.05] p-4 flex flex-col gap-3">
                          <div>
                            <p className="text-sm font-bold text-rose-400">Từ chức Trưởng nhóm</p>
                            <p className="text-xs text-slate-300 mt-1 leading-relaxed font-medium">
                              Từ chức và nhượng lại quyền quản trị dự án hiện tại cho thành viên khác trong nhóm. Bạn sẽ trở thành thành viên thường.
                            </p>
                          </div>
                          <Button
                            type="button"
                            onClick={handleStartResign}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl px-4 py-2.5 h-auto transition-all cursor-pointer self-start shadow-md border border-rose-500"
                          >
                            Từ chức ngay
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl font-bold text-slate-900">Tóm tắt trạng thái</CardTitle>
                      <CardDescription className="text-slate-600 font-medium">Ảnh chụp nhanh để bạn theo dõi sức khỏe chung của nhóm.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100/70">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-emerald-100 border border-emerald-200 shadow-sm">
                            <BadgeCheck className="h-5 w-5 text-emerald-700" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">Task đã duyệt</p>
                            <p className="text-xs text-slate-600 font-semibold mt-0.5">{groupProgress.completedTasks} task đã được leader ghi nhận và chốt tiến độ.</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100/70">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-rose-100 border border-rose-200 shadow-sm">
                            <TimerOff className="h-5 w-5 text-rose-700" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">Task trễ hạn</p>
                            <p className="text-xs text-slate-600 font-semibold mt-0.5">
                              {groupProgress.overdueTasks > 0
                                ? `Hiện có ${groupProgress.overdueTasks} task quá hạn cần ưu tiên xử lý gấp.`
                                : "Tuyệt vời! Nhóm hiện không có task nào bị trễ hạn."}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100/70">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-sky-100 border border-sky-200 shadow-sm">
                            <CalendarClock className="h-5 w-5 text-sky-700" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">Deadline dự án</p>
                            <p className="text-xs text-slate-600 font-semibold mt-0.5">
                              {groupDeadline ? `Mốc deadline gần nhất của nhóm là ${formatDate(groupDeadline)}.` : "Nhóm chưa có mốc deadline tổng được ghi nhận."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                <CardHeader className="pb-4 border-b border-slate-100">
                  <CardTitle className="text-xl font-bold text-slate-900">Dòng thời gian hoạt động nhóm</CardTitle>
                  <CardDescription className="text-slate-600 font-medium">
                    Ghi nhận các hoạt động gần đây như tạo task, nộp task, duyệt task, cập nhật deadline và phản hồi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-5">
                  {timeline.length === 0 ? (
                    <EmptyBlock
                      title="Chưa có hoạt động nào."
                      description="Khi nhóm bắt đầu tạo task hoặc cập nhật tiến độ, lịch sử hoạt động sẽ xuất hiện tại đây."
                      icon={CalendarClock}
                    />
                  ) : (
                    <div className="space-y-3 relative before:absolute before:inset-y-0 before:left-4 before:w-0.5 before:bg-slate-200 pl-2">
                      {timeline.map((entry, index) => {
                        const meta = activityKindMeta(entry.description);
                        return (
                          <div key={`${entry.timestamp.getTime()}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-all relative">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className={cn("border rounded-lg px-2.5 font-bold shadow-sm text-xs text-slate-900", meta.badgeClassName)}>{meta.label}</Badge>
                                  <span className="text-xs font-bold text-slate-500">{formatDateTime(entry.timestamp)}</span>
                                </div>
                                <p className="text-sm leading-6 font-semibold text-slate-800">{entry.description}</p>
                              </div>
                              <div className="rounded-xl bg-slate-100 border border-slate-200 px-3 py-1 text-[11px] font-black text-slate-500 tracking-wider uppercase self-start md:self-auto shadow-sm">
                                Audit log
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Kick Member Dialog */}
      <Dialog open={isKickDialogOpen} onOpenChange={setIsKickDialogOpen}>
        <DialogContent className="sm:max-w-[420px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl z-[9999]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold tracking-tight text-rose-400 flex items-center gap-2">
              <UserMinus className="h-5 w-5 text-rose-400" />
              Xóa thành viên khỏi nhóm
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm mt-1 font-medium">
              Hành động này không thể hoàn tác. Thành viên sẽ bị xóa khỏi dự án ngay lập tức.
            </DialogDescription>
          </DialogHeader>

          {kickTarget && (
            <div className="py-4 space-y-3">
              <p className="text-sm text-slate-300 font-medium">
                Bạn có chắc chắn muốn xóa thành viên <strong className="text-white font-bold">{kickTarget.name}</strong> khỏi nhóm không?
              </p>
              <div className="p-3.5 bg-slate-950 border border-slate-850 rounded-2xl text-xs space-y-2 leading-relaxed shadow-inner">
                <p className="font-bold text-rose-400 uppercase tracking-wider">Lưu ý cực kỳ quan trọng:</p>
                <ul className="list-disc pl-4 space-y-1 text-slate-300 font-medium">
                  <li>Tất cả task đang được giao cho thành viên này trong nhóm sẽ được chuyển sang trạng thái <span className="text-amber-400 font-bold">chưa giao (unassigned)</span>.</li>
                  <li>Thành viên này sẽ mất hoàn toàn quyền truy cập vào không gian làm việc của nhóm.</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-800/80 pt-4 mt-2">
            <Button
              variant="ghost"
              onClick={() => setIsKickDialogOpen(false)}
              className="bg-transparent hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl px-4 font-semibold"
            >
              Hủy
            </Button>
            <Button
              disabled={kickLoading}
              onClick={handleKickMember}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold shadow-lg shadow-rose-600/20 transition-all border border-rose-500 px-5"
            >
              {kickLoading ? "Đang xử lý..." : "Xác nhận xóa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resign Leadership Dialog */}
      <Dialog open={resignStep !== "none"} onOpenChange={(open) => { if (!open) setResignStep("none"); }}>
        <DialogContent className="sm:max-w-[460px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl z-[9999]">
          {resignStep === "verify" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold tracking-tight text-rose-400 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-400" />
                  Xác nhận Từ chức Trưởng nhóm
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-sm mt-1 font-medium">
                  Hành động này yêu cầu xác nhận bằng văn bản để tránh các thao tác nhầm lẫn.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <p className="text-sm leading-relaxed text-slate-300 font-medium">
                  Bằng việc từ chức, bạn sẽ nhượng lại toàn bộ quyền kiểm soát dự án cho một thành viên khác. Hành động này không thể đảo ngược.
                </p>
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Nhập cụm từ bên dưới để xác nhận:
                  </Label>
                  <div className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-center font-mono text-sm font-bold text-rose-400 select-none tracking-widest shadow-inner">
                    I resign my row
                  </div>
                  <Input
                    required
                    value={resignText}
                    onChange={(e) => setResignText(e.target.value)}
                    placeholder="Nhập cụm từ xác nhận tại đây..."
                    className="bg-slate-950 border-slate-800 text-slate-100 placeholder:text-slate-700 rounded-xl focus-visible:ring-indigo-500 focus-visible:border-indigo-500 py-5 shadow-inner font-semibold"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-800/80 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setResignStep("none")}
                  className="hover:bg-slate-800 text-slate-300 rounded-xl px-4 font-semibold"
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleVerifyResign}
                  disabled={resignText !== "I resign my row"}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold disabled:opacity-30 disabled:pointer-events-none shadow-lg shadow-indigo-600/20 transition-all px-5"
                >
                  Tiếp tục
                </Button>
              </DialogFooter>
            </>
          )}

          {resignStep === "successor" && (
            <>
              <DialogHeader>
                <DialogTitle className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                  <Crown className="h-5 w-5 text-indigo-400 fill-indigo-400/10" />
                  Chọn Người Kế Nhiệm
                </DialogTitle>
                <DialogDescription className="text-slate-400 text-sm mt-1 font-medium">
                  Chỉ định thành viên sẽ tiếp quản vai trò Trưởng nhóm điều hành dự án.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Thành viên tiếp quản:
                  </Label>
                  <select
                    value={successorId}
                    onChange={(e) => setSuccessorId(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl py-3 px-4 text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer hover:bg-slate-900 transition-all outline-none shadow-inner"
                  >
                    {otherMembers.map((m) => (
                      <option key={m.id} value={m.id} className="bg-slate-950 text-slate-200 py-2">
                        {m.name} ({profilesById[m.id!]?.email || m.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <DialogFooter className="gap-2 sm:gap-0 border-t border-slate-800/80 pt-4">
                <Button
                  variant="ghost"
                  onClick={() => setResignStep("verify")}
                  className="hover:bg-slate-800 text-slate-300 rounded-xl px-4 font-semibold"
                >
                  Quay lại
                </Button>
                <Button
                  onClick={handleResignLeader}
                  disabled={resignLoading || !successorId}
                  className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold shadow-lg shadow-rose-600/20 transition-all px-5 border border-rose-500"
                >
                  {resignLoading ? "Đang xử lý..." : "Xác nhận & Bàn giao"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Overdue Tasks Dialog */}
      <Dialog open={overdueDialogOpen} onOpenChange={setOverdueDialogOpen}>
        <DialogContent className="sm:max-w-[560px] rounded-3xl border border-slate-200 bg-white shadow-2xl p-6">
          <DialogHeader className="border-b border-slate-100 pb-3">
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
              <TimerOff className="h-5 w-5 text-rose-500" />
              Danh sách Task trễ hạn
            </DialogTitle>
            <DialogDescription className="text-slate-600 font-medium">
              Các đầu việc đã quá mốc thời gian quy định nhưng chưa được hoàn thành.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pt-3 pr-1">
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10 font-bold">Tuyệt vời! Không có task nào bị trễ hạn.</p>
            ) : (
              overdueTasks.map(task => (
                <div key={task.id} className="rounded-2xl border border-rose-200 bg-rose-50 hover:bg-rose-100/70 p-4 space-y-2.5 shadow-sm transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-extrabold text-sm text-slate-900 break-words leading-relaxed">{task.name}</p>
                    <Badge className="border border-rose-300 bg-rose-100 text-rose-800 hover:bg-rose-100 font-black shrink-0 rounded-lg shadow-sm">
                      {task.daysOverdue} ngày quá hạn
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-500">
                    <span className="inline-flex items-center gap-1.5 text-slate-700 bg-slate-150 border border-slate-200 px-2 py-0.5 rounded-md">
                      <Users className="h-3.5 w-3.5 text-slate-500" />
                      {task.assigneeName}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-md">
                      <CalendarClock className="h-3.5 w-3.5 text-rose-500" />
                      Hạn: {formatDate(task.deadline)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentMyGroup;
