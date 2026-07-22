import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BookOpenText,
  CalendarClock,
  ClipboardPenLine,
  Clock3,
  FileUp,
  FolderOpen,
  MessageSquareQuote,
  RefreshCcw,
  ShieldAlert,
  Sparkles,
  TimerOff,
  Users,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DashboardSkeleton } from "@/components/skeletons";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam, type LecturerStudentReview, type Task } from "@/context/TeamContext";
import { cn } from "@/lib/utils";
import { tr, } from "@/lib/i18n";
import { PendingInvitesList } from "@/pages/PendingInvitesList";

type RiskLevel = "normal" | "attention" | "high";

type SummaryCard = {
  key: string;
  label: string;
  value: string;
  hint: string;
  icon: typeof FolderOpen;
  tone?: "default" | "warning" | "success" | "destructive";
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatDate = (value?: string) => {
  if (!value) return "Chưa đặt hạn";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Chưa đặt hạn";
  return dateFormatter.format(parsed);
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

const getStatusBadge = (task: Task) => {
  if (task.approved) {
    return {
      label: "Đã duyệt",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (task.status === "Done") {
    return {
      label: "Chờ duyệt",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (task.status === "In Progress") {
    return {
      label: "Đang làm",
      className: "border-sky-200 bg-sky-50 text-sky-700",
    };
  }
  return {
    label: "Chưa bắt đầu",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  };
};

const getPriorityBadge = (priority?: Task["priority"]) => {
  switch (priority) {
    case "High":
      return {
        label: "Mức độ cao",
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case "Medium":
      return {
        label: "Mức độ vừa",
        className: "border-orange-200 bg-orange-50 text-orange-700",
      };
    case "Low":
      return {
        label: "Mức độ thấp",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    default:
      return {
        label: "Chưa phân loại",
        className: "border-slate-200 bg-slate-100 text-slate-600",
      };
  }
};

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const riskMeta: Record<RiskLevel, { label: string; className: string }> = {
  normal: {
    label: "Bình thường",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  attention: {
    label: "Cần chú ý",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  high: {
    label: "Rủi ro cao",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
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

const StudentOverview = () => {
  const navigate = useNavigate();
  const contributionRef = useRef<HTMLDivElement | null>(null);
  const { language } = useLanguage();
  const { profile, loading: authLoading, signOut, user } = useAuth();
  const {
    groups,
    currentGroupIndex,
    tasks,
    dataLoading,
    connectionError,
    loadPersistedState,
    currentUserName,
    lecturerStudentReviews,
    addLog,
  } = useTeam();

  const [workLogOpen, setWorkLogOpen] = useState(false);
  const [workLogText, setWorkLogText] = useState("");
  const [workLogError, setWorkLogError] = useState("");
  const overdueCoachmarkKey = `teamfair_overdue_tasks_hint_seen_${user?.id ?? (currentUserName.trim().toLowerCase() || "anonymous")}`;
  const [showOverdueCoachmark, setShowOverdueCoachmark] = useState(false);

  useEffect(() => {
    if (authLoading || !profile) return;
    if (profile.role === "lecturer" || profile.role === "admin") {
      navigate("/dashboard-lecturer", { replace: true });
    }
  }, [authLoading, navigate, profile]);

  const group = groups[currentGroupIndex] || groups[0];

  const myTasks = useMemo(() => {
    const resolvedName = currentUserName?.trim().toLowerCase();
    return tasks.filter(task => {
      if (user?.id && task.assigneeId === user.id) return true;
      if (!resolvedName) return false;
      return task.assignedTo.trim().toLowerCase() === resolvedName;
    });
  }, [currentUserName, tasks, user?.id]);

  const sortedTasks = useMemo(
    () => [...myTasks].sort((left, right) => parseDeadline(left.deadline) - parseDeadline(right.deadline)),
    [myTasks],
  );

  const upcomingDeadlines = useMemo(
    () => sortedTasks.filter(task => !task.approved && task.deadline).slice(0, 5),
    [sortedTasks],
  );

  const feedbackEntries = useMemo(
    () =>
      [...lecturerStudentReviews]
        .filter(review => review.studentName.trim().toLowerCase() === currentUserName.trim().toLowerCase())
        .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime())
        .slice(0, 4),
    [currentUserName, lecturerStudentReviews],
  );

  const summary = useMemo(() => {
    const total = myTasks.length;
    const inProgress = myTasks.filter(task => task.status === "In Progress").length;
    const waitingReview = myTasks.filter(task => task.status === "Done" && !task.approved).length;
    const approved = myTasks.filter(task => task.approved).length;
    const overdue = myTasks.filter(isOverdueTask).length;
    const evidenceCoverage = total === 0 ? 0 : myTasks.filter(task => (task.evidence?.length ?? 0) > 0).length / total;
    const progressCoverage = total === 0 ? 0 : myTasks.filter(task => task.status !== "Todo").length / total;
    const approvedCoverage = total === 0 ? 0 : approved / total;
    const overdueCoverage = total === 0 ? 0 : overdue / total;
    const feedbackAverage =
      feedbackEntries.length === 0
        ? null
        : feedbackEntries.reduce((sum, item) => sum + item.rating, 0) / feedbackEntries.length;

    const contributionScore =
      total === 0
        ? 0
        : clampScore(approvedCoverage * 60 + progressCoverage * 20 + evidenceCoverage * 20 - overdueCoverage * 20);

    let riskLevel: RiskLevel = "normal";
    let riskReason = "";

    if (total === 0) {
      riskReason = tr(language, "Chưa có task được giao trong giai đoạn hiện tại.", "No tasks assigned in the current phase.");
    } else if (overdue >= 2 || contributionScore < 40 || (feedbackAverage !== null && feedbackAverage <= 2.5)) {
      riskLevel = "high";
      if (overdue >= 2) {
        riskReason = tr(language, `Có ${overdue} task đang trễ hạn, cần cập nhật ngay.`, `There are ${overdue} overdue tasks that need immediate attention.`);
      } else if (feedbackAverage !== null && feedbackAverage <= 2.5) {
        riskReason = tr(language, "Bạn đang nhận phản hồi thấp từ giảng viên hoặc trưởng nhóm.", "You are receiving low feedback from your instructor or team leader.");
      } else {
        riskReason = tr(language, "Tỷ lệ task được duyệt còn thấp so với khối lượng được giao.", "The rate of approved tasks is still low compared to the assigned workload.");
      }
    } else if (overdue > 0 || contributionScore < 70 || (feedbackAverage !== null && feedbackAverage < 4)) {
      riskLevel = "attention";
      if (overdue > 0) {
        riskReason = tr(language, `Có ${overdue} task sắp hoặc đã quá hạn cần xử lý.`, `There are ${overdue} tasks that are due or overdue and need to be addressed.`);
      } else if (feedbackAverage !== null && feedbackAverage < 4) {
        riskReason = tr(language, "Có phản hồi cần cải thiện trong đợt đánh giá gần đây.", "There is feedback that needs improvement in the recent evaluation period.");
      } else {
        riskReason = tr(language, "Tiến độ hoàn thành và minh chứng cần được bổ sung thêm.", "Completion progress and evidence need to be supplemented.");
      }
    }

    const cards: SummaryCard[] = [
      {
        key: "total",
        label: tr(language, "Tổng task được giao", "Total Assigned Tasks"),
        value: String(total),
        hint: total === 0 ? tr(language, "Chưa có task", "No tasks") : tr(language, "Task thuộc phạm vi của bạn", "Tasks within your scope"),
        icon: FolderOpen,
      },
      {
        key: "in-progress",
        label: tr(language, "Task đang làm", "Tasks In Progress"),
        value: String(inProgress),
        hint: tr(language, "Đang cập nhật tiến độ", "Updating progress"),
        icon: Clock3,
      },
      {
        key: "waiting-review",
        label: tr(language, "Task chờ duyệt", "Tasks Waiting for Review"),
        value: String(waitingReview),
        hint: tr(language, "Đã nộp, chờ trưởng nhóm duyệt", "Submitted, waiting for team leader approval"),
        icon: CalendarClock,
        tone: "warning",
      },
      {
        key: "approved",
        label: tr(language, "Task đã được duyệt", "Approved Tasks"),
        value: String(approved),
        hint: tr(language, "Đã được ghi nhận đóng góp", "Contribution recognized"),
        icon: BadgeCheck,
        tone: "success",
      },
      {
        key: "overdue",
        label: tr(language, "Task trễ hạn", "Overdue Tasks"),
        value: String(overdue),
        hint: overdue > 0 ? tr(language, "Cần xử lý ưu tiên", "Need priority handling") : tr(language, "Không có task trễ hạn", "No overdue tasks"),
        icon: TimerOff,
        tone: overdue > 0 ? "destructive" : "default",
      },
      {
        key: "contribution",
        label: tr(language, "Contribution Score tham khảo", "Reference Contribution Score"),
        value: `${contributionScore}/100`,
        hint: tr(language, "Chỉ dùng để tham khảo nội bộ", "For internal reference only"),
        icon: Sparkles,
        tone: riskLevel === "high" ? "destructive" : riskLevel === "attention" ? "warning" : "default",
      },
    ];

    return {
      total,
      inProgress,
      waitingReview,
      approved,
      overdue,
      contributionScore,
      riskLevel,
      riskReason,
      cards,
      completionPercent: total === 0 ? 0 : Math.round((approved / total) * 100),
    };
  }, [feedbackEntries, myTasks, language]);

  useEffect(() => {
    if (!user?.id && !currentUserName.trim()) return;
    if (summary.overdue === 0) return;

    try {
      setShowOverdueCoachmark(localStorage.getItem(overdueCoachmarkKey) !== "true");
    } catch {
      setShowOverdueCoachmark(true);
    }
  }, [currentUserName, overdueCoachmarkKey, summary.overdue, user?.id]);

  const dismissOverdueCoachmark = () => {
    setShowOverdueCoachmark(false);
    try {
      localStorage.setItem(overdueCoachmarkKey, "true");
    } catch {
      // Keep dismissed for current render if storage is unavailable.
    }
  };

  const openOverdueTasks = () => {
    dismissOverdueCoachmark();
    navigate("/student/my-tasks?status=overdue");
  };

  const canWriteWorkLog = Boolean(group);

  const handleQuickAction = (section: string) => {
    navigate(`/student/workspace?section=${section}`);
  };

  const handleSubmitWorkLog = () => {
    const trimmed = workLogText.trim();
    if (trimmed.length < 10) {
      setWorkLogError(tr(language, "Vui lòng nhập nội dung work log tối thiểu 10 ký tự.", "Please enter at least 10 characters for the work log content."));
      return;
    }
    addLog(`Work log: ${trimmed}`);
    setWorkLogText("");
    setWorkLogError("");
    setWorkLogOpen(false);
  };

  const summaryToneClass = (tone?: SummaryCard["tone"]) => {
    switch (tone) {
      case "success":
        return "bg-emerald-50 text-emerald-700";
      case "warning":
        return "bg-amber-50 text-amber-700";
      case "destructive":
        return "bg-rose-50 text-rose-700";
      default:
        return "bg-sky-50 text-sky-700";
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_42%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--card))_100%)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
          {dataLoading ? <DashboardSkeleton /> : null}

          {!dataLoading && connectionError ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6">
                <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{tr(language, "Không thể tải dữ liệu dashboard", "Unable to load dashboard data")}</AlertTitle>
                  <AlertDescription className="mt-2 flex flex-col gap-4 text-amber-900/80">
                    <p>{tr(language, "Đã có lỗi khi đồng bộ dữ liệu cá nhân của bạn. Vui lòng thử tải lại.", "There was an error while syncing your personal data. Please try reloading.")}</p>
                    <div>
                      <Button variant="outline" className="border-amber-300 bg-white" onClick={() => void loadPersistedState()}>
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        {tr(language, "Tải lại dữ liệu", "Reload Data")}
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : null}
          {!dataLoading && <PendingInvitesList />}

          {!dataLoading && !connectionError && !group ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6">
                <EmptyBlock
                  title={tr(language, "Bạn chưa được phân vào nhóm nào.", "You are not assigned to any group.")}
                  description={tr(language, "Hãy vào mục dự án để tham gia nhóm hoặc chờ trưởng nhóm thêm bạn vào workspace.", "Please go to the projects section to join a group or wait for your group leader to add you to the workspace.")}
                  icon={FolderOpen}
                />
                <div className="mt-4 flex justify-center">
                  <Button onClick={() => navigate("/projects")}>
                    {tr(language, "Đi tới quản lý dự án", "Go to Project Management")}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!dataLoading && !connectionError && group ? (
            <>
              <Card className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                <CardContent className="p-0">
                  <div className="bg-slate-50/80 px-6 py-6 border-b border-slate-200">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-4">
                        {/* Khu vực Badge */}
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border-0 bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-100 px-3 py-1 rounded-lg text-xs tracking-wide">
                            {tr(language, "Thành viên", "User")}
                          </Badge>
                          <Badge variant="outline" className="border-slate-200 bg-slate-50/70 text-slate-600 font-medium px-2.5 py-0.5 rounded-lg text-[11px]">
                            {group.name}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-xs font-black text-amber-600 uppercase tracking-widest">
                            {tr(language, "Chào mừng quay lại", "Welcome back")}
                          </p>
                          <h1 className="mt-1 text-4xl font-extrabold tracking-tight text-slate-800 md:text-5xl flex items-center gap-2.5">
                            {currentUserName}
                            <span className="animate-pulse inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" title="Active" />
                          </h1>
                        </div>
                        {/* <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                          "{tr(language, "Theo dõi task được giao, deadline sắp tới, điểm đóng góp tham khảo và phản hồi gần đây trong một màn hình đơn giản, dễ theo dõi.", "Track assigned tasks, upcoming deadlines, reference contribution points, and recent feedback in a simple, easy-to-follow screen.")}"
                        </p> */}
                      </div>

                      {/* <div className="grid min-w-[280px] gap-3 rounded-[24px] border border-border/70 bg-background/80 p-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{tr(language, "Nhóm / dự án", "Group / Project")}</p>
                          <p className="mt-1 text-sm font-medium">{group.name}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{tr(language, "Task đang theo dõi", "Tasks Being Tracked")}</p>
                          <p className="mt-1 text-sm font-medium">{tr(language,`${summary.total} task cá nhân`, `${summary.total} personal tasks`)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{tr(language, "Mức rủi ro hiện tại", "Current Risk Level")}</p>
                          <p className="mt-1 text-sm font-medium">{tr(language, `${riskMeta[summary.riskLevel].label}`, `${riskMeta[summary.riskLevel].label}`)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{tr(language, "Lưu ý", "Note")}</p>
                          <p className="mt-1 text-sm font-medium">{tr(language, "Chỉ hiển thị dữ liệu của bạn", "Only displaying your data")}</p>
                        </div>
                      </div> */}
                    </div>
                  </div>
                </CardContent>
              </Card>
                
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {summary.cards.map(card => {
                  const Icon = card.icon;
                  const isOverdueCard = card.key === "overdue";
                  const cardContent = (
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground">{card.label}</p>
                          <p className="text-3xl font-semibold tracking-tight">{card.value}</p>
                          <p className="text-sm text-muted-foreground">{card.hint}</p>
                        </div>
                        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl", summaryToneClass(card.tone))}>
                          <Icon className="h-5 w-5" />
                        </div>
                      </div>
                      {isOverdueCard ? (
                        <div className="mt-4 flex items-center justify-between gap-3 text-xs font-medium text-rose-700">
                          <span>{tr(language, "Xem task trễ hạn", "View overdue tasks")}</span>
                          <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        </div>
                      ) : null}
                    </CardContent>
                  );

                  return (
                    <div key={card.key} className="relative">
                      {isOverdueCard ? (
                        <Card
                          role="button"
                          tabIndex={0}
                          onClick={openOverdueTasks}
                          onKeyDown={event => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openOverdueTasks();
                            }
                          }}
                          aria-describedby={showOverdueCoachmark ? "overdue-task-coachmark" : undefined}
                          className={cn(
                            "group w-full rounded-3xl border border-rose-200/80 bg-white text-left shadow-card outline-none transition-all duration-200",
                            "hover:-translate-y-0.5 hover:shadow-card focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2",
                            "hover:border-rose-300 focus-visible:border-rose-400",
                            summary.overdue > 0 && showOverdueCoachmark && "motion-safe:animate-overdue-nudge",
                          )}
                        >
                          {cardContent}
                        </Card>
                      ) : (
                        <Card className="rounded-3xl border-0 shadow-card">
                          {cardContent}
                        </Card>
                      )}

                      {isOverdueCard && showOverdueCoachmark && summary.overdue > 0 ? (
                        <div
                          id="overdue-task-coachmark"
                          role="status"
                          className="absolute -top-3 right-4 z-10 max-w-[230px] rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-900 shadow-lg"
                        >
                          <span className="font-semibold">{tr(language, "Mẹo:", "Tip:")}</span>{" "}
                          {tr(language, "Bấm vào đây để xem và xử lý task trễ hạn.", "Click here to view and handle overdue tasks.")}
                          <span className="absolute -bottom-1.5 right-8 h-3 w-3 rotate-45 border-b border-r border-rose-200 bg-rose-50" aria-hidden="true" />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Card className="rounded-3xl border-0 shadow-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">{tr(language, "Deadline sắp tới", "Upcoming Deadlines")}</CardTitle>
                    <CardDescription>{tr(language, "Hiển thị 5 task gần hạn nhất trong phạm vi bạn được phép xem.", "Display the 5 nearest upcoming tasks within your viewing permissions.")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {upcomingDeadlines.length === 0 ? (
                      <EmptyBlock
                        title={tr(language, "Chưa có deadline nào cần theo dõi.", "No upcoming deadlines to track.")}
                        description={tr(language, "Khi có task được giao cho bạn, thời hạn gần nhất sẽ xuất hiện tại đây.", "When tasks are assigned to you, the nearest deadlines will appear here.")}
                        icon={CalendarClock}
                      />
                    ) : (
                      <div className="space-y-3">
                        {upcomingDeadlines.map(task => {
                          const status = getStatusBadge(task);
                          const priority = getPriorityBadge(task.priority);
                          const overdue = isOverdueTask(task);
                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "rounded-2xl border p-4 transition-colors",
                                overdue ? "border-rose-200 bg-rose-50/70" : "border-border bg-background/80",
                              )}
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="space-y-2">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold md:text-base">{task.name}</p>
                                    {overdue ? (
                                      <Badge className="border border-rose-200 bg-rose-100 text-rose-700 hover:bg-rose-100">
                                        {tr(language, "Quá hạn", "Overdue")}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                    <span>{tr(language, "Hạn nộp:", "Deadline:")} {formatDate(task.deadline)}</span>
                                    <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/40 sm:inline-block" />
                                    <span>{task.description?.trim() ? task.description : tr(language, "Chưa có mô tả chi tiết.", "No detailed description.")}</span>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge className={cn("border", status.className)}>{status.label}</Badge>
                                  <Badge className={cn("border", priority.className)}>{priority.label}</Badge>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card className="rounded-3xl border-0 shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl">{tr(language, "Tiến độ task của tôi", "My Task Progress")}</CardTitle>
                      <CardDescription>{tr(language, "Tiến độ tính theo số task đã được duyệt trên tổng task được giao.", "Progress is calculated based on the number of approved tasks out of the total assigned tasks.")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {summary.total === 0 ? (
                        <EmptyBlock
                          title={tr(language, "Chưa có task để tính tiến độ.", "No tasks available to calculate progress.")}
                          description={tr(language, "Tiến độ sẽ hiển thị khi bạn được phân công task trong nhóm.", "Progress will be displayed when you are assigned tasks in the group.")}
                          icon={Clock3}
                        />
                      ) : (
                        <>
                          <div className="flex items-end justify-between gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">{tr(language, "Task đã duyệt / tổng task", "Approved Tasks / Total Tasks")}</p>
                              <p className="mt-1 text-3xl font-semibold">
                                {summary.approved}/{summary.total}
                              </p>
                            </div>
                            <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                              {summary.completionPercent}%
                            </Badge>
                          </div>
                          <Progress value={summary.completionPercent} className="h-3 bg-muted" />
                          <p className="text-sm leading-6 text-muted-foreground">
                            {tr(language, "Task đã duyệt phản ánh phần công việc đã được trưởng nhóm ghi nhận. Bạn không thể tự duyệt task của mình.", "Approved tasks reflect the work recognized by the team leader. You cannot approve your own tasks.")}
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card ref={contributionRef} className="rounded-3xl border-0 shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl">{tr(language, "Điểm đóng góp tham khảo", "Reference Contribution Score")}</CardTitle>
                      <CardDescription>{tr(language, "Chỉ hiển thị dữ liệu cá nhân của bạn, không hiển thị chi tiết riêng tư của thành viên khác.", "Only displays your personal data, not the private details of other members.")}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">{tr(language, "Điểm đóng góp", "Contribution Score")}</p>
                          <p className="mt-1 text-4xl font-semibold tracking-tight">{summary.contributionScore}</p>
                        </div>
                        <Badge className={cn("border", riskMeta[summary.riskLevel].className)}>
                          {riskMeta[summary.riskLevel].label}
                        </Badge>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/80 p-4">
                        <div className="flex items-start gap-3">
                          <ShieldAlert className="mt-0.5 h-4 w-4 text-muted-foreground" />
                          <div className="space-y-2 text-sm">
                            <p className="font-medium">{tr(language, "Nhận định hiện tại", "Current Assessment")}</p>
                            <p className="leading-6 text-muted-foreground">{summary.riskReason || tr(language, "Dữ liệu đóng góp của bạn đang ở mức ổn định.", "Your contribution data is currently at a stable level.")}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
                        <p>{tr(language, "Điểm đóng góp chỉ mang tính tham khảo. Quyết định cuối cùng thuộc về giảng viên.", "The contribution score is for reference only. The final decision belongs to the instructor.")}</p>
                        <p className="mt-2">{tr(language, "Cờ rủi ro chỉ là cảnh báo để giảng viên xem xét, không phải hình thức kỷ luật tự động.", "The risk flag is only a warning for instructors to consider, not an automatic disciplinary measure.")}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <Card className="rounded-3xl border-0 shadow-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">{tr(language, "Phản hồi gần đây", "Recent Feedback")}</CardTitle>
                    <CardDescription>{tr(language, "Phản hồi mới nhất từ giảng viên hoặc người phụ trách đánh giá dành riêng cho bạn.", "The latest feedback from your instructor or course coordinator, tailored specifically for you.")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {feedbackEntries.length === 0 ? (
                      <EmptyBlock
                        title={tr(language, "Chưa có phản hồi nào.", "No feedback available.")}
                        description={tr(language, "Khi có nhận xét mới từ trưởng nhóm hoặc giảng viên, bạn sẽ thấy tại đây.", "When new comments are available from your team leader or instructor, you will see them here.")}
                        icon={MessageSquareQuote}
                      />
                    ) : (
                      <div className="space-y-3">
                        {feedbackEntries.map((feedback: LecturerStudentReview) => (
                          <div key={feedback.id} className="rounded-2xl border border-border bg-background/80 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge className="border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100">
                                  {tr(language, "Giảng viên", "Instructor")}
                                </Badge>
                                <span className="text-sm text-muted-foreground">{formatDate(feedback.timestamp.toISOString())}</span>
                              </div>
                              <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                                {feedback.rating}/5 sao
                              </Badge>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-foreground">
                              {feedback.comment.trim() || "Chưa có nhận xét chi tiết."}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-0 shadow-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">{tr(language, "Thao tác nhanh", "Quick Actions")}</CardTitle>
                    <CardDescription>{tr(language, "Đi tới đúng khu vực bạn cần mà không phải mở nhiều tab.", "Navigate to the exact area you need without opening multiple tabs.")}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button className="h-auto justify-start rounded-2xl px-4 py-4" onClick={() => navigate("/student/my-tasks")}>
                        <div className="mr-3 rounded-xl bg-primary-foreground/10 p-2">
                          <FolderOpen className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{tr(language, "Xem task của tôi", "View My Tasks")}</div>
                          <div className="text-xs text-primary-foreground/80">{tr(language, "Theo dõi tiến độ và deadline", "Track progress and deadlines")}</div>
                        </div>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-auto justify-start rounded-2xl px-4 py-4"
                        onClick={() => navigate("/student/my-tasks")}
                        disabled={summary.total === 0}
                      >
                        <div className="mr-3 rounded-xl bg-muted p-2 text-foreground">
                          <FileUp className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{tr(language, "Nộp bằng chứng", "Submit Evidence")}</div>
                          <div className="text-xs text-muted-foreground">{tr(language, "Chỉ áp dụng cho task được giao cho bạn", "Only applicable for tasks assigned to you")}</div>
                        </div>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-auto justify-start rounded-2xl px-4 py-4"
                        onClick={() => navigate("/student/work-logs")}
                        disabled={!canWriteWorkLog}
                      >
                        <div className="mr-3 rounded-xl bg-muted p-2 text-foreground">
                          <ClipboardPenLine className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{tr(language, "Viết work log", "Write Work Log")}</div>
                          <div className="text-xs text-muted-foreground">{tr(language, "Lưu nhanh một ghi chú công việc quan trọng", "Quickly save important work notes")}</div>
                        </div>
                      </Button>

                      <Button variant="outline" className="h-auto justify-start rounded-2xl px-4 py-4" onClick={() => navigate("/student/peer-review")}>
                        <div className="mr-3 rounded-xl bg-muted p-2 text-foreground">
                          <MessageSquareQuote className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{tr(language, "Đánh giá thành viên", "Peer Review")}</div>
                          <div className="text-xs text-muted-foreground">{tr(language, "Mỗi đợt đánh giá chỉ được gửi một lần", "Each review period can only be submitted once")}</div>
                        </div>
                      </Button>

                      <Button
                        variant="outline"
                        className="h-auto justify-start rounded-2xl px-4 py-4 sm:col-span-2"
                        onClick={() => navigate("/student/my-contribution")}
                      >
                        <div className="mr-3 rounded-xl bg-muted p-2 text-foreground">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{tr(language, "Xem điểm đóng góp", "View My Contributions")}</div>
                          <div className="text-xs text-muted-foreground">
                            {tr(language, "Mở nhanh khu vực điểm tham khảo và cảnh báo rủi ro của riêng bạn", "Quickly access your reference points and risk warnings")}
                          </div>
                        </div>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <Dialog open={workLogOpen} onOpenChange={open => {
        setWorkLogOpen(open);
        if (!open) {
          setWorkLogError("");
        }
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{tr(language, "Viết work log", "Write Work Log")}</DialogTitle>
            <DialogDescription>
              {tr(language, "Ghi lại phần việc bạn vừa làm để hỗ trợ theo dõi đóng góp và tạo nhật ký hoạt động minh bạch.", "Record the work you've just completed to support tracking contributions and creating transparent activity logs.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="student-work-log">{tr(language, "Nội dung work log", "Work Log Content")}</Label>
            <Textarea
              id="student-work-log"
              value={workLogText}
              onChange={event => {
                setWorkLogText(event.target.value);
                if (workLogError) setWorkLogError("");
              }}
              placeholder={tr(language, "Ví dụ: Hôm nay tôi hoàn thành phần wireframe màn hình dashboard và cập nhật minh chứng trong task UI-12.", "Example: Today I completed the dashboard screen wireframe and updated the evidence in task UI-12.")}
              className="min-h-[160px]"
            />
            {workLogError ? <p className="text-sm text-destructive">{workLogError}</p> : null}
            <p className="text-xs text-muted-foreground">
              {tr(language, "Work log này sẽ được ghi vào lịch sử hoạt động để phục vụ đối chiếu đóng góp khi cần.", "This work log will be recorded in the activity history to support contribution review when needed.")}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkLogOpen(false)}>
              {tr(language, "Hủy", "Cancel")}
            </Button>
            <Button onClick={handleSubmitWorkLog}>{tr(language, "Lưu work log", "Save Work Log")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentOverview;
