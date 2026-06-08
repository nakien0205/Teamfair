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
import { t } from "@/lib/i18n";

type RiskLevel = "normal" | "attention" | "high";

type SummaryCard = {
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
      riskReason = "Chưa có task được giao trong giai đoạn hiện tại.";
    } else if (overdue >= 2 || contributionScore < 40 || (feedbackAverage !== null && feedbackAverage <= 2.5)) {
      riskLevel = "high";
      if (overdue >= 2) {
        riskReason = `Có ${overdue} task đang trễ hạn, cần cập nhật ngay.`;
      } else if (feedbackAverage !== null && feedbackAverage <= 2.5) {
        riskReason = "Bạn đang nhận phản hồi thấp từ giảng viên hoặc trưởng nhóm.";
      } else {
        riskReason = "Tỷ lệ task được duyệt còn thấp so với khối lượng được giao.";
      }
    } else if (overdue > 0 || contributionScore < 70 || (feedbackAverage !== null && feedbackAverage < 4)) {
      riskLevel = "attention";
      if (overdue > 0) {
        riskReason = `Có ${overdue} task sắp hoặc đã quá hạn cần xử lý.`;
      } else if (feedbackAverage !== null && feedbackAverage < 4) {
        riskReason = "Có phản hồi cần cải thiện trong đợt đánh giá gần đây.";
      } else {
        riskReason = "Tiến độ hoàn thành và minh chứng cần được bổ sung thêm.";
      }
    }

    const cards: SummaryCard[] = [
      {
        label: "Tổng task được giao",
        value: String(total),
        hint: total === 0 ? "Chưa có task" : "Task thuộc phạm vi của bạn",
        icon: FolderOpen,
      },
      {
        label: "Task đang làm",
        value: String(inProgress),
        hint: "Đang cập nhật tiến độ",
        icon: Clock3,
      },
      {
        label: "Task chờ duyệt",
        value: String(waitingReview),
        hint: "Đã nộp, chờ trưởng nhóm duyệt",
        icon: CalendarClock,
        tone: "warning",
      },
      {
        label: "Task đã được duyệt",
        value: String(approved),
        hint: "Đã được ghi nhận đóng góp",
        icon: BadgeCheck,
        tone: "success",
      },
      {
        label: "Task trễ hạn",
        value: String(overdue),
        hint: overdue > 0 ? "Cần xử lý ưu tiên" : "Không có task trễ hạn",
        icon: TimerOff,
        tone: overdue > 0 ? "destructive" : "default",
      },
      {
        label: "Contribution Score tham khảo",
        value: `${contributionScore}/100`,
        hint: "Chỉ dùng để tham khảo nội bộ",
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
  }, [feedbackEntries, myTasks]);

  const canWriteWorkLog = Boolean(group);

  const handleQuickAction = (section: string) => {
    navigate(`/student/workspace?section=${section}`);
  };

  const handleSubmitWorkLog = () => {
    const trimmed = workLogText.trim();
    if (trimmed.length < 10) {
      setWorkLogError("Vui lòng nhập nội dung work log tối thiểu 10 ký tự.");
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
                  <AlertTitle>Không thể tải dữ liệu dashboard</AlertTitle>
                  <AlertDescription className="mt-2 flex flex-col gap-4 text-amber-900/80">
                    <p>Đã có lỗi khi đồng bộ dữ liệu cá nhân của bạn. Vui lòng thử tải lại.</p>
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

          {!dataLoading && !connectionError && !group ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6">
                <EmptyBlock
                  title="Bạn chưa được phân vào nhóm nào."
                  description="Hãy vào mục dự án để tham gia nhóm hoặc chờ trưởng nhóm thêm bạn vào workspace."
                  icon={FolderOpen}
                />
                <div className="mt-4 flex justify-center">
                  <Button onClick={() => navigate("/projects")}>
                    Đi tới quản lý dự án
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!dataLoading && !connectionError && group ? (
            <>
              <Card className="overflow-hidden rounded-[28px] border-0 shadow-card">
                <CardContent className="p-0">
                  <div className="border-b border-border/70 bg-card/80 px-6 py-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="border border-primary/15 bg-primary/10 text-primary hover:bg-primary/10">
                            Sinh viên
                          </Badge>
                          <Badge variant="outline" className="border-border/80 bg-background/80 text-muted-foreground">
                            {group.name}
                          </Badge>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Chào mừng quay lại</p>
                          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{currentUserName}</h1>
                        </div>
                        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                          Theo dõi task được giao, deadline sắp tới, điểm đóng góp tham khảo và phản hồi gần đây trong một màn hình đơn giản, dễ theo dõi.
                        </p>
                      </div>

                      <div className="grid min-w-[280px] gap-3 rounded-[24px] border border-border/70 bg-background/80 p-4 sm:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Nhóm / dự án</p>
                          <p className="mt-1 text-sm font-medium">{group.name}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Task đang theo dõi</p>
                          <p className="mt-1 text-sm font-medium">{summary.total} task cá nhân</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Mức rủi ro hiện tại</p>
                          <p className="mt-1 text-sm font-medium">{riskMeta[summary.riskLevel].label}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Lưu ý</p>
                          <p className="mt-1 text-sm font-medium">Chỉ hiển thị dữ liệu của bạn</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {summary.cards.map(card => {
                  const Icon = card.icon;
                  return (
                    <Card key={card.label} className="rounded-3xl border-0 shadow-card">
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
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <Card className="rounded-3xl border-0 shadow-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Deadline sắp tới</CardTitle>
                    <CardDescription>Hiển thị 5 task gần hạn nhất trong phạm vi bạn được phép xem.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {upcomingDeadlines.length === 0 ? (
                      <EmptyBlock
                        title="Chưa có deadline nào cần theo dõi."
                        description="Khi có task được giao cho bạn, thời hạn gần nhất sẽ xuất hiện tại đây."
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
                                        Quá hạn
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                    <span>Hạn nộp: {formatDate(task.deadline)}</span>
                                    <span className="hidden h-1 w-1 rounded-full bg-muted-foreground/40 sm:inline-block" />
                                    <span>{task.description?.trim() ? task.description : "Chưa có mô tả chi tiết."}</span>
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
                      <CardTitle className="text-xl">Tiến độ task của tôi</CardTitle>
                      <CardDescription>Tiến độ tính theo số task đã được duyệt trên tổng task được giao.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {summary.total === 0 ? (
                        <EmptyBlock
                          title="Chưa có task để tính tiến độ."
                          description="Tiến độ sẽ hiển thị khi bạn được phân công task trong nhóm."
                          icon={Clock3}
                        />
                      ) : (
                        <>
                          <div className="flex items-end justify-between gap-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Task đã duyệt / tổng task</p>
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
                            Task đã duyệt phản ánh phần công việc đã được trưởng nhóm ghi nhận. Bạn không thể tự duyệt task của mình.
                          </p>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card ref={contributionRef} className="rounded-3xl border-0 shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl">Điểm đóng góp tham khảo</CardTitle>
                      <CardDescription>Chỉ hiển thị dữ liệu cá nhân của bạn, không hiển thị chi tiết riêng tư của thành viên khác.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Contribution Score</p>
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
                            <p className="font-medium">Nhận định hiện tại</p>
                            <p className="leading-6 text-muted-foreground">{summary.riskReason || "Dữ liệu đóng góp của bạn đang ở mức ổn định."}</p>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
                        <p>Điểm đóng góp chỉ mang tính tham khảo. Quyết định cuối cùng thuộc về giảng viên.</p>
                        <p className="mt-2">Cờ rủi ro chỉ là cảnh báo để giảng viên xem xét, không phải hình thức kỷ luật tự động.</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
                <Card className="rounded-3xl border-0 shadow-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Phản hồi gần đây</CardTitle>
                    <CardDescription>Phản hồi mới nhất từ giảng viên hoặc người phụ trách đánh giá dành riêng cho bạn.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {feedbackEntries.length === 0 ? (
                      <EmptyBlock
                        title="Chưa có phản hồi nào."
                        description="Khi có nhận xét mới từ trưởng nhóm hoặc giảng viên, bạn sẽ thấy tại đây."
                        icon={MessageSquareQuote}
                      />
                    ) : (
                      <div className="space-y-3">
                        {feedbackEntries.map((feedback: LecturerStudentReview) => (
                          <div key={feedback.id} className="rounded-2xl border border-border bg-background/80 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge className="border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100">
                                  Giảng viên
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
                    <CardTitle className="text-xl">Thao tác nhanh</CardTitle>
                    <CardDescription>Đi tới đúng khu vực bạn cần mà không phải mở nhiều tab.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button className="h-auto justify-start rounded-2xl px-4 py-4" onClick={() => navigate("/student/my-tasks")}>
                        <div className="mr-3 rounded-xl bg-primary-foreground/10 p-2">
                          <FolderOpen className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">Xem task của tôi</div>
                          <div className="text-xs text-primary-foreground/80">Theo dõi tiến độ và deadline</div>
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
                          <div className="font-medium">Nộp bằng chứng</div>
                          <div className="text-xs text-muted-foreground">Chỉ áp dụng cho task được giao cho bạn</div>
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
                          <div className="font-medium">Viết work log</div>
                          <div className="text-xs text-muted-foreground">Lưu nhanh một ghi chú công việc quan trọng</div>
                        </div>
                      </Button>

                      <Button variant="outline" className="h-auto justify-start rounded-2xl px-4 py-4" onClick={() => navigate("/student/peer-review")}>
                        <div className="mr-3 rounded-xl bg-muted p-2 text-foreground">
                          <MessageSquareQuote className="h-4 w-4" />
                        </div>
                        <div className="text-left">
                          <div className="font-medium">Đánh giá thành viên</div>
                          <div className="text-xs text-muted-foreground">Mỗi đợt đánh giá chỉ được gửi một lần</div>
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
                          <div className="font-medium">Xem điểm đóng góp</div>
                          <div className="text-xs text-muted-foreground">
                            Mở nhanh khu vực điểm tham khảo và cảnh báo rủi ro của riêng bạn
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
            <DialogTitle>Viết work log</DialogTitle>
            <DialogDescription>
              Ghi lại phần việc bạn vừa làm để hỗ trợ theo dõi đóng góp và tạo nhật ký hoạt động minh bạch.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="student-work-log">Nội dung work log</Label>
            <Textarea
              id="student-work-log"
              value={workLogText}
              onChange={event => {
                setWorkLogText(event.target.value);
                if (workLogError) setWorkLogError("");
              }}
              placeholder="Ví dụ: Hôm nay tôi hoàn thành phần wireframe màn hình dashboard và cập nhật minh chứng trong task UI-12."
              className="min-h-[160px]"
            />
            {workLogError ? <p className="text-sm text-destructive">{workLogError}</p> : null}
            <p className="text-xs text-muted-foreground">
              Work log này sẽ được ghi vào lịch sử hoạt động để phục vụ đối chiếu đóng góp khi cần.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkLogOpen(false)}>
              Hủy
            </Button>
            <Button onClick={handleSubmitWorkLog}>Lưu work log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentOverview;
