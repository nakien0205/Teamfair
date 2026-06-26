import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowUpDown,
  BadgeCheck,
  BookOpenText,
  CheckCircle2,
  ClipboardPenLine,
  Clock3,
  Eye,
  FilePenLine,
  FileText,
  FileUp,
  Filter,
  FolderOpen,
  MessageSquareQuote,
  RefreshCcw,
  Search,
  Sparkles,
  TimerOff,
  Users,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { TaskListSkeleton } from "@/components/skeletons";
import { useTeam, type Task } from "@/context/TeamContext";
import {tr} from "@/lib/i18n";
import {
  STUDENT_TASK_PROGRESS_MESSAGES,
  canStudentEditSubmission,
  canStudentOpenSubmission,
  canStudentStartTask,
  isTaskAssignedToStudent,
} from "@/lib/studentTaskProgress";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";

type TaskWorkflowStatus =
  | "todo"
  | "in_progress"
  | "submitted"
  | "need_revision"
  | "approved"
  | "rejected"
  | "overdue";

type SortOption = "deadline" | "latest" | "weight" | "status";

type ReviewStatus = "pending" | "need_revision" | "approved" | "rejected";

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

const todayStart = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime();
};

const isTaskOverdue = (task: Task) => {
  if (!task.deadline) return false;
  const deadline = new Date(task.deadline).getTime();
  if (!Number.isFinite(deadline)) return false;
  return deadline < todayStart() && !task.approved;
};

const getWorkflowStatus = (task: Task): TaskWorkflowStatus => {
  const normalizedDescription = task.description?.toLowerCase() || "";
  if (normalizedDescription.includes("[rejected]")) return "rejected";
  if (normalizedDescription.includes("[need_revision]")) return "need_revision";
  if (task.approved) return "approved";
  if (isTaskOverdue(task)) return "overdue";
  if (task.status === "Done") return "submitted";
  if (task.status === "In Progress") return "in_progress";
  return "todo";
};

const getReviewStatus = (task: Task): ReviewStatus => {
  const workflowStatus = getWorkflowStatus(task);
  if (workflowStatus === "approved") return "approved";
  if (workflowStatus === "rejected") return "rejected";
  if (workflowStatus === "need_revision") return "need_revision";
  return "pending";
};

const statusMeta: Record<TaskWorkflowStatus, { label: string; className: string; order: number }> = {
  todo: {
    label: "Chưa bắt đầu",
    className: "border-slate-200 bg-slate-100 text-slate-700",
    order: 1,
  },
  in_progress: {
    label: "Đang thực hiện",
    className: "border-sky-200 bg-sky-50 text-sky-700",
    order: 2,
  },
  submitted: {
    label: "Đã nộp",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    order: 3,
  },
  need_revision: {
    label: "Cần chỉnh sửa",
    className: "border-orange-200 bg-orange-50 text-orange-700",
    order: 4,
  },
  approved: {
    label: "Đã hoàn thành",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    order: 5,
  },
  rejected: {
    label: "Bị từ chối",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    order: 6,
  },
  overdue: {
    label: "Trễ hạn",
    className: "border-red-200 bg-red-50 text-red-700",
    order: 7,
  },
};

const difficultyMeta = (priority?: Task["priority"]) => {
  switch (priority) {
    case "High":
      return {
        label: "Khó",
        className: "border-rose-200 bg-rose-50 text-rose-700",
      };
    case "Medium":
      return {
        label: "Trung bình",
        className: "border-orange-200 bg-orange-50 text-orange-700",
      };
    case "Low":
      return {
        label: "Dễ",
        className: "border-emerald-200 bg-emerald-50 text-emerald-700",
      };
    default:
      return {
        label: "Chưa phân loại",
        className: "border-slate-200 bg-slate-100 text-slate-700",
      };
  }
};

const reviewMeta = (status: ReviewStatus) => {
  if (status === "approved") {
    return { label: "Đã hoàn thành", className: "text-emerald-700" };
  }
  if (status === "rejected") {
    return { label: "Bị từ chối", className: "text-rose-700" };
  }
  if (status === "need_revision") {
    return { label: "Cần chỉnh sửa", className: "text-orange-700" };
  }
  return { label: "Đang chờ review", className: "text-amber-700" };
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
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-10 w-80" />
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
          <Skeleton className="h-11 rounded-2xl" />
          <Skeleton className="h-11 rounded-2xl" />
          <Skeleton className="h-11 rounded-2xl" />
        </div>
      </CardContent>
    </Card>
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <Skeleton key={index} className="h-[190px] rounded-3xl" />
      ))}
    </div>
  </div>
);

