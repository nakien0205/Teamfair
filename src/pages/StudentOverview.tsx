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
    <div className="min-h-screen bg-[#F4F7FA]">
  <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
    {dataLoading ? <DashboardSkeleton /> : null}

    {!dataLoading && connectionError ? (
      <Card className="rounded-3xl border-0 bg-white shadow-xl shadow-slate-100/50">
        <CardContent className="p-6">
          <Alert className="rounded-2xl border-rose-200 bg-rose-50/80 text-rose-900 [&>svg]:text-rose-700 shadow-sm">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="font-bold">
              {tr(language, "Không thể tải dữ liệu dashboard", "Unable to load dashboard data")}
            </AlertTitle>
            <AlertDescription className="mt-2 flex flex-col gap-4 text-rose-900/80">
              <p>
                {tr(
                  language,
                  "Đã có lỗi khi đồng bộ dữ liệu cá nhân của bạn. Vui lòng thử tải lại.",
                  "There was an error while syncing your personal data. Please try reloading."
                )}
              </p>
              <div>
                <Button className="border-rose-300 bg-white hover:bg-rose-100 text-rose-800 transition-all rounded-xl" onClick={() => void loadPersistedState()} variant="outline">
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
      <Card className="rounded-3xl border-0 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.02)]">
        <CardContent className="p-8 text-center flex flex-col items-center">
          <EmptyBlock 
            title={tr(language, "Bạn chưa tham gia nhóm nào.", "You are not assigned to any group.")}
            description={tr(language, "Hãy chờ trưởng nhóm thêm bạn vào workspace hoặc phân chia dự án.", "Please wait for the team leader to add you to the workspace or assign projects.")}
            icon={FolderOpen}
          />
          <div className="mt-6">
            <Button onClick={() => navigate("/projects")} className="rounded-2xl bg-gradient-to-r from-[#2166F3] to-[#1A54CC] px-6 py-5 text-white shadow-md shadow-blue-100 hover:opacity-90 transition-all">
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

        {/* Khối Thông Tin Chi Tiết: Deadline & Tiến Độ */}
        <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          {/* Card Deadline Sắp Tới */}
          <Card className="rounded-3xl border-0 bg-white shadow-[0_4px_25px_rgba(0,0,0,0.015)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-slate-800">{tr(language, "Deadline sắp tới", "Upcoming Deadlines")}</CardTitle>
              <CardDescription>{tr(language, "Hiển thị 5 task gần hạn nhất trong phạm vi bạn được phép xem.", "Display the 5 nearest upcoming tasks.")}</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingDeadlines.length === 0 ? (
                <EmptyBlock 
                  title={tr(language, "Chưa có deadline gần hạn nào.", "No upcoming deadlines.")}
                  description={tr(language, "Khi có công việc được giao cho bạn, deadline gần nhất sẽ xuất hiện tại đây.", "When tasks are assigned, they will appear here.")}
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
                          "rounded-2xl border p-4 transition-all duration-200 hover:shadow-sm",
                          overdue 
                            ? "border-rose-200 bg-rose-50/80 text-rose-950 shadow-sm shadow-rose-50/40" 
                            : "border-sky-100 bg-sky-50/40 hover:bg-white hover:border-sky-200 text-slate-800"
                        )}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className={cn("text-sm font-bold md:text-base", overdue ? "text-rose-950" : "text-slate-800")}>{task.name}</p>
                              {overdue ? (
                                <Badge className="border-0 bg-rose-600 text-white font-bold rounded-md px-2 py-0.5 text-[10px] uppercase tracking-wider animate-pulse">
                                  {tr(language, "Trễ hạn", "Overdue")}
                                </Badge>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                              <span className={cn(overdue ? "text-rose-700 font-bold" : "font-medium text-slate-600")}>
                                {tr(language, "Hạn nộp:", "Deadline:")} {formatDate(task.deadline)}
                              </span>
                              <span className="hidden h-1 w-1 rounded-full bg-slate-300 sm:inline-block" />
                              <span className="italic text-slate-400 line-clamp-1">{task.description?.trim() ? task.description : tr(language, "Chưa có mô tả chi tiết.", "No description.")}</span>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
                            <Badge className={cn("border-0 font-semibold text-[11px] px-2 py-0.5 rounded-md shadow-xs", status.className)}>{status.label}</Badge>
                            <Badge className={cn("border-0 font-semibold text-[11px] px-2 py-0.5 rounded-md shadow-xs", priority.className)}>{priority.label}</Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cột Tiến Độ & Điểm Đóng Góp */}
          <div className="space-y-6">
            <Card className="rounded-3xl border-0 bg-white shadow-[0_4px_25px_rgba(0,0,0,0.015)]">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-bold text-slate-800">{tr(language, "Tiến độ task của tôi", "My Task Progress")}</CardTitle>
                <CardDescription>{tr(language, "Tiến độ tính theo số task đã được duyệt trên tổng task được giao.", "Progress is calculated based on approved tasks.")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {summary.total === 0 ? (
                  <EmptyBlock 
                    title={tr(language, "Chưa có tiến độ hiển thị.", "No progress available.")}
                    description={tr(language, "Tiến độ sẽ được tính khi bạn có công việc trong nhóm.", "Progress will be calculated when you are assigned tasks.")}
                    icon={Clock3}
                  />
                ) : (
                  <>
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tr(language, "Task đã duyệt / tổng task", "Approved / Total Tasks")}</p>
                        <p className="mt-1 text-3xl font-black text-slate-800">
                          {summary.approved}<span className="text-slate-300 mx-1">/</span>{summary.total}
                        </p>
                      </div>
                      <Badge className="border-0 bg-blue-600 text-white font-black px-2.5 py-1 rounded-xl shadow-md shadow-blue-100 text-sm">
                        {summary.completionPercent}%
                      </Badge>
                    </div>
                    <Progress className="h-3 bg-slate-100 text-[#2166F3] rounded-full overflow-hidden" value={summary.completionPercent}/>
                    <p className="text-xs leading-relaxed text-slate-400 italic">
                      {tr(language, "Task đã duyệt phản ánh phần công việc đã được trưởng nhóm ghi nhận.", "Approved tasks reflect the work recognized by the team leader.")}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-0 bg-white shadow-[0_4px_25px_rgba(0,0,0,0.015)]" ref={contributionRef}>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl font-bold text-slate-800">{tr(language, "Điểm đóng góp tham khảo", "Reference Contribution Score")}</CardTitle>
                <CardDescription>{tr(language, "Chỉ hiển thị dữ liệu cá nhân của bạn, không hiển thị thành viên khác.", "Only displays your personal data.")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{tr(language, "Điểm đóng góp", "Contribution Score")}</p>
                    <p className="mt-1 text-4xl font-black tracking-tight text-slate-800">{summary.contributionScore}</p>
                  </div>
                  <Badge className={cn("border-0 font-bold px-3 py-1 rounded-xl shadow-xs text-xs", riskMeta[summary.riskLevel].className)}>
                    {riskMeta[summary.riskLevel].label}
                  </Badge>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-600 shrink-0"/>
                    <div className="space-y-0.5 text-xs sm:text-sm">
                      <p className="font-bold text-slate-800">{tr(language, "Nhận định hiện tại", "Current Assessment")}</p>
                      <p className="leading-relaxed text-slate-600">{summary.riskReason || tr(language, "Dữ liệu đóng góp của bạn đang ở mức ổn định.", "Your contribution data is currently stable.")}</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4 text-xs leading-relaxed text-slate-400 space-y-1">
                  <p>• {tr(language, "Điểm đóng góp chỉ mang tính tham khảo. Quyết định cuối cùng thuộc về giảng viên.", "The score is for reference only.")}</p>
                  <p>• {tr(language, "Cờ rủi ro chỉ là cảnh báo để giảng viên xem xét, không phải kỷ luật tự động.", "The risk flag is only a warning.")}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Khối Giao Tiếp: Phản hồi & Phím chức năng nhanh */}
        <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="rounded-3xl border-0 bg-white shadow-[0_4px_25px_rgba(0,0,0,0.015)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-slate-800">{tr(language, "Phản hồi gần đây", "Recent Feedback")}</CardTitle>
              <CardDescription>{tr(language, "Phản hồi mới nhất từ giảng viên dành riêng cho bạn.", "The latest feedback from your instructor.")}</CardDescription>
            </CardHeader>
            <CardContent>
              {feedbackEntries.length === 0 ? (
                <EmptyBlock 
                  title={tr(language, "Chưa có phản hồi mới nào.", "No feedback available.")}
                  description={tr(language, "Khi nhận được nhận xét từ giảng viên, bạn sẽ thấy chúng tại đây.", "When comments are available, you will see them here.")}
                  icon={MessageSquareQuote}
                />
              ) : (
                <div className="space-y-3">
                  {feedbackEntries.map((feedback: LecturerStudentReview) => (
                    <div key={feedback.id} className="rounded-2xl border border-indigo-100/70 bg-indigo-50/30 p-4 hover:border-indigo-200 transition-colors">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge className="border-0 bg-indigo-100 text-indigo-700 font-bold">
                            {tr(language, "Giảng viên", "Instructor")}
                          </Badge>
                          <span className="text-xs font-medium text-slate-400">{formatDate(feedback.timestamp.toISOString())}</span>
                        </div>
                        <Badge className="border-0 bg-amber-500 text-white font-bold rounded-lg px-2 py-0.5 text-xs shadow-sm">
                          {feedback.rating}/5 ⭐
                        </Badge>
                      </div>
                      <p className="mt-3 text-sm leading-relaxed text-slate-700 font-medium">
                        {feedback.comment.trim() || tr(language, "Chưa có nhận xét chi tiết.", "No detailed description.")}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card className="rounded-3xl border-0 bg-white shadow-[0_4px_25px_rgba(0,0,0,0.015)]">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-bold text-slate-800">{tr(language, "Thao tác nhanh", "Quick Actions")}</CardTitle>
              <CardDescription>{tr(language, "Đi tới đúng khu vực bạn cần mà không phải mở nhiều tab.", "Navigate to the exact area you need.")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                
                {/* Action 1 */}
                <Button className="h-auto justify-start rounded-2xl px-4 py-4 bg-gradient-to-br from-[#2166F3] to-[#1A54CC] text-white shadow-md shadow-blue-100 hover:opacity-95 transition-all group" onClick={() => navigate("/student/my-tasks")}>
                  <div className="mr-3 rounded-xl bg-white/20 p-2.5 transition-transform group-hover:scale-110">
                    <FolderOpen className="h-4 w-4 text-white"/>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">{tr(language, "Xem task của tôi", "View My Tasks")}</div>
                    <div className="text-[11px] text-white/80 mt-0.5">{tr(language, "Theo dõi tiến độ và deadline", "Track progress and deadlines")}</div>
                  </div>
                </Button>

                {/* Action 2 */}
                <Button 
                  className="h-auto justify-start rounded-2xl px-4 py-4 border border-sky-100 bg-sky-50/60 text-sky-700 hover:bg-sky-100/80 transition-all group" 
                  onClick={() => navigate("/student/my-tasks")}
                  disabled={summary.total === 0}
                >
                  <div className="mr-3 rounded-xl bg-sky-200/50 p-2.5 text-sky-700 transition-transform group-hover:scale-110">
                    <FileUp className="h-4 w-4"/>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">{tr(language, "Nộp bằng chứng", "Submit Evidence")}</div>
                    <div className="text-[11px] text-sky-600/90 mt-0.5">{tr(language, "Chỉ áp dụng cho task được giao", "For assigned tasks")}</div>
                  </div>
                </Button>

                {/* Action 3 */}
                <Button 
                  className="h-auto justify-start rounded-2xl px-4 py-4 border border-amber-100 bg-amber-50/60 text-amber-800 hover:bg-amber-100/80 transition-all group" 
                  onClick={() => setWorkLogOpen(true)} 
                  disabled={!canWriteWorkLog}
                >
                  <div className="mr-3 rounded-xl bg-amber-200/50 p-2.5 text-amber-700 transition-transform group-hover:scale-110">
                    <ClipboardPenLine className="h-4 w-4"/>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">{tr(language, "Viết work log", "Write Work Log")}</div>
                    <div className="text-[11px] text-amber-700/90 mt-0.5">{tr(language, "Lưu nhanh ghi chú công việc", "Quickly save work notes")}</div>
                  </div>
                </Button>

                {/* Action 4 */}
                <Button className="h-auto justify-start rounded-2xl px-4 py-4 border border-emerald-100 bg-emerald-50/60 text-emerald-800 hover:bg-emerald-100/80 transition-all group" onClick={() => navigate("/student/peer-review")}>
                  <div className="mr-3 rounded-xl bg-emerald-200/50 p-2.5 text-emerald-700 transition-transform group-hover:scale-110">
                    <MessageSquareQuote className="h-4 w-4"/>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">{tr(language, "Đánh giá thành viên", "Peer Review")}</div>
                    <div className="text-[11px] text-emerald-700/90 mt-0.5">{tr(language, "Đánh giá nội bộ nhóm định kỳ", "Periodic internal reviews")}</div>
                  </div>
                </Button>

                {/* Action 5 */}
                <Button className="h-auto justify-start rounded-2xl px-4 py-4 sm:col-span-2 border border-purple-100 bg-purple-50/60 text-purple-800 hover:bg-purple-100/80 transition-all group" onClick={() => navigate("/student/my-contribution")}>
                  <div className="mr-3 rounded-xl bg-purple-200/50 p-2.5 text-purple-700 transition-transform group-hover:scale-110">
                    <Sparkles className="h-4 w-4"/>
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-sm">{tr(language, "Xem điểm đóng góp", "View My Contributions")}</div>
                    <div className="text-[11px] text-purple-700/90 mt-0.5">
                      {tr(language, "Mở nhanh khu vực điểm tham khảo và cảnh báo rủi ro cá nhân", "Access reference points and risk warnings")}
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

  {/* Hộp thoại Dialog viết Work log */}
  <Dialog 
    open={workLogOpen}
    onOpenChange={(open) => {
      setWorkLogOpen(open);
      if (!open) {
        setWorkLogError("");
      }
    }}
  >
    <DialogContent className="sm:max-w-xl rounded-3xl border-0 bg-white shadow-2xl p-6">
      <DialogHeader>
        <DialogTitle className="text-xl font-bold text-slate-800">{tr(language, "Viết work log", "Write Work Log")}</DialogTitle>
        <DialogDescription className="text-slate-500 text-xs sm:text-sm">
          {tr(language, "Ghi lại phần việc bạn vừa làm để hỗ trợ theo dõi đóng góp và tạo nhật ký hoạt động minh bạch.", "Record the work you've just completed.")}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 mt-2">
        <Label htmlFor="student-work-log" className="text-xs font-bold text-slate-700 uppercase tracking-wider">{tr(language, "Nội dung work log", "Work Log Content")}</Label>
        <Textarea 
          id="student-work-log" 
          value={workLogText}  
          onChange={(event) => {
            setWorkLogText(event.target.value);
            if (workLogError) setWorkLogError("");
          }}
          placeholder={tr(language, "Ví dụ: Hôm nay tôi hoàn thành phần wireframe màn hình dashboard và cập nhật minh chứng trong task UI-12.", "Example: Today I completed the dashboard screen wireframe...")}
          className="min-h-[140px] rounded-2xl border-slate-200 focus:border-blue-400 focus:ring-blue-400 text-sm p-4 transition-all"
        />
        {workLogError ? <p className="text-xs font-semibold text-rose-500">{workLogError}</p> : null}
        <p className="text-[11px] text-slate-400 italic">
          * {tr(language, "Work log này sẽ được ghi vào lịch sử hoạt động để phục vụ đối chiếu đóng góp khi cần.", "This work log will be recorded in the activity history.")}
        </p>
      </div>
      <DialogFooter className="mt-6 gap-2 sm:gap-0">
        <Button onClick={() => setWorkLogOpen(false)} variant="outline" className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50 px-5 text-xs sm:text-sm">
          {tr(language, "Hủy", "Cancel")}
        </Button>
        <Button className="rounded-xl bg-gradient-to-r from-[#2166F3] to-[#1A54CC] text-white hover:opacity-90 px-5 shadow-sm shadow-blue-100 text-xs sm:text-sm" onClick={handleSubmitWorkLog}>
          {tr(language, "Lưu work log", "Save Work Log")}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</div>
  );
};

export default StudentOverview;
