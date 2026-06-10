import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertCircle,
  BookOpenText,
  CheckCircle2,
  ClipboardPenLine,
  Clock3,
  FilePenLine,
  FileText,
  FileUp,
  FolderOpen,
  Link as LinkIcon,
  Lock,
  MessageSquareQuote,
  RefreshCcw,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { TaskListSkeleton } from "@/components/skeletons";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam, type ActivityLogEntry, type Task } from "@/context/TeamContext";
import {
  STUDENT_TASK_PROGRESS_MESSAGES,
  canStudentEditSubmission,
  canStudentOpenSubmission,
  canStudentStartTask,
  isLateSubmission,
  isTaskAssignedToStudent,
} from "@/lib/studentTaskProgress";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
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

type ReviewStatus = "pending" | "need_revision" | "approved" | "rejected";

type RequirementSection = {
  expectedOutput: string[];
  acceptanceCriteria: string[];
  leaderNotes: string[];
  relatedLinks: string[];
};

type WorkLogEntry = {
  id: string;
  loggedAt: string;
  hoursSpent: number;
  description: string;
  link?: string;
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

const formatDate = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Chưa cập nhật";
  return dateFormatter.format(parsed);
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return "Chưa cập nhật";
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Chưa cập nhật";
  return dateTimeFormatter.format(parsed);
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

const statusMeta: Record<TaskWorkflowStatus, { label: string; className: string }> = {
  todo: {
    label: "Chưa bắt đầu",
    className: "border-slate-200 bg-slate-100 text-slate-700",
  },
  in_progress: {
    label: "Đang thực hiện",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  submitted: {
    label: "Đã nộp",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  need_revision: {
    label: "Cần chỉnh sửa",
    className: "border-orange-200 bg-orange-50 text-orange-700",
  },
  approved: {
    label: "Đã duyệt",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  rejected: {
    label: "Bị từ chối",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
  overdue: {
    label: "Trễ hạn",
    className: "border-red-200 bg-red-50 text-red-700",
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
    return { label: "Đã duyệt", className: "text-emerald-700", rating: "Tốt" };
  }
  if (status === "rejected") {
    return { label: "Bị từ chối", className: "text-rose-700", rating: "Chưa đạt" };
  }
  if (status === "need_revision") {
    return { label: "Cần chỉnh sửa", className: "text-orange-700", rating: "Cần cải thiện" };
  }
  return { label: "Đang chờ review", className: "text-amber-700", rating: "Chưa có" };
};

const parseRequirementBlock = (description?: string): RequirementSection => {
  const source = description || "";

  const readSection = (label: string) => {
    const regex = new RegExp(`${label}:([\\s\\S]*?)(?=\\n[A-Za-z ]+:|$)`, "i");
    const match = source.match(regex);
    if (!match?.[1]) return [];
    return match[1]
      .split("\n")
      .map(item => item.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  };

  return {
    expectedOutput: readSection("expected output"),
    acceptanceCriteria: readSection("acceptance criteria"),
    leaderNotes: readSection("notes from team leader"),
    relatedLinks: readSection("related links"),
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
  <div className="flex min-h-[180px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-background/70 px-6 py-10 text-center">
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
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <Skeleton key={index} className="h-16 rounded-2xl" />
          ))}
        </div>
      </CardContent>
    </Card>
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Skeleton className="h-[320px] rounded-3xl" />
      <Skeleton className="h-[320px] rounded-3xl" />
    </div>
    <Skeleton className="h-[300px] rounded-3xl" />
  </div>
);

const StudentTaskDetail = () => {
  const { taskId } = useParams();
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
    updateTask,
    addLog,
  } = useTeam();

  const [workLogs, setWorkLogs] = useState<WorkLogEntry[]>([]);
  const [workLogsLoading, setWorkLogsLoading] = useState(false);
  const [workLogsError, setWorkLogsError] = useState("");
  const [submissionOpen, setSubmissionOpen] = useState(false);
  const [submissionNote, setSubmissionNote] = useState("");
  const [submissionLinks, setSubmissionLinks] = useState("");
  const [submissionError, setSubmissionError] = useState("");
  const [workLogOpen, setWorkLogOpen] = useState(false);
  const [workLogText, setWorkLogText] = useState("");
  const [hoursSpent, setHoursSpent] = useState("1");
  const [workLogError, setWorkLogError] = useState("");
  const evidenceRef = useRef<HTMLInputElement | null>(null);
  const [pendingEvidenceTaskId, setPendingEvidenceTaskId] = useState<string | null>(null);
  const [startTaskConfirmOpen, setStartTaskConfirmOpen] = useState(false);

  useEffect(() => {
    if (authLoading || !profile) return;
    if (profile.role === "lecturer" || profile.role === "admin") {
      navigate("/dashboard-lecturer", { replace: true });
    }
  }, [authLoading, navigate, profile]);

  const group = groups[currentGroupIndex] || groups[0];
  const task = useMemo(() => tasks.find(item => item.id === taskId) || null, [taskId, tasks]);

  const isAssignedToStudent = useMemo(() => {
    if (!task) return false;
    return isTaskAssignedToStudent(task, user?.id, currentUserName);
  }, [currentUserName, task, user?.id]);

  const createdLog = useMemo(() => {
    if (!group || !task) return null;
    return group.activityLog.find(entry => entry.description.includes(`Task "${task.name}"`) && entry.description.includes("tạo"));
  }, [group, task]);

  const taskActivity = useMemo(() => {
    if (!group || !task) return [] as ActivityLogEntry[];
    return group.activityLog
      .filter(entry => entry.description.includes(task.name))
      .sort((left, right) => right.timestamp.getTime() - left.timestamp.getTime());
  }, [group, task]);

  const latestSubmissionLog = useMemo(() => {
    return taskActivity.find(entry => entry.description.includes("minh chứng"));
  }, [taskActivity]);

  const latestReviewLog = useMemo(() => {
    return taskActivity.find(entry => entry.description.includes("duyệt") || entry.description.includes("review"));
  }, [taskActivity]);

  const requirements = useMemo(() => parseRequirementBlock(task?.description), [task?.description]);

  const workflowStatus = task ? getWorkflowStatus(task) : "todo";
  const reviewStatus = task ? getReviewStatus(task) : "pending";
  const canStart = Boolean(task && canStudentStartTask(task, isAssignedToStudent).ok);
  const canSubmitEvidence = Boolean(task && canStudentOpenSubmission(task, isAssignedToStudent).ok);
  const canEditSubmission = Boolean(task && canStudentEditSubmission(task, isAssignedToStudent).ok && ["pending", "need_revision"].includes(reviewStatus));

  useEffect(() => {
    if (!taskId || !user?.id || !isSupabaseConfigured) {
      setWorkLogs([]);
      setWorkLogsLoading(false);
      setWorkLogsError("");
      return;
    }

    let cancelled = false;
    setWorkLogsLoading(true);
    setWorkLogsError("");

    void supabase
      .from("contribution_logs")
      .select("id, logged_at, hours_spent, log_text, evidence_link")
      .eq("task_id", taskId)
      .eq("student_id", user.id)
      .is("deleted_at", null)
      .order("logged_at", { ascending: false })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setWorkLogsError("Không thể tải work log của task này.");
          setWorkLogs([]);
          return;
        }

        const mapped = (data || []).map(item => {
          const linkMatch = item.log_text.match(/Link:\s*(https?:\/\/\S+)/i);
          return {
            id: item.id,
            loggedAt: item.logged_at,
            hoursSpent: Number(item.hours_spent),
            description: item.log_text.replace(/\n?Link:\s*https?:\/\/\S+/i, "").trim(),
            link: item.evidence_link || linkMatch?.[1],
          } satisfies WorkLogEntry;
        });

        setWorkLogs(mapped);
      })
      .catch(() => {
        if (!cancelled) {
          setWorkLogsError("Không thể tải work log của task này.");
          setWorkLogs([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setWorkLogsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [taskId, user?.id]);

  const refreshWorkLogs = async () => {
    if (!taskId || !user?.id || !isSupabaseConfigured) return;
    setWorkLogsLoading(true);
    setWorkLogsError("");
    const { data, error } = await supabase
      .from("contribution_logs")
      .select("id, logged_at, hours_spent, log_text, evidence_link")
      .eq("task_id", taskId)
      .eq("student_id", user.id)
      .is("deleted_at", null)
      .order("logged_at", { ascending: false });

    if (error) {
      setWorkLogsError("Không thể tải work log của task này.");
      setWorkLogs([]);
    } else {
      setWorkLogs(
        (data || []).map(item => {
          const linkMatch = item.log_text.match(/Link:\s*(https?:\/\/\S+)/i);
          return {
            id: item.id,
            loggedAt: item.logged_at,
            hoursSpent: Number(item.hours_spent),
            description: item.log_text.replace(/\n?Link:\s*https?:\/\/\S+/i, "").trim(),
            link: item.evidence_link || linkMatch?.[1],
          } satisfies WorkLogEntry;
        }),
      );
    }
    setWorkLogsLoading(false);
  };

  const executeStartTask = () => {
    if (!task) return;

    const validation = canStudentStartTask(task, isAssignedToStudent);
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

  const handleStartTask = () => {
    if (!task || !canStart) return;
    updateTaskStatus(task.id, "In Progress", currentUserName);
    toast({
      title: "Đã bắt đầu task",
      description: `"${task.name}" đã được chuyển sang trạng thái đang thực hiện.`,
    });
  };

  void handleStartTask;

  const handleOpenSubmission = () => {
    if (!task) return;
    const validation = canStudentOpenSubmission(task, isAssignedToStudent);
    if (!validation.ok) {
      toast({
        title: "Không thể cập nhật task",
        description: validation.message,
        variant: "destructive",
      });
      return;
    }
    setSubmissionError("");
    setSubmissionOpen(true);
  };

  const handleSelectEvidenceFile = () => {
    if (!task) return;
    setPendingEvidenceTaskId(task.id);
    evidenceRef.current?.click();
  };

  const handleEvidenceUpload = () => {
    const file = evidenceRef.current?.files?.[0];
    if (!file || !pendingEvidenceTaskId || !task || task.id !== pendingEvidenceTaskId) return;

    const validation = canStudentOpenSubmission(task, isAssignedToStudent);
    if (!validation.ok) {
      setSubmissionError(validation.message);
      if (evidenceRef.current) evidenceRef.current.value = "";
      setPendingEvidenceTaskId(null);
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setSubmissionError("Dung lượng file tối đa là 50MB.");
      if (evidenceRef.current) evidenceRef.current.value = "";
      return;
    }

    let cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    if (cleanName.length > 100) {
      const parts = cleanName.split(".");
      const ext = parts.length > 1 ? parts.pop() : "";
      const base = parts.join(".");
      cleanName = base.substring(0, 95 - (ext ? ext.length + 1 : 0)) + (ext ? `.${ext}` : "");
    }

    const existingEvidence = task.evidence || [];
    updateTask(task.id, {
      evidence: [...existingEvidence, { fileName: cleanName, uploadTime: new Date() }],
    });

    if (task.status === "Todo") {
      updateTaskStatus(task.id, "In Progress", currentUserName);
    }

    addLog(`Task "${task.name}" đã được nộp minh chứng: ${cleanName}`);
    toast({
      title: existingEvidence.length > 0 ? "Đã cập nhật submission" : "Đã nộp bằng chứng",
      description: `"${cleanName}" đã được ghi nhận cho task "${task.name}".`,
    });

    if (evidenceRef.current) evidenceRef.current.value = "";
    setPendingEvidenceTaskId(null);
  };

  const handleSubmitSubmissionNote = () => {
    if (!task) return;
    const validation = canStudentOpenSubmission(task, isAssignedToStudent);
    if (!validation.ok) {
      setSubmissionError(validation.message);
      return;
    }

    const trimmedNote = submissionNote.trim();
    if (!trimmedNote && !(task.evidence?.length ?? 0) && !submissionLinks.trim()) {
      setSubmissionError("Vui lòng nhập ghi chú submission, thêm minh chứng hoặc dán link liên quan.");
      return;
    }

    const sanitizedLinks = submissionLinks
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean);

    const auditLines = [
      `Task "${task.name}" submission note: ${trimmedNote || "Không có ghi chú bổ sung."}`,
      ...(sanitizedLinks.length ? [`Links: ${sanitizedLinks.join(", ")}`] : []),
    ];

    if (isLateSubmission(task)) {
      auditLines.push(`Submission cho task "${task.name}" Ä‘Æ°á»£c ghi nháº­n quÃ¡ háº¡n.`);
    }

    addLog(auditLines.join(" "));

    if (task.status !== "Done") {
      updateTaskStatus(task.id, "Done", currentUserName);
    }

    toast({
      title: "Đã gửi submission",
      description: `Submission của "${task.name}" đã được cập nhật và chờ review.`,
    });

    setSubmissionOpen(false);
    setSubmissionNote("");
    setSubmissionLinks("");
    setSubmissionError("");
  };

  const handleSubmitWorkLog = async () => {
    if (!task || !user?.id) return;
    const trimmed = workLogText.trim();
    const numericHours = Number(hoursSpent);

    if (trimmed.length < 10) {
      setWorkLogError("Vui lòng nhập mô tả work log tối thiểu 10 ký tự.");
      return;
    }
    if (!Number.isFinite(numericHours) || numericHours <= 0) {
      setWorkLogError("Vui lòng nhập thời gian thực hiện lớn hơn 0.");
      return;
    }

    if (!isSupabaseConfigured) {
      addLog(`Work log cho task "${task.name}" (${numericHours} giờ): ${trimmed}`);
      toast({
        title: "Đã lưu work log",
        description: `Nhật ký công việc cho "${task.name}" đã được ghi nhận.`,
      });
      setWorkLogOpen(false);
      setWorkLogText("");
      setHoursSpent("1");
      setWorkLogError("");
      return;
    }

    const payloadText = trimmed;
    const { error } = await supabase.from("contribution_logs").insert({
      group_id: group?.id,
      student_id: user.id,
      task_id: task.id,
      work_date: new Date().toISOString().slice(0, 10),
      log_text: payloadText,
      hours_spent: numericHours,
      evidence_link: null,
      attachment: [],
    });

    if (error) {
      setWorkLogError(error.message);
      return;
    }

    addLog(`Work log cho task "${task.name}" (${numericHours} giờ): ${trimmed}`);
    await refreshWorkLogs();
    toast({
      title: "Đã lưu work log",
      description: `Nhật ký công việc cho "${task.name}" đã được ghi nhận.`,
    });
    setWorkLogOpen(false);
    setWorkLogText("");
    setHoursSpent("1");
    setWorkLogError("");
  };

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
                  <AlertTitle>Không thể tải chi tiết task</AlertTitle>
                  <AlertDescription className="mt-2 flex flex-col gap-4 text-amber-900/80">
                    <p>Đã có lỗi khi đồng bộ dữ liệu task. Vui lòng thử tải lại.</p>
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

          {!dataLoading && !connectionError && !task ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6">
                <EmptyBlock
                  title="Không tìm thấy task."
                  description="Task này không tồn tại hoặc đã bị xóa khỏi dự án."
                  icon={FolderOpen}
                />
                <div className="mt-4 flex justify-center">
                  <Button onClick={() => navigate("/student/my-tasks")}>Quay lại danh sách task</Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {!dataLoading && !connectionError && task && !isAssignedToStudent ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6">
                <EmptyBlock
                  title="Bạn không có quyền truy cập task này."
                  description="Sinh viên chỉ được mở task được giao cho mình hoặc task nhóm có quyền hiển thị công khai."
                  icon={Lock}
                />
              </CardContent>
            </Card>
          ) : null}

          {!dataLoading && !connectionError && task && isAssignedToStudent ? (
            <>
              <Card className="rounded-3xl border-0 shadow-card">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border border-primary/15 bg-primary/10 text-primary hover:bg-primary/10">
                          Sinh viên
                        </Badge>
                        <Badge className={cn("border", statusMeta[workflowStatus].className)}>
                          {statusMeta[workflowStatus].label}
                        </Badge>
                        {workflowStatus === "overdue" ? (
                          <Badge className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
                            <TimerOff className="mr-1 h-3 w-3" />
                            Task đang trễ hạn
                          </Badge>
                        ) : null}
                      </div>
                      <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">{task.name}</h1>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                        Xem toàn bộ thông tin task, submission, phản hồi review và work log liên quan đến phần việc của bạn.
                      </p>
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">{group?.name || "Chưa có nhóm"}</span>
                    </div>
                  </div>

                  {workflowStatus === "approved" ? (
                    <Alert className="rounded-2xl border-emerald-200 bg-emerald-50 text-emerald-900 [&>svg]:text-emerald-700">
                      <Lock className="h-4 w-4" />
                      <AlertTitle>Task đã được duyệt</AlertTitle>
                      <AlertDescription>
                        Task đã được duyệt. Bạn không thể chỉnh sửa submission trừ khi nhóm trưởng mở lại.
                      </AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Assigned by</p>
                      <p className="mt-2 text-sm font-medium">{group?.members.find(member => member.role === "Leader")?.name || "Trưởng nhóm"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Assignee</p>
                      <p className="mt-2 text-sm font-medium">{task.assignedTo}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Created date</p>
                      <p className="mt-2 text-sm font-medium">{createdLog ? formatDateTime(createdLog.timestamp) : "Chưa cập nhật"}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Deadline</p>
                      <p className="mt-2 text-sm font-medium">{formatDate(task.deadline)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Độ khó</p>
                      <Badge className={cn("mt-2 border", difficultyMeta(task.priority).className)}>
                        {difficultyMeta(task.priority).label}
                      </Badge>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Weight</p>
                      <p className="mt-2 text-sm font-medium">{task.contributionPercent}%</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Current status</p>
                      <Badge className={cn("mt-2 border", statusMeta[workflowStatus].className)}>
                        {statusMeta[workflowStatus].label}
                      </Badge>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Project / group</p>
                      <p className="mt-2 text-sm font-medium">{group?.name || "Chưa cập nhật"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                <Card className="rounded-3xl border-0 shadow-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Yêu cầu công việc</CardTitle>
                    <CardDescription>Kỳ vọng đầu ra, tiêu chí nghiệm thu và ghi chú liên quan đến task này.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-sm font-medium">Expected output</p>
                      {requirements.expectedOutput.length ? (
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                          {requirements.expectedOutput.map(item => (
                            <li key={item} className="leading-6">• {item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Chưa có mô tả đầu ra kỳ vọng.</p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-sm font-medium">Acceptance criteria</p>
                      {requirements.acceptanceCriteria.length ? (
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                          {requirements.acceptanceCriteria.map(item => (
                            <li key={item} className="leading-6">• {item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Chưa có tiêu chí nghiệm thu cụ thể.</p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-sm font-medium">Notes from team leader</p>
                      {requirements.leaderNotes.length ? (
                        <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                          {requirements.leaderNotes.map(item => (
                            <li key={item} className="leading-6">• {item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Chưa có ghi chú riêng từ nhóm trưởng.</p>
                      )}
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-sm font-medium">Related links / files</p>
                      {requirements.relatedLinks.length ? (
                        <div className="mt-2 space-y-2">
                          {requirements.relatedLinks.map(link => (
                            <a
                              key={link}
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 text-sm text-primary hover:underline"
                            >
                              <LinkIcon className="h-4 w-4" />
                              {link}
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-muted-foreground">Chưa có link hoặc file tham chiếu.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-3xl border-0 shadow-card">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Submission và review</CardTitle>
                    <CardDescription>Thông tin submission mới nhất, minh chứng đính kèm và phản hồi review hiện tại.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-sm font-medium">Submission mới nhất</p>
                      {task.evidence?.length ? (
                        <div className="mt-3 space-y-3">
                          <p className="text-sm text-muted-foreground">
                            {latestSubmissionLog?.description || "Submission đã được ghi nhận, chưa có ghi chú chi tiết bổ sung."}
                          </p>
                          <div className="space-y-2">
                            {task.evidence.map(file => (
                              <div key={`${file.fileName}-${file.uploadTime.getTime()}`} className="flex items-center gap-2 text-sm">
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span>{file.fileName}</span>
                              </div>
                            ))}
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Submitted date</p>
                              <p className="mt-1 text-sm font-medium">{latestSubmissionLog ? formatDateTime(latestSubmissionLog.timestamp) : "Chưa cập nhật"}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Submission status</p>
                              <p className="mt-1 text-sm font-medium">{statusMeta[workflowStatus].label}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <EmptyBlock
                          title="Chưa có submission."
                          description="Hãy nộp minh chứng hoặc ghi chú submission khi task đã sẵn sàng để review."
                          icon={FileUp}
                        />
                      )}
                    </div>

                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-sm font-medium">Review result</p>
                      {reviewStatus === "pending" ? (
                        <EmptyBlock
                          title="Chưa có review."
                          description="Task đang chờ trưởng nhóm hoặc người phụ trách review."
                          icon={MessageSquareQuote}
                        />
                      ) : (
                        <div className="mt-3 space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Reviewed by</p>
                              <p className="mt-1 text-sm font-medium">{group?.members.find(member => member.role === "Leader")?.name || "Trưởng nhóm"}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Review status</p>
                              <p className={cn("mt-1 text-sm font-medium", reviewMeta(reviewStatus).className)}>
                                {reviewMeta(reviewStatus).label}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Quality rating</p>
                              <p className="mt-1 text-sm font-medium">{reviewMeta(reviewStatus).rating}</p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Reviewed date</p>
                              <p className="mt-1 text-sm font-medium">{latestReviewLog ? formatDateTime(latestReviewLog.timestamp) : "Chưa cập nhật"}</p>
                            </div>
                          </div>
                          <p className="text-sm leading-6 text-muted-foreground">
                            {reviewStatus === "approved"
                              ? "Task đã đạt yêu cầu. Submission hiện đang bị khóa cho đến khi nhóm trưởng mở lại."
                              : reviewStatus === "rejected"
                                ? "Task chưa đạt yêu cầu và đã bị từ chối. Hãy trao đổi với nhóm trưởng trước khi nộp lại."
                                : "Task cần chỉnh sửa trước khi được duyệt. Vui lòng cập nhật submission theo góp ý hiện tại."}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="rounded-3xl border-0 shadow-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">Work log</CardTitle>
                  <CardDescription>Nhật ký công việc và số giờ bạn đã ghi nhận cho task này.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {workLogsLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton key={index} className="h-20 rounded-2xl" />
                      ))}
                    </div>
                  ) : workLogsError ? (
                    <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Không thể tải work log</AlertTitle>
                      <AlertDescription>{workLogsError}</AlertDescription>
                    </Alert>
                  ) : workLogs.length === 0 ? (
                    <EmptyBlock
                      title="Chưa có work log."
                      description="Bạn có thể thêm work log để ghi nhận thời gian và nội dung công việc đã thực hiện."
                      icon={ClipboardPenLine}
                    />
                  ) : (
                    <div className="space-y-3">
                      {workLogs.map(log => (
                        <div key={log.id} className="rounded-2xl border border-border bg-background/80 p-4">
                          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className="border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100">
                                  {formatDateTime(log.loggedAt)}
                                </Badge>
                                <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                                  {log.hoursSpent} giờ
                                </Badge>
                              </div>
                              <p className="text-sm leading-6">{log.description}</p>
                              {log.link ? (
                                <a href={log.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
                                  <LinkIcon className="h-4 w-4" />
                                  {log.link}
                                </a>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-0 shadow-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">Thao tác</CardTitle>
                  <CardDescription>Chỉ hiển thị các hành động mà sinh viên được phép thực hiện trên task này.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {canStart ? (
                      <Button className="rounded-2xl" onClick={() => setStartTaskConfirmOpen(true)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Bắt đầu task
                      </Button>
                    ) : null}

                    {canSubmitEvidence ? (
                      <Button variant="outline" className="rounded-2xl" onClick={() => navigate(`/student/tasks/${task.id}/submit`)}>
                        <FileUp className="mr-2 h-4 w-4" />
                        Nộp bằng chứng
                      </Button>
                    ) : null}

                    {canEditSubmission ? (
                      <Button variant="outline" className="rounded-2xl" onClick={() => navigate(`/student/tasks/${task.id}/submit`)}>
                        <FilePenLine className="mr-2 h-4 w-4" />
                        Chỉnh sửa submission
                      </Button>
                    ) : null}

                    <Button variant="outline" className="rounded-2xl" onClick={() => navigate(`/student/work-logs?taskId=${task.id}`)}>
                      <ClipboardPenLine className="mr-2 h-4 w-4" />
                      Viết work log
                    </Button>

                    <Button variant="outline" className="rounded-2xl" onClick={() => navigate("/student/feedback")}>
                      <MessageSquareQuote className="mr-2 h-4 w-4" />
                      Xem feedback
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>

      <AlertDialog open={startTaskConfirmOpen} onOpenChange={setStartTaskConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bắt đầu task</AlertDialogTitle>
            <AlertDialogDescription>{STUDENT_TASK_PROGRESS_MESSAGES.startConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                executeStartTask();
                setStartTaskConfirmOpen(false);
              }}
            >
              Xác nhận
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <input ref={evidenceRef} type="file" className="hidden" onChange={handleEvidenceUpload} />

      <Dialog open={submissionOpen} onOpenChange={open => {
        setSubmissionOpen(open);
        if (!open) {
          setSubmissionNote("");
          setSubmissionLinks("");
          setSubmissionError("");
        }
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{canEditSubmission ? "Chỉnh sửa submission" : "Nộp bằng chứng"}</DialogTitle>
            <DialogDescription>
              Thêm ghi chú submission, link minh chứng và tệp đính kèm cho task này.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="submission-note">Submission note</Label>
              <Textarea
                id="submission-note"
                value={submissionNote}
                onChange={event => {
                  setSubmissionNote(event.target.value);
                  if (submissionError) setSubmissionError("");
                }}
                placeholder="Mô tả ngắn những gì bạn đã hoàn thành, phần nào cần reviewer lưu ý."
                className="min-h-[120px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="submission-links">Evidence links</Label>
              <Textarea
                id="submission-links"
                value={submissionLinks}
                onChange={event => setSubmissionLinks(event.target.value)}
                placeholder="Mỗi dòng một link minh chứng, ví dụ: https://github.com/... hoặc https://figma.com/..."
                className="min-h-[96px]"
              />
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Evidence files</p>
                  <p className="text-sm text-muted-foreground">
                    {(task?.evidence?.length ?? 0) > 0 ? `${task?.evidence?.length || 0} file đã được thêm.` : "Chưa có file nào được thêm."}
                  </p>
                </div>
                <Button type="button" variant="outline" className="rounded-2xl" onClick={handleSelectEvidenceFile}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Thêm file minh chứng
                </Button>
              </div>
            </div>
            {submissionError ? <p className="text-sm text-destructive">{submissionError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmissionOpen(false)}>Hủy</Button>
            <Button onClick={handleSubmitSubmissionNote}>Lưu submission</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={workLogOpen} onOpenChange={open => {
        setWorkLogOpen(open);
        if (!open) {
          setWorkLogText("");
          setHoursSpent("1");
          setWorkLogError("");
        }
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Viết work log</DialogTitle>
            <DialogDescription>
              Ghi lại mô tả công việc và thời gian bạn đã dành cho task này. Dữ liệu sẽ được lưu vào audit log và contribution log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="work-log-hours">Time spent (giờ)</Label>
              <Input
                id="work-log-hours"
                type="number"
                min="0.25"
                step="0.25"
                value={hoursSpent}
                onChange={event => {
                  setHoursSpent(event.target.value);
                  if (workLogError) setWorkLogError("");
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="work-log-description">Mô tả công việc</Label>
              <Textarea
                id="work-log-description"
                value={workLogText}
                onChange={event => {
                  setWorkLogText(event.target.value);
                  if (workLogError) setWorkLogError("");
                }}
                placeholder="Ví dụ: Hoàn thành phần tích hợp API danh sách task và kiểm tra lại trạng thái quá hạn."
                className="min-h-[140px]"
              />
            </div>
            {workLogError ? <p className="text-sm text-destructive">{workLogError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWorkLogOpen(false)}>Hủy</Button>
            <Button onClick={() => void handleSubmitWorkLog()}>Lưu work log</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentTaskDetail;
