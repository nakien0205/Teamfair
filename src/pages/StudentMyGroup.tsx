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
}: {
  member: MemberStat;
  profile?: MemberProfile;
  tasks: Task[];
}) => {
  const assignedTasks = tasks.length;
  const approvedTasks = tasks.filter(task => task.approved).length;
  const pendingTasks = tasks.filter(task => task.status === "Done" && !task.approved).length;
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
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Đã duyệt</p>
            <p className="mt-1 text-xl font-semibold">{approvedTasks}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Chờ duyệt</p>
            <p className="mt-1 text-xl font-semibold">{pendingTasks}</p>
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
    if (!group?.lecturer_id) return "Chưa cập nhật";
    return profilesById[group.lecturer_id]?.full_name || "Chưa cập nhật";
  }, [group?.lecturer_id, profilesById]);

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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_42%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--card))_100%)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
          {connectionError || profileError ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6">
                <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Không thể tải đầy đủ dữ liệu nhóm</AlertTitle>
                  <AlertDescription className="mt-2 flex flex-col gap-4 text-amber-900/80">
                    <p>{profileError || "Đã có lỗi khi đồng bộ thông tin nhóm của bạn. Vui lòng thử tải lại."}</p>
                    <div>
                      <Button variant="outline" className="border-amber-300 bg-white" onClick={() => void loadPersistedState()}>
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
            <Card className="rounded-3xl border-0 shadow-card">
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>{t(language, "Lời mời nhóm", "Group invites")}</CardTitle>
                  <CardDescription>
                    {t(language, "Bạn có thể chấp nhận hoặc từ chối từng lời mời ngay tại đây.", "You can accept or reject each invite right here.")}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void loadEmailInvites()}>
                  <RefreshCcw className={`mr-2 h-4 w-4 ${invitesLoading ? "animate-spin" : ""}`} />
                  {t(language, "Làm mới", "Refresh")}
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingEmailInvites.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-sm text-muted-foreground">
                    {t(language, "Không còn lời mời đang chờ.", "No pending invites left.")}
                  </div>
                ) : (
                  pendingEmailInvites.map(invite => {
                    const inviteGroupName = groups.find(group => group.id === invite.group_id)?.name ?? t(language, "Nhóm chưa xác định", "Unknown group");
                    return (
                      <div key={invite.id} className="rounded-2xl border border-border/60 bg-background p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{inviteGroupName}</Badge>
                              <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">{inviteStatusLabel(invite.status)}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{invite.note || t(language, "Không có ghi chú.", "No note provided.")}</p>
                            <p className="text-xs text-muted-foreground">
                              {t(language, "Mã tham gia", "Join code")}: <span className="font-mono">{invite.invite_code}</span>
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              onClick={() => void handleRespondInvite(invite.id, "accepted")}
                              disabled={inviteActionLoading === invite.id}
                            >
                              <BadgeCheck className="mr-2 h-4 w-4" />
                              {t(language, "Chấp nhận", "Accept")}
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => void handleRespondInvite(invite.id, "rejected")}
                              disabled={inviteActionLoading === invite.id}
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
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6">
                <EmptyBlock
                  title="Bạn chưa được phân vào nhóm nào."
                  description="Khi được thêm vào dự án, thông tin nhóm và thành viên sẽ xuất hiện tại đây."
                  icon={Users}
                />
                <div className="mt-4 flex justify-center">
                  <Button onClick={() => navigate("/projects")}>Đi tới quản lý dự án</Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="overflow-hidden rounded-[28px] border-0 shadow-card">
                <CardContent className="p-0">
                  <div className="border-b border-border/70 bg-card/80 px-6 py-5">
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border border-primary/15 bg-primary/10 text-primary hover:bg-primary/10">
                          Sinh viên
                        </Badge>
                        <Badge className={cn("border", groupStatusMeta[groupProgress.status].className)}>
                          {groupStatusMeta[groupProgress.status].label}
                        </Badge>
                      </div>

                      <div>
                        <p className="text-sm text-muted-foreground">Nhóm của bạn</p>
                        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{group.name}</h1>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Học phần</p>
                          <p className="mt-2 text-sm font-medium">{courseName}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Dự án</p>
                          <p className="mt-2 text-sm font-medium">{group.name}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Giảng viên</p>
                          <p className="mt-2 text-sm font-medium">{profileLoading ? "Đang tải..." : lecturerName}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Nhóm trưởng</p>
                          <p className="mt-2 text-sm font-medium">{leader?.name || "Chưa cập nhật"}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Deadline dự án</p>
                          <p className="mt-2 text-sm font-medium">{formatDate(groupDeadline)}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tiến độ nhóm</p>
                          <p className="mt-2 text-sm font-medium">{groupProgress.progressPercent}% hoàn thành</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tổng thành viên</p>
                          <p className="mt-2 text-sm font-medium">{group.members.length} người</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Trạng thái nhóm</p>
                          <p className="mt-2 text-sm font-medium">{groupStatusMeta[groupProgress.status].label}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                <Card className="rounded-3xl border-0 shadow-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Thành viên nhóm</CardTitle>
                    <CardDescription>
                      Chỉ hiển thị số lượng task tổng quát của từng thành viên, không hiển thị breakdown điểm đóng góp riêng tư.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
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
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="rounded-3xl border-0 shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl">Tiến độ nhóm</CardTitle>
                      <CardDescription>Tiến độ chung dựa trên tổng task đã được duyệt trong nhóm.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tổng task nhóm</p>
                          <p className="mt-2 text-2xl font-semibold">{groupProgress.totalTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Đã hoàn thành</p>
                          <p className="mt-2 text-2xl font-semibold">{groupProgress.completedTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Đang chờ xử lý</p>
                          <p className="mt-2 text-2xl font-semibold">{groupProgress.pendingTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Task trễ hạn</p>
                          <p className="mt-2 text-2xl font-semibold">{groupProgress.overdueTasks}</p>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border/70 bg-card p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">Tỷ lệ hoàn thành nhóm</p>
                          <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                            {groupProgress.progressPercent}%
                          </Badge>
                        </div>
                        <Progress value={groupProgress.progressPercent} className="h-3 bg-muted" />
                      </div>

                      <Alert className="rounded-2xl border-border bg-background/80">
                        <ShieldAlert className="h-4 w-4" />
                        <AlertTitle>Giới hạn quyền xem</AlertTitle>
                        <AlertDescription className="leading-6">
                          Bạn chỉ có thể xem trạng thái tổng quát của thành viên. Điểm đóng góp chi tiết, khiếu nại hoặc giải trình riêng tư của người khác sẽ không hiển thị tại đây.
                        </AlertDescription>
                      </Alert>
                    </CardContent>
                  </Card>

                  <Card className="rounded-3xl border-0 shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl">Tóm tắt trạng thái</CardTitle>
                      <CardDescription>Ảnh chụp nhanh để bạn theo dõi sức khỏe chung của nhóm.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <div className="flex items-center gap-3">
                          <BadgeCheck className="h-5 w-5 text-emerald-600" />
                          <div>
                            <p className="text-sm font-medium">Task đã duyệt</p>
                            <p className="text-sm text-muted-foreground">{groupProgress.completedTasks} task đã được leader ghi nhận.</p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <div className="flex items-center gap-3">
                          <TimerOff className="h-5 w-5 text-rose-600" />
                          <div>
                            <p className="text-sm font-medium">Task trễ hạn</p>
                            <p className="text-sm text-muted-foreground">
                              {groupProgress.overdueTasks > 0
                                ? `Hiện có ${groupProgress.overdueTasks} task trễ hạn cần ưu tiên xử lý.`
                                : "Nhóm hiện không có task trễ hạn."}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <div className="flex items-center gap-3">
                          <CalendarClock className="h-5 w-5 text-sky-600" />
                          <div>
                            <p className="text-sm font-medium">Deadline dự án</p>
                            <p className="text-sm text-muted-foreground">
                              {groupDeadline ? `Mốc deadline gần nhất của nhóm là ${formatDate(groupDeadline)}.` : "Nhóm chưa có mốc deadline tổng được ghi nhận."}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <Card className="rounded-3xl border-0 shadow-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">Dòng thời gian hoạt động nhóm</CardTitle>
                  <CardDescription>
                    Ghi nhận các hoạt động gần đây như tạo task, nộp task, duyệt task, cập nhật deadline và phản hồi.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {timeline.length === 0 ? (
                    <EmptyBlock
                      title="Chưa có hoạt động nào."
                      description="Khi nhóm bắt đầu tạo task hoặc cập nhật tiến độ, lịch sử hoạt động sẽ xuất hiện tại đây."
                      icon={CalendarClock}
                    />
                  ) : (
                    <div className="space-y-3">
                      {timeline.map((entry, index) => {
                        const meta = activityKindMeta(entry.description);
                        return (
                          <div key={`${entry.timestamp.getTime()}-${index}`} className="rounded-2xl border border-border bg-background/80 p-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className={cn("border", meta.badgeClassName)}>{meta.label}</Badge>
                                  <span className="text-sm text-muted-foreground">{formatDateTime(entry.timestamp)}</span>
                                </div>
                                <p className="text-sm leading-6">{entry.description}</p>
                              </div>
                              <div className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
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
    </>
  );
};

export default StudentMyGroup;
