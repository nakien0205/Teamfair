import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Crown,
  Mail,
  MailPlus,
  ShieldAlert,
  TimerOff,
  Users,
  ClipboardList,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam, type Group } from "@/context/TeamContext";
import { listGroupEmailInvites, revokeGroupEmailInvite } from "@/lib/teamPersistence";
import type { GroupEmailInvite } from "@/lib/teamPersistence";
import { tr } from "@/lib/i18n";
import { fetchGradesForGroups, fetchRubricSummaries, type RubricGradeListRow, type RubricSummary } from "@/lib/rubricPersistence";
import { supabase } from "@/lib/supabaseClient";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type DetailTab = "overview" | "members" | "invites" | "scores";
type InviteStatusFilter = "all" | GroupEmailInvite["status"];
type GroupRubricStatus = "missing_rubric" | "ungraded" | "draft" | "submitted" | "locked";

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function getProgressTone(progressPercent: number) {
  if (progressPercent >= 80) return "bg-emerald-500";
  if (progressPercent >= 50) return "bg-indigo-500";
  if (progressPercent > 0) return "bg-amber-500";
  return "bg-slate-300";
}

function isLikelyUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function getScaledRubricScore(grade: RubricGradeListRow | null) {
  if (!grade || !grade.max_total_score) return null;
  return Math.round(((grade.total_score / grade.max_total_score) * 10) * 10) / 10;
}

function getOverdueTaskCount(group: Group) {
  const now = new Date();
  return group.tasks.filter(task => {
    if (!task.deadline) return false;
    const deadline = new Date(task.deadline);
    if (Number.isNaN(deadline.getTime())) return false;
    return deadline.getTime() < now.getTime() && task.status !== "Done" && !task.approved;
  }).length;
}

function getLatestActivity(group: Group) {
  if (!group.activityLog.length) return null;
  return [...group.activityLog].sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())[0] ?? null;
}

function inviteStatusLabel(status: GroupEmailInvite["status"]) {
  switch (status) {
    case "accepted":
      return "Đã chấp nhận";
    case "rejected":
      return "Đã từ chối";
    case "revoked":
      return "Đã thu hồi";
    case "pending":
      return "Chờ xử lý";
    default:
      return "Đã gửi";
  }
}

function taskStatusLabel(status: Group["tasks"][number]["status"]) {
  switch (status) {
    case "Done":
      return "Hoàn thành";
    case "In Progress":
      return "Đang làm";
    default:
      return "Todo";
  }
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="h-40 rounded-[32px] border border-border/70 bg-slate-100/70" />
      <div className="grid gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-28 rounded-[28px] border border-border/70 bg-slate-100/70" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="h-[420px] rounded-[32px] border border-border/70 bg-slate-100/70" />
        <div className="h-[420px] rounded-[32px] border border-border/70 bg-slate-100/70" />
      </div>
    </div>
  );
}