const StudentMyTasks = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { profile, loading: authLoading, signOut, user } = useAuth();
  const {
    groups,
    currentGroupIndex,
    tasks,
    currentUserName,
    dataLoading,
    connectionError,
    loadPersistedState,
    updateTaskStatus,
  } = useTeam();

  const [statusFilter, setStatusFilter] = useState<"all" | TaskWorkflowStatus>("all");
  const [sortBy, setSortBy] = useState<SortOption>("deadline");
  const [searchTerm, setSearchTerm] = useState("");
  const [startTaskCandidate, setStartTaskCandidate] = useState<Task | null>(null);
  useEffect(() => {
    if (authLoading || !profile) return;
    if (profile.role === "lecturer" || profile.role === "admin") {
      navigate("/dashboard-lecturer", { replace: true });
    }
  }, [authLoading, navigate, profile]);

  const group = groups[currentGroupIndex] || groups[0];

  const myTasks = useMemo(() => {
    return tasks.filter(task => isTaskAssignedToStudent(task, user?.id, currentUserName));
  }, [currentUserName, tasks, user?.id]);

  const visibleTasks = useMemo(() => {
    const normalizedQuery = searchTerm.trim().toLowerCase();

    const filtered = myTasks.filter(task => {
      const workflowStatus = getWorkflowStatus(task);
      if (statusFilter !== "all" && workflowStatus !== statusFilter) {
        return false;
      }
      if (!normalizedQuery) return true;
      return (
        task.name.toLowerCase().includes(normalizedQuery) ||
        (task.description || "").toLowerCase().includes(normalizedQuery)
      );
    });

    const withIndex = filtered.map((task, index) => ({ task, index }));

    withIndex.sort((left, right) => {
      if (sortBy === "deadline") {
        return parseDeadline(left.task.deadline) - parseDeadline(right.task.deadline);
      }
      if (sortBy === "latest") {
        return right.index - left.index;
      }
      if (sortBy === "weight") {
        return right.task.contributionPercent - left.task.contributionPercent;
      }
      return statusMeta[getWorkflowStatus(left.task)].order - statusMeta[getWorkflowStatus(right.task)].order;
    });

    return withIndex.map(item => item.task);
  }, [myTasks, searchTerm, sortBy, statusFilter]);

  const filters = useMemo(
    () => [
      { key: "all" as const, label: tr(language, "Tất cả", "All") },
      { key: "todo" as const, label: tr(language, "Chưa bắt đầu", "Not Started") },
      { key: "in_progress" as const, label: tr(language, "Đang thực hiện", "In Progress") },
      { key: "submitted" as const, label: tr(language, "Đã nộp", "Submitted") },
      { key: "need_revision" as const, label: tr(language, "Cần chỉnh sửa", "Needs Revision") },
      { key: "approved" as const, label: tr(language, "Đã hoàn thành", "Completed") },
      { key: "rejected" as const, label: tr(language, "Bị từ chối", "Rejected") },
      { key: "overdue" as const, label: tr(language, "Trễ hạn", "Overdue") },
    ],
    [],
  );

  const handleStartTask = (task: Task) => {
    if (getWorkflowStatus(task) !== "todo") return;
    updateTaskStatus(task.id, "In Progress", currentUserName);
    toast({
      title: "Đã bắt đầu task",
      description: `"${task.name}" đã được chuyển sang trạng thái đang thực hiện.`,
    });
  };

  const executeStartTask = (task: Task) => {
    const validation = canStudentStartTask(task, isTaskAssignedToStudent(task, user?.id, currentUserName));
    if (!validation.ok) {
      toast({
        title: "Không thể cập nhật task",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }

    updateTaskStatus(task.id, "In Progress", currentUserName);
    toast({
      title: "Đã cập nhật task",
      description: STUDENT_TASK_PROGRESS_MESSAGES.startSuccess,
    });
  };

  void handleStartTask;

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_42%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--card))_100%)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
          {dataLoading ? <TaskListSkeleton /> : null}

          {!dataLoading && connectionError ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6">
                <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{tr(language, "Không thể tải task của bạn", "Unable to load your tasks")}</AlertTitle>
                  <AlertDescription className="mt-2 flex flex-col gap-4 text-amber-900/80">
                    <p>{tr(language, "Đã có lỗi khi đồng bộ dữ liệu task. Vui lòng thử tải lại.", "An error occurred while syncing task data. Please try reloading.")}</p>
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
                  description="Khi được thêm vào dự án, các task được giao cho bạn sẽ xuất hiện tại đây."
                  icon={FolderOpen}
                />
              </CardContent>
            </Card>
          ) : null}

          {!dataLoading && !connectionError && group ? (
            <>
              <Card className="rounded-3xl border-0 shadow-card">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border border-primary/15 bg-primary/10 text-primary hover:bg-primary/10">
                          {tr(language, "Thành viên", "User")}
                        </Badge>
                        <Badge variant="outline" className="border-border/80 bg-background/80 text-muted-foreground">
                          {group.name}
                        </Badge>
                      </div>
                      <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{tr(language, "Task của tôi", "My Tasks")}</h1>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {tr(language, "Chỉ hiển thị task được giao cho bạn. Bạn có thể bắt đầu task, nộp minh chứng, chỉnh sửa submission khi còn được phép và xem phản hồi review.", "Only tasks assigned to you are displayed. You can start tasks, submit evidence, edit submissions when allowed, and view review feedback.")}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{myTasks.length}</span> {tr(language, "task được giao", "tasks assigned")}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                        placeholder={tr(language, "Tìm theo tên task hoặc mô tả", "Search by task name or description")}
                        className="h-11 rounded-2xl pl-10"
                      />
                    </div>

                    <Select value={statusFilter} onValueChange={(value: "all" | TaskWorkflowStatus) => setStatusFilter(value)}>
                      <SelectTrigger className="h-11 rounded-2xl">
                        <div className="flex items-center gap-2">
                          <Filter className="h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Lọc trạng thái" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {filters.map(filter => (
                          <SelectItem key={filter.key} value={filter.key}>
                            {filter.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Select value={sortBy} onValueChange={(value: SortOption) => setSortBy(value)}>
                      <SelectTrigger className="h-11 rounded-2xl">
                        <div className="flex items-center gap-2">
                          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Sắp xếp" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="deadline">{tr(language, "Deadline gần nhất", "Closest Deadline")}</SelectItem>
                        <SelectItem value="latest">{tr(language, "Giao gần đây nhất", "Most Recent")}</SelectItem>
                        <SelectItem value="weight">{tr(language, "Weight cao nhất", "Highest Weight")}</SelectItem>
                        <SelectItem value="status">{tr(language, "Trạng thái", "Status")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              {myTasks.length === 0 ? (
                <Card className="rounded-3xl border-0 shadow-card">
                  <CardContent className="p-6">
                    <EmptyBlock
                      title={tr(language, "Bạn chưa có task nào được giao.", "You have no tasks assigned.")}
                      description={tr(language, "Khi trưởng nhóm giao việc, task của bạn sẽ xuất hiện tại đây.", "When a team leader assigns tasks, they will appear here.")}
                      icon={FolderOpen}
                    />
                  </CardContent>
                </Card>
              ) : visibleTasks.length === 0 ? (
                <Card className="rounded-3xl border-0 shadow-card">
                  <CardContent className="p-6">
                    <EmptyBlock
                      title={tr(language, "Không tìm thấy task phù hợp.", "No matching tasks found.")}
                      description={tr(language, "Hãy thử thay đổi từ khóa tìm kiếm hoặc bộ lọc trạng thái.", "Try changing the search keyword or status filter.")}
                      icon={Search}
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {visibleTasks.map(task => {
                    const workflowStatus = getWorkflowStatus(task);
                    const reviewStatus = getReviewStatus(task);
                    const difficulty = difficultyMeta(task.priority);
                    const status = statusMeta[workflowStatus];
                    const review = reviewMeta(reviewStatus);
                    const hasEvidence = (task.evidence?.length ?? 0) > 0;
                    const submissionStatus = hasEvidence ? tr(language, "Đã nộp minh chứng", "Evidence Submitted") : tr(language, "Chưa nộp", "Not Submitted");
                    const isAssignee = isTaskAssignedToStudent(task, user?.id, currentUserName);
                    const canStart = canStudentStartTask(task, isAssignee).ok;
                    const canSubmitEvidence = canStudentOpenSubmission(task, isAssignee).ok;
                    const canEditSubmission = canStudentEditSubmission(task, isAssignee).ok && ["pending", "need_revision"].includes(reviewStatus);

                    return (
                      <Card
                        key={task.id}
                        className={cn(
                          "rounded-3xl border-0 shadow-card",
                          workflowStatus === "overdue" ? "ring-1 ring-red-200" : "",
                        )}
                      >
                        <CardContent className="p-5">
                          <div className="flex flex-col gap-5">
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-lg font-semibold">{task.name}</p>
                                  <Badge className={cn("border", status.className)}>{status.label}</Badge>
                                  {workflowStatus === "overdue" ? (
                                    <Badge className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
                                      <TimerOff className="mr-1 h-3 w-3" />
                                      {tr(language, "Task đang trễ hạn", "Task Overdue")}
                                    </Badge>
                                  ) : null}
                                </div>
                                <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                                  {task.description?.trim() || tr(language, "Chưa có mô tả chi tiết cho task này.", "No detailed description for this task.")}
                                </p>
                              </div>

                              <div className="grid min-w-[280px] gap-3 rounded-2xl border border-border/70 bg-background/80 p-3 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Hạn chót", "Deadline")}</p>
                                  <p className="mt-1 text-sm font-medium">{formatDate(task.deadline)}</p>
                                </div>
                              </div>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Độ khó", "Difficulty")}</p>
                                <Badge className={cn("mt-2 border", difficulty.className)}>{difficulty.label}</Badge>
                              </div>
                              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Weight", "Weight")}</p>
                                <p className="mt-2 text-lg font-semibold">{task.contributionPercent}%</p>
                              </div>
                              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Review", "Review")}</p>
                                <p className={cn("mt-2 text-sm font-medium", review.className)}>{review.label}</p>
                              </div>
                              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Minh chứng", "Evidence")}</p>
                                <p className="mt-2 text-sm font-medium">{hasEvidence ? `${task.evidence?.length || 0} ${tr(language, "file", "file")}` : tr(language, "Chưa có file", "No files")}</p>
                              </div>
                              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                                <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Submission", "Submission")}</p>
                                <p className="mt-2 text-sm font-medium">{submissionStatus}</p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              <Button variant="outline" className="rounded-2xl" onClick={() => navigate(`/student/tasks/${task.id}`)}>
                                <Eye className="mr-2 h-4 w-4" />
                                {tr(language, "Xem chi tiết", "View Details")}
                              </Button>

                              {canStart ? (
                                <Button className="rounded-2xl" onClick={() => setStartTaskCandidate(task)}>
                                  <CheckCircle2 className="mr-2 h-4 w-4" />
                                  {tr(language, "Bắt đầu task", "Start Task")}
                                </Button>
                              ) : null}

                              {canSubmitEvidence ? (
                                <Button variant="outline" className="rounded-2xl" onClick={() => navigate(`/student/tasks/${task.id}/submit`)}>
                                  <FileUp className="mr-2 h-4 w-4" />
                                  {hasEvidence && canEditSubmission ? "Edit submission" : "Submit evidence"}
                                </Button>
                              ) : null}

                              {canEditSubmission && hasEvidence ? (
                                <Button variant="outline" className="rounded-2xl" onClick={() => navigate(`/student/tasks/${task.id}/submit`)}>
                                  <FilePenLine className="mr-2 h-4 w-4" />
                                  {tr(language, "Chỉnh sửa submission", "Edit Submission")}
                                </Button>
                              ) : null}

                              <Button variant="outline" className="rounded-2xl" onClick={() => navigate(`/student/tasks/${task.id}`)}>
                                <MessageSquareQuote className="mr-2 h-4 w-4" />
                                {tr(language, "Xem review feedback", "View Review Feedback")}
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={Boolean(startTaskCandidate)}
        onOpenChange={open => {
          if (!open) {
            setStartTaskCandidate(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tr(language, "Bắt đầu task", "Start Task")}</AlertDialogTitle>
            <AlertDialogDescription>{STUDENT_TASK_PROGRESS_MESSAGES.startConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr(language, "Hủy", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (startTaskCandidate) {
                  executeStartTask(startTaskCandidate);
                }
                setStartTaskCandidate(null);
              }}
            >
              {tr(language, "Xác nhận", "Confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
};

export default StudentMyTasks;