const LecturerGroupDetailPage = () => {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { profile, user, loading: authLoading } = useAuth();
  const {
    groups,
    currentGroupIndex,
    activeInvites,
    pendingJoinRequests,
    dataLoading,
  } = useTeam();

  const [activeTab, setActiveTab] = useState<DetailTab>("overview");
  const [memberSearch, setMemberSearch] = useState("");
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteStatusFilter, setInviteStatusFilter] = useState<InviteStatusFilter>("all");
  const [inviteRows, setInviteRows] = useState<GroupEmailInvite[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [resolvedNamesById, setResolvedNamesById] = useState<Record<string, string>>({});
  const [rubricSummaries, setRubricSummaries] = useState<RubricSummary[]>([]);
  const [rubricGrades, setRubricGrades] = useState<RubricGradeListRow[]>([]);
  const [gradingLoading, setGradingLoading] = useState(false);

  const selectedGroup = useMemo(() => {
    if (groupId) {
      const matched = groups.find(group => group.id === groupId);
      if (matched) return matched;
    }
    return groups[currentGroupIndex] ?? groups[0] ?? null;
  }, [currentGroupIndex, groupId, groups]);

  const resolveMemberName = useCallback((member: Group["members"][number]) => {
    const key = member.id ?? "";
    return (key && resolvedNamesById[key]) || member.name;
  }, [resolvedNamesById]);

  const selectedGroupLeaderName = useMemo(() => {
    if (!selectedGroup) return "Chưa cập nhật";
    const leader = selectedGroup.members.find(member => member.role === "Leader");
    return leader ? resolveMemberName(leader) : "Chưa cập nhật";
  }, [selectedGroup, resolveMemberName]);

  const selectedGroupOverdueTasks = useMemo(() => {
    if (!selectedGroup) return 0;
    return getOverdueTaskCount(selectedGroup);
  }, [selectedGroup]);

  const selectedGroupCompletedTasks = useMemo(() => {
    if (!selectedGroup) return 0;
    return selectedGroup.tasks.filter(task => task.status === "Done" || task.approved).length;
  }, [selectedGroup]);

  const selectedGroupProgress = useMemo(() => {
    if (!selectedGroup || selectedGroup.tasks.length === 0) return 0;
    return Math.round((selectedGroupCompletedTasks / selectedGroup.tasks.length) * 100);
  }, [selectedGroup, selectedGroupCompletedTasks]);

  const selectedGroupPendingJoinRequests = useMemo(() => {
    if (!selectedGroup) return 0;
    return pendingJoinRequests.filter(request => request.group_id === selectedGroup.id).length;
  }, [pendingJoinRequests, selectedGroup]);

  const selectedGroupActiveInvites = useMemo(() => {
    if (!selectedGroup) return 0;
    return activeInvites.filter(invite => invite.group_id === selectedGroup.id).length;
  }, [activeInvites, selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) {
      setResolvedNamesById({});
      return;
    }

    const memberIds = Array.from(
      new Set(
        selectedGroup.members
          .map(member => member.id)
          .filter((id): id is string => Boolean(id) && isLikelyUuid(id)),
      ),
    );

    if (memberIds.length === 0) {
      setResolvedNamesById({});
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id,full_name")
        .in("id", memberIds);

      if (cancelled) return;

      if (error) {
        console.warn("Failed to resolve member names:", error);
        return;
      }

      const nextMap: Record<string, string> = {};
      for (const row of data ?? []) {
        if (row?.id && typeof row.full_name === "string" && row.full_name.trim()) {
          nextMap[row.id] = row.full_name.trim();
        }
      }

      setResolvedNamesById(prev => ({ ...prev, ...nextMap }));
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedGroup]);

  useEffect(() => {
    if (!selectedGroup) {
      setRubricSummaries([]);
      setRubricGrades([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setGradingLoading(true);
        const [summaries, grades] = await Promise.all([
          fetchRubricSummaries(),
          fetchGradesForGroups([selectedGroup.id]),
        ]);

        if (cancelled) return;

        setRubricSummaries(summaries.filter((summary) => summary.rubric.project_id === selectedGroup.id));
        setRubricGrades(grades);
      } catch (error) {
        if (cancelled) return;
        console.warn("Failed to load group grading data:", error);
        setRubricSummaries([]);
        setRubricGrades([]);
      } finally {
        if (!cancelled) setGradingLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedGroup]);

  const filteredMembers = useMemo(() => {
    if (!selectedGroup) return [];
    const normalizedSearch = memberSearch.trim().toLowerCase();
    return [...selectedGroup.members].filter(member => {
      if (!normalizedSearch) return true;
      const scoreText = member.lecturerScore === null ? "" : String(member.lecturerScore);
      return [resolveMemberName(member), member.role, scoreText, `${member.contributionPercent}%`]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    }).sort((left, right) => {
      if (left.role === "Leader" && right.role !== "Leader") return -1;
      if (left.role !== "Leader" && right.role === "Leader") return 1;
      return right.contributionPercent - left.contributionPercent;
    });
  }, [memberSearch, resolveMemberName, selectedGroup]);

  const selectedGroupActiveRubrics = useMemo(
    () => rubricSummaries.filter((summary) => summary.rubric.status === "active"),
    [rubricSummaries],
  );
  const selectedGroupLatestGrade = useMemo(() => {
    return rubricGrades.reduce<RubricGradeListRow | null>((latest, grade) => {
      if (!latest) return grade;
      return new Date(grade.updated_at).getTime() > new Date(latest.updated_at).getTime() ? grade : latest;
    }, null);
  }, [rubricGrades]);
  const selectedGroupRubricScore = useMemo(
    () => getScaledRubricScore(selectedGroupLatestGrade),
    [selectedGroupLatestGrade],
  );
  const selectedGroupGradingStatus = useMemo<GroupRubricStatus>(() => {
    if (!selectedGroup) return "ungraded";
    if (selectedGroupActiveRubrics.length === 0) return "missing_rubric";
    if (selectedGroupLatestGrade?.status === "locked") return "locked";
    if (selectedGroupLatestGrade?.status === "submitted") return "submitted";
    if (selectedGroupLatestGrade?.status === "draft") return "draft";
    return "ungraded";
  }, [selectedGroup, selectedGroupActiveRubrics.length, selectedGroupLatestGrade]);

  const filteredInviteRows = useMemo(() => {
    const normalizedSearch = inviteSearch.trim().toLowerCase();
    return inviteRows.filter(invite => {
      const matchesSearch = !normalizedSearch
        || [invite.invited_email, invite.invite_code, invite.note ?? "", invite.status]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      const matchesStatus = inviteStatusFilter === "all" || invite.status === inviteStatusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [inviteRows, inviteSearch, inviteStatusFilter]);

  const openGroupGrading = useCallback(() => {
    if (!selectedGroup) return;
    if (selectedGroupActiveRubrics.length === 0) {
      navigate(`/lecturer/rubrics/upload?projectId=${selectedGroup.id}`);
      return;
    }

    navigate(`/lecturer/grading/projects/${selectedGroup.id}/groups/${selectedGroup.id}`);
  }, [navigate, selectedGroup, selectedGroupActiveRubrics.length]);

  const gradingMeta = useMemo(() => {
    if (selectedGroupGradingStatus === "submitted") {
      return {
        label: tr(language, "Đã gửi", "Submitted"),
        badge: "bg-emerald-50 text-emerald-700 hover:bg-emerald-50",
      };
    }
    if (selectedGroupGradingStatus === "locked") {
      return {
        label: tr(language, "Đã khóa", "Locked"),
        badge: "bg-slate-200 text-slate-700 hover:bg-slate-200",
      };
    }
    if (selectedGroupGradingStatus === "draft") {
      return {
        label: tr(language, "Bản nháp", "Draft"),
        badge: "bg-indigo-50 text-indigo-700 hover:bg-indigo-50",
      };
    }
    if (selectedGroupGradingStatus === "missing_rubric") {
      return {
        label: tr(language, "Chưa có rubric", "No rubric"),
        badge: "bg-amber-50 text-amber-700 hover:bg-amber-50",
      };
    }
    return {
      label: tr(language, "Chưa chấm", "Ungraded"),
      badge: "bg-amber-50 text-amber-700 hover:bg-amber-50",
    };
  }, [language, selectedGroupGradingStatus]);

  const sortedTasks = useMemo(() => {
    if (!selectedGroup) return [];
    return [...selectedGroup.tasks].sort((left, right) => {
      const leftDeadline = left.deadline ? new Date(left.deadline).getTime() : Number.POSITIVE_INFINITY;
      const rightDeadline = right.deadline ? new Date(right.deadline).getTime() : Number.POSITIVE_INFINITY;
      return leftDeadline - rightDeadline;
    });
  }, [selectedGroup]);

  useEffect(() => {
    if (!selectedGroup?.id) {
      setInviteRows([]);
      return;
    }

    let cancelled = false;
    setInviteLoading(true);
    void listGroupEmailInvites(selectedGroup.id)
      .then(rows => {
        if (!cancelled) setInviteRows(rows);
      })
      .catch(error => {
        if (!cancelled) {
          console.error("Failed to load group invites:", error);
          toast({
            title: tr(language, "Không tải được lời mời", "Could not load invites"),
            description: error instanceof Error ? error.message : String(error),
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setInviteLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [language, selectedGroup?.id, toast]);

  useEffect(() => {
    if (authLoading || dataLoading) return;
    if (profile?.role === "student") {
      navigate("/student/dashboard", { replace: true });
    }
  }, [authLoading, dataLoading, navigate, profile?.role]);

  if (authLoading || dataLoading) {
    return <LoadingState />;
  }

  if (!selectedGroup) {
    return (
      <Card className="rounded-[32px] border-border/70 shadow-card">
        <CardContent className="flex min-h-[360px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Users className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Không tìm thấy nhóm</h1>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Nhóm này có thể đã bị xoá hoặc bạn chưa chọn nhóm nào trong workspace hiện tại.
            </p>
          </div>
          <Button className="rounded-2xl" onClick={() => navigate("/lecturer/groups")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại danh sách nhóm
          </Button>
        </CardContent>
      </Card>
    );
  }

  const latestActivity = getLatestActivity(selectedGroup);
  const savedScores = selectedGroup.members.filter(member => member.lecturerScore !== null).length;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_40%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--muted)/0.35)_100%)]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-6 px-4 py-6 md:px-6">
        <div>
          <Button variant="outline" className="rounded-2xl" onClick={() => navigate("/lecturer/groups")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Quay lại danh sách nhóm
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="rounded-[28px] border-border/70 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Thành viên</div>
                <div className="text-2xl font-semibold">{selectedGroup.members.length}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[28px] border-border/70 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Task hoàn thành</div>
                <div className="text-2xl font-semibold">{selectedGroupCompletedTasks}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[28px] border-border/70 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <TimerOff className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Task trễ hạn</div>
                <div className="text-2xl font-semibold">{selectedGroupOverdueTasks}</div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-[28px] border-border/70 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-700">
                <ClipboardList className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Rubric hoạt động</div>
                <div className="text-2xl font-semibold">{selectedGroupActiveRubrics.length}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DetailTab)} className="space-y-6">
          <TabsList className="flex h-auto w-full gap-2 overflow-x-auto rounded-[22px] border border-white/60 bg-white/70 p-1 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)] backdrop-blur-2xl">
            <TabsTrigger value="overview" className="whitespace-nowrap rounded-[18px] px-4 py-3 transition-all duration-300 ease-out data-[state=active]:animate-liquid-pop data-[state=active]:border-white/70 data-[state=active]:bg-gradient-to-br data-[state=active]:from-white data-[state=active]:to-indigo-50 data-[state=active]:text-indigo-900 data-[state=active]:shadow-[0_10px_28px_-18px_rgba(79,70,229,0.45)] hover:-translate-y-0.5">
              Nhóm
            </TabsTrigger>
            <TabsTrigger value="members" className="whitespace-nowrap rounded-[18px] px-4 py-3 transition-all duration-300 ease-out data-[state=active]:animate-liquid-pop data-[state=active]:border-white/70 data-[state=active]:bg-gradient-to-br data-[state=active]:from-white data-[state=active]:to-indigo-50 data-[state=active]:text-indigo-900 data-[state=active]:shadow-[0_10px_28px_-18px_rgba(79,70,229,0.45)] hover:-translate-y-0.5">
              Thành viên
            </TabsTrigger>
            <TabsTrigger value="invites" className="whitespace-nowrap rounded-[18px] px-4 py-3 transition-all duration-300 ease-out data-[state=active]:animate-liquid-pop data-[state=active]:border-white/70 data-[state=active]:bg-gradient-to-br data-[state=active]:from-white data-[state=active]:to-indigo-50 data-[state=active]:text-indigo-900 data-[state=active]:shadow-[0_10px_28px_-18px_rgba(79,70,229,0.45)] hover:-translate-y-0.5">
              Lời mời
            </TabsTrigger>
            <TabsTrigger value="scores" className="whitespace-nowrap rounded-[18px] px-4 py-3 transition-all duration-300 ease-out data-[state=active]:animate-liquid-pop data-[state=active]:border-white/70 data-[state=active]:bg-gradient-to-br data-[state=active]:from-white data-[state=active]:to-indigo-50 data-[state=active]:text-indigo-900 data-[state=active]:shadow-[0_10px_28px_-18px_rgba(79,70,229,0.45)] hover:-translate-y-0.5">
              Điểm
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6 animate-liquid-rise">
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <Card className="rounded-[30px] border-border/70 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle>Tổng quan nhóm</CardTitle>
                  <CardDescription>
                    Những thông tin quan trọng nhất để bạn hiểu nhanh trạng thái hiện tại của nhóm.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Leader</div>
                    <div className="mt-2 text-lg font-semibold">{selectedGroupLeaderName}</div>
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tiến độ</div>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={selectedGroupProgress} className="h-2 flex-1" />
                      <span className="w-12 text-right text-sm font-semibold">{selectedGroupProgress}%</span>
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Lời mời email</div>
                    <div className="mt-2 text-lg font-semibold">{inviteRows.length}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {selectedGroupActiveInvites} project invite · {selectedGroupPendingJoinRequests} yêu cầu chờ duyệt.
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Join requests</div>
                    <div className="mt-2 text-lg font-semibold">{selectedGroupPendingJoinRequests}</div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Yêu cầu chờ duyệt từ workspace hiện tại.
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Chấm điểm</div>
                    <div className="mt-2 text-lg font-semibold">
                      {selectedGroupRubricScore !== null ? `${selectedGroupRubricScore.toFixed(1)} / 10` : gradingMeta.label}
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Cập nhật gần nhất</div>
                    <div className="mt-2 text-lg font-semibold">
                      {latestActivity ? dateTimeFormatter.format(latestActivity.timestamp) : "Chưa có log"}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {latestActivity ? latestActivity.description : "Nhóm chưa có hoạt động nào được ghi nhận."}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[30px] border-border/70 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
                <CardHeader className="pb-4">
                  <CardTitle>Trạng thái nhóm</CardTitle>
                  <CardDescription>
                    Một lát cắt nhanh về mức độ ổn định và nhu cầu theo dõi.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-[22px] border border-border/70 bg-background p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Tổng task</span>
                      <span className="text-sm text-muted-foreground">{selectedGroup.tasks.length}</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn("h-full rounded-full transition-all duration-300", getProgressTone(selectedGroupProgress))}
                        style={{ width: `${selectedGroupProgress}%` }}
                      />
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-border/70 bg-background p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Cảnh báo</span>
                      <Badge className={selectedGroupOverdueTasks > 0 ? "bg-rose-50 text-rose-700 hover:bg-rose-50" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-50"}>
                        {selectedGroupOverdueTasks > 0 ? "Có task trễ hạn" : "Ổn định"}
                      </Badge>
                    </div>
                    <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        {selectedGroupOverdueTasks > 0
                          ? `Có ${selectedGroupOverdueTasks} task quá hạn cần xử lý.`
                          : "Chưa thấy task nào quá hạn."}
                      </div>
                      <div className="flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4 text-indigo-500" />
                        {selectedGroup.members.some(member => member.role === "Leader")
                          ? "Đã có leader được gán."
                          : "Chưa có leader cụ thể cho nhóm này."}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock3 className="h-4 w-4 text-slate-500" />
                        {latestActivity ? `Log gần nhất: ${latestActivity.description}` : "Chưa có log hoạt động."}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[22px] border border-border/70 bg-background p-4">
                    <div className="text-sm font-medium">Thành viên nổi bật</div>
                    <div className="mt-3 space-y-3">
                      {[...selectedGroup.members]
                        .sort((left, right) => right.contributionPercent - left.contributionPercent)
                        .slice(0, 3)
                        .map(member => (
                          <div key={member.id ?? member.name} className="flex items-center justify-between rounded-[18px] border border-border/60 px-4 py-3">
                            <div>
                              <div className="font-medium">{resolveMemberName(member)}</div>
                              <div className="text-xs text-muted-foreground">{member.role}</div>
                            </div>
                            <div className="text-right text-xs text-muted-foreground">
                              <div>{member.contributionPercent}%</div>
                              <div>{member.lecturerScore !== null ? `Điểm: ${member.lecturerScore}` : "Chưa chấm"}</div>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="rounded-[30px] border-border/70 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle>Task gần nhất</CardTitle>
                <CardDescription>
                  Bảng nhìn nhanh để biết nhóm đang xử lý gì và task nào cần chú ý.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sortedTasks.length > 0 ? (
                  <div className="space-y-3">
                    {sortedTasks.slice(0, 6).map(task => (
                      <div key={task.id} className="rounded-[22px] border border-border/70 bg-background p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="font-medium">{task.name}</div>
                              <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                                {taskStatusLabel(task.status)}
                              </Badge>
                              {task.approved ? (
                                <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50">Đã duyệt</Badge>
                              ) : null}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Giao cho: {task.assignedTo || "Chưa có"} · Deadline: {task.deadline || "Chưa đặt"}
                            </div>
                          </div>
                          <div className="flex min-w-[220px] items-center gap-3">
                            <Progress value={task.contributionPercent} className="h-2 flex-1" />
                            <span className="w-12 text-right text-sm text-muted-foreground">
                              {task.contributionPercent}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    Nhóm này chưa có task nào.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="space-y-6 animate-liquid-rise">
            <Card className="rounded-[30px] border-border/70 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle>Danh sách thành viên</CardTitle>
                <CardDescription>
                  Xem nhanh vai trò, đóng góp và điểm giảng viên của từng người trong nhóm.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_260px]">
                  <div className="space-y-2">
                    <Label htmlFor="member-search">Tìm thành viên</Label>
                    <Input
                      id="member-search"
                      value={memberSearch}
                      onChange={(event) => setMemberSearch(event.target.value)}
                      placeholder="Tìm theo tên, vai trò, điểm hoặc % đóng góp..."
                      className="rounded-2xl"
                    />
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Tóm tắt</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="secondary">{selectedGroup.members.length} thành viên</Badge>
                      <Badge variant="secondary">{savedScores} điểm đã lưu</Badge>
                      <Badge variant="secondary">{selectedGroupOverdueTasks} task trễ hạn</Badge>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3">
                  {filteredMembers.map(member => {
                    const isLeader = member.role === "Leader";
                    return (
                      <div
                        key={member.id ?? member.name}
                        className={cn(
                          "rounded-[24px] border border-border/70 bg-background p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
                          isLeader && "border-primary/25 bg-primary/5",
                        )}
                      >
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-xs font-semibold text-white">
                                {getInitials(resolveMemberName(member))}
                              </div>
                              <div>
                                <div className="text-base font-semibold">{resolveMemberName(member)}</div>
                              </div>
                              {isLeader ? (
                                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                                  <Crown className="mr-1 h-3 w-3" />
                                  Nhóm trưởng
                                </Badge>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                              <span>Vai trò: {member.role}</span>
                              <span>Task đã xong: {member.completedTasks}</span>
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-[18px] border border-border/60 bg-muted/20 p-3">
                              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Đóng góp</div>
                              <div className="mt-2 flex items-center gap-2">
                                <Progress value={member.contributionPercent} className="h-2 w-28" />
                                <span className="w-10 text-right text-sm font-medium">{member.contributionPercent}%</span>
                              </div>
                            </div>
                            <div className="rounded-[18px] border border-border/60 bg-muted/20 p-3">
                              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Điểm GV</div>
                              <div className="mt-2 text-lg font-semibold">
                                {member.lecturerScore !== null ? member.lecturerScore.toFixed(1) : "—"}
                              </div>
                            </div>
                            <div className="rounded-[18px] border border-border/60 bg-muted/20 p-3">
                              <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Task</div>
                              <div className="mt-2 text-lg font-semibold">{member.completedTasks}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredMembers.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    Không tìm thấy thành viên nào khớp với từ khoá hiện tại.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invites" className="space-y-6 animate-liquid-rise">
            <Card className="rounded-[30px] border-border/70 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle>Lời mời email</CardTitle>
                <CardDescription>
                  Lịch sử lời mời đã tạo cho nhóm này, kèm mã tham gia và thao tác sao chép nhanh.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
                  <div className="space-y-2">
                    <Label htmlFor="invite-search">Tìm lời mời</Label>
                    <Input
                      id="invite-search"
                      value={inviteSearch}
                      onChange={(event) => setInviteSearch(event.target.value)}
                      placeholder="Tìm theo email, mã tham gia hoặc ghi chú..."
                      className="rounded-2xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invite-status">Trạng thái</Label>
                    <select
                      id="invite-status"
                      value={inviteStatusFilter}
                      onChange={(event) => setInviteStatusFilter(event.target.value as InviteStatusFilter)}
                      className="h-11 w-full rounded-2xl border border-input bg-background px-3 text-sm outline-none"
                    >
                      <option value="all">Tất cả</option>
                      <option value="pending">Chờ xử lý</option>
                      <option value="sent">Đã gửi</option>
                      <option value="accepted">Đã chấp nhận</option>
                      <option value="rejected">Đã từ chối</option>
                      <option value="revoked">Đã thu hồi</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{inviteRows.length} lời mời</Badge>
                    <Badge variant="secondary">{selectedGroupActiveInvites} project invite</Badge>
                    <Badge variant="secondary">{selectedGroupPendingJoinRequests} join request</Badge>
                    <Badge variant="secondary">{filteredInviteRows.length} đang hiển thị</Badge>
                  </div>
                </div>

                {inviteLoading ? (
                  <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    Đang tải lời mời...
                  </div>
                ) : filteredInviteRows.length > 0 ? (
                  <div className="space-y-3">
                    {filteredInviteRows.map(invite => (
                      <div key={invite.id} className="rounded-[24px] border border-border/70 bg-background p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{invite.invited_email}</Badge>
                              <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                                {inviteStatusLabel(invite.status)}
                              </Badge>
                              {invite.invited_user_id ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                                  Đã gắn tài khoản
                                </Badge>
                              ) : (
                                <Badge variant="outline">Chưa liên kết</Badge>
                              )}
                            </div>

                            <div className="space-y-2 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4" />
                                <span className="font-mono text-xs">{invite.invite_code}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock3 className="h-4 w-4" />
                                <span>{dateTimeFormatter.format(new Date(invite.created_at))}</span>
                              </div>
                              {invite.note ? <p>{invite.note}</p> : null}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-2xl"
                              onClick={() => void navigator.clipboard.writeText(invite.invite_code).then(() => {
                                toast({
                                  title: tr(language, "Đã sao chép mã", "Invite code copied"),
                                  description: invite.invite_code,
                                });
                              })}
                            >
                              <Copy className="mr-2 h-3.5 w-3.5" />
                              Sao chép mã
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="rounded-2xl"
                              onClick={() => void navigator.clipboard.writeText(
                                [
                                  `Mời tham gia nhóm: ${selectedGroup.name}`,
                                  `Mã tham gia: ${invite.invite_code}`,
                                  invite.note ? `Ghi chú: ${invite.note}` : null,
                                ].filter(Boolean).join("\n"),
                              )}
                            >
                              <MailPlus className="mr-2 h-3.5 w-3.5" />
                              Copy email
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="rounded-2xl text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              disabled={invite.status === "revoked" || invite.status === "accepted"}
                              onClick={() => {
                                void revokeGroupEmailInvite(invite.id)
                                  .then(() => listGroupEmailInvites(selectedGroup.id))
                                  .then(rows => setInviteRows(rows))
                                  .catch(error => {
                                    console.error("Failed to revoke invite:", error);
                                    toast({
                                      title: tr(language, "Không thể thu hồi", "Could not revoke invite"),
                                      description: error instanceof Error ? error.message : String(error),
                                      variant: "destructive",
                                    });
                                  });
                              }}
                            >
                              Thu hồi
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-[24px] border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    Không có lời mời nào khớp với bộ lọc hiện tại.
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="scores" className="space-y-6 animate-liquid-rise">
            <Card className="rounded-[30px] border-border/70 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle>Chấm điểm theo rubric</CardTitle>
                <CardDescription>
                  Luồng chấm chính thức của nhóm này đi qua rubric. Từ đây bạn chọn rubric, xem trạng thái và mở workspace chấm điểm.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Trạng thái</div>
                    <div className="mt-3">
                      <Badge className={gradingMeta.badge}>{gradingMeta.label}</Badge>
                    </div>
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Điểm nhóm</div>
                    <div className="mt-2 text-2xl font-semibold">{selectedGroupRubricScore !== null ? `${selectedGroupRubricScore.toFixed(1)} / 10` : "—"}</div>
                  </div>
                  <div className="rounded-[22px] border border-border/70 bg-muted/20 p-4">
                    <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Rubric hoạt động</div>
                    <div className="mt-2 text-2xl font-semibold">{selectedGroupActiveRubrics.length}</div>
                  </div>
                </div>

                {selectedGroupActiveRubrics.length === 0 ? (
                  <div className="rounded-[24px] border border-dashed border-amber-300 bg-amber-50/60 p-8">
                    <div className="space-y-3">
                      <h3 className="text-lg font-semibold text-slate-900">Nhóm này chưa có rubric hoạt động</h3>
                      <p className="max-w-2xl text-sm text-slate-600">
                        Hãy tạo hoặc upload rubric trước, sau đó mở workspace chấm điểm để đánh giá nhóm theo đúng tiêu chí.
                      </p>
                      <div className="flex flex-wrap gap-3">
                        <Button className="rounded-2xl" onClick={() => navigate(`/lecturer/rubrics/upload?projectId=${selectedGroup.id}`)}>
                          <ClipboardList className="mr-2 h-4 w-4" />
                          Tạo rubric
                        </Button>
                        <Button variant="outline" className="rounded-2xl" onClick={() => navigate(`/lecturer/rubrics?projectId=${selectedGroup.id}`)}>
                          Xem danh sách rubric
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[24px] border border-border/70 bg-background p-4">
                      <div className="space-y-1">
                        <div className="font-semibold text-slate-900">
                          {selectedGroupLatestGrade?.rubrics?.name || selectedGroupActiveRubrics[0]?.rubric.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {selectedGroupLatestGrade
                            ? "Có thể tiếp tục trên rubric đã dùng gần nhất hoặc đổi sang rubric khác."
                            : "Nhóm đã sẵn sàng để bắt đầu chấm điểm theo rubric."}
                        </div>
                      </div>
                      <Button className="rounded-2xl" onClick={openGroupGrading} disabled={gradingLoading}>
                        <ClipboardList className="mr-2 h-4 w-4" />
                        {selectedGroupGradingStatus === "draft"
                          ? "Tiếp tục chấm điểm"
                          : selectedGroupGradingStatus === "submitted" || selectedGroupGradingStatus === "locked"
                            ? "Xem bài chấm"
                            : "Bắt đầu chấm điểm"}
                      </Button>
                    </div>

                    <div className="overflow-hidden rounded-[24px] border border-border/70 bg-background">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[760px] text-sm">
                          <thead className="bg-muted/60 text-muted-foreground">
                            <tr>
                              <th className="px-4 py-3 text-left font-medium">Rubric</th>
                              <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                              <th className="px-4 py-3 text-left font-medium">Số tiêu chí</th>
                              <th className="px-4 py-3 text-left font-medium">Đã dùng</th>
                              <th className="px-4 py-3 text-right font-medium">Hành động</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rubricSummaries.map((summary) => (
                              <tr key={summary.rubric.id} className="border-t border-border/60">
                                <td className="px-4 py-3">
                                  <div className="font-medium text-slate-900">{summary.rubric.name}</div>
                                  <div className="text-xs text-muted-foreground">{summary.rubric.original_file_name || "Mẫu mặc định"}</div>
                                </td>
                                <td className="px-4 py-3">
                                  <Badge className={summary.rubric.status === "active" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "bg-slate-200 text-slate-700 hover:bg-slate-200"}>
                                    {summary.rubric.status === "active" ? "Đang dùng" : "Lưu trữ"}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-slate-700">{summary.rowCount}</td>
                                <td className="px-4 py-3 text-slate-700">{summary.usageCount}</td>
                                <td className="px-4 py-3 text-right">
                                  <Button
                                    size="sm"
                                    variant={summary.rubric.status === "active" ? "default" : "outline"}
                                    className="rounded-xl"
                                    onClick={() => navigate(`/lecturer/grading/projects/${selectedGroup.id}/groups/${selectedGroup.id}/rubrics/${summary.rubric.id}`)}
                                  >
                                    {summary.rubric.status === "active" ? "Dùng để chấm" : "Xem rubric"}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default LecturerGroupDetailPage;
