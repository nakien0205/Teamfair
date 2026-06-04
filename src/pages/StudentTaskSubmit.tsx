import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import {
  AlertCircle,
  BookOpenText,
  CheckCircle2,
  FileText,
  FileUp,
  FolderOpen,
  Link2,
  Loader2,
  Sparkles,
  TimerOff,
  Trash2,
  Users,
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam, type Task } from "@/context/TeamContext";
import { createTaskSubmission, fetchLatestTaskSubmission, uploadTaskEvidenceFiles, type SubmissionHistoryRecord } from "@/lib/taskSubmissions";
import { isSupabaseConfigured } from "@/lib/supabaseClient";
import { cn } from "@/lib/utils";
import { t } from "@/lib/i18n";
import {
  canStudentEditSubmission,
  canStudentOpenSubmission,
  isLateSubmission,
  isTaskAssignedToStudent,
} from "@/lib/studentTaskProgress";

const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg", ".zip"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 5;

const submissionSchema = z.object({
  submissionNote: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập mô tả submission.")
    .min(20, "Mô tả cần ít nhất 20 ký tự.")
    .max(1000, "Mô tả không được vượt quá 1000 ký tự."),
  confirmationChecked: z.literal(true, {
    errorMap: () => ({ message: "Bạn cần xác nhận trước khi nộp." }),
  }),
  lateReason: z.string(),
  linksText: z.string(),
});

type FormState = {
  submissionNote: string;
  linksText: string;
  confirmationChecked: boolean;
  lateReason: string;
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formatDate = (value?: string) => {
  if (!value) return "Chưa cập nhật";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Chưa cập nhật";
  return dateFormatter.format(parsed);
};

const getWorkflowStatus = (task: Task) => {
  const description = task.description?.toLowerCase() || "";
  if (description.includes("[rejected]")) return "rejected" as const;
  if (description.includes("[need_revision]")) return "need_revision" as const;
  if (task.approved) return "approved" as const;
  if (task.status === "Done") return "submitted" as const;
  if (task.status === "In Progress") return "in_progress" as const;
  return "todo" as const;
};

const statusMeta = {
  todo: { label: "Chưa bắt đầu", className: "border-slate-200 bg-slate-100 text-slate-700" },
  in_progress: { label: "Đang thực hiện", className: "border-sky-200 bg-sky-50 text-sky-700" },
  submitted: { label: "Đã nộp", className: "border-amber-200 bg-amber-50 text-amber-700" },
  need_revision: { label: "Cần chỉnh sửa", className: "border-orange-200 bg-orange-50 text-orange-700" },
  approved: { label: "Đã duyệt", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { label: "Bị từ chối", className: "border-rose-200 bg-rose-50 text-rose-700" },
} as const;

const LoadingPage = () => (
  <div className="space-y-6">
    <Skeleton className="h-28 rounded-3xl" />
    <Skeleton className="h-[520px] rounded-3xl" />
  </div>
);

const EmptyBlock = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-background/70 px-6 py-10 text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
      <FolderOpen className="h-5 w-5" />
    </div>
    <p className="text-base font-semibold">{title}</p>
    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
);

const StudentTaskSubmit = () => {
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
    updateTask,
    updateTaskStatus,
    addLog,
  } = useTeam();

  const [form, setForm] = useState<FormState>({
    submissionNote: "",
    linksText: "",
    confirmationChecked: false,
    lateReason: "",
  });
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState | "linksText" | "files", string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [latestSubmission, setLatestSubmission] = useState<SubmissionHistoryRecord | null>(null);

  useEffect(() => {
    if (authLoading || !profile) return;
    if (profile.role === "lecturer" || profile.role === "admin") {
      navigate("/dashboard-lecturer", { replace: true });
    }
  }, [authLoading, navigate, profile]);

  const group = groups[currentGroupIndex] || groups[0];
  const task = useMemo(() => tasks.find(item => item.id === taskId) || null, [taskId, tasks]);
  const isAssignee = useMemo(() => (task ? isTaskAssignedToStudent(task, user?.id, currentUserName) : false), [currentUserName, task, user?.id]);
  const workflowStatus = task ? getWorkflowStatus(task) : "todo";
  const canSubmit = task ? canStudentOpenSubmission(task, isAssignee).ok : false;
  const canEdit = task ? canStudentEditSubmission(task, isAssignee).ok : false;
  const isLate = task ? isLateSubmission(task) : false;
  const status = task ? statusMeta[workflowStatus] : statusMeta.todo;

  useEffect(() => {
    if (!taskId || !task || !canEdit) return;

    let cancelled = false;
    setHistoryLoading(true);
    void fetchLatestTaskSubmission(taskId)
      .then(record => {
        if (cancelled || !record) return;
        setLatestSubmission(record);
        setForm(current => ({
          ...current,
          submissionNote: current.submissionNote || record.submissionNote,
          linksText: current.linksText || record.evidenceLinks.join("\n"),
          lateReason: current.lateReason || record.lateReason || "",
          confirmationChecked: current.confirmationChecked,
        }));
      })
      .catch(() => {
        if (!cancelled) {
          setLatestSubmission(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setHistoryLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canEdit, task, taskId]);

  const validateLinks = (linksText: string) => {
    const links = linksText
      .split("\n")
      .map(item => item.trim())
      .filter(Boolean);

    for (const link of links) {
      try {
        const url = new URL(link);
        if (!["http:", "https:"].includes(url.protocol)) {
          return { links, error: "Link không hợp lệ." };
        }
      } catch {
        return { links, error: "Link không hợp lệ." };
      }
    }

    return { links, error: "" };
  };

  const validateFiles = (files: File[]) => {
    if (files.length > MAX_FILES) return "Chỉ được tải tối đa 5 file.";

    for (const file of files) {
      const fileName = file.name.toLowerCase();
      const extension = fileName.slice(fileName.lastIndexOf("."));
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        return "Định dạng file không được hỗ trợ.";
      }
      if (file.size > MAX_FILE_SIZE) {
        return "File vượt quá dung lượng cho phép.";
      }
    }

    return "";
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files || []);
    const nextFiles = [...selectedFiles, ...incoming];
    const fileError = validateFiles(nextFiles);
    setSelectedFiles(fileError ? selectedFiles : nextFiles);
    setFieldErrors(current => ({ ...current, files: fileError || undefined }));
    if (submitError) setSubmitError("");
    event.target.value = "";
  };

  const removeFile = (targetName: string) => {
    const nextFiles = selectedFiles.filter(file => `${file.name}-${file.size}` !== targetName);
    setSelectedFiles(nextFiles);
    setFieldErrors(current => ({ ...current, files: validateFiles(nextFiles) || undefined }));
  };

  const handleChange = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setFieldErrors(current => ({ ...current, [key]: undefined }));
    setSubmitError("");
  };

  const handleSubmit = async () => {
    if (!task || !group || !user?.id) return;

    const parseResult = submissionSchema.safeParse(form);
    const nextErrors: Partial<Record<keyof FormState | "linksText" | "files", string>> = {};

    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        const key = issue.path[0] as keyof FormState | undefined;
        if (key && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
    }

    const { links, error: linkError } = validateLinks(form.linksText);
    if (linkError) {
      nextErrors.linksText = linkError;
    }

    const fileError = validateFiles(selectedFiles);
    if (fileError) {
      nextErrors.files = fileError;
    }

    if (isLate && !form.lateReason.trim()) {
      nextErrors.lateReason = "Vui lòng nhập lý do nộp trễ.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    const validation = canStudentOpenSubmission(task, isAssignee);
    if (!validation.ok) {
      setSubmitError(validation.message);
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const uploadedFiles = await uploadTaskEvidenceFiles({
        groupId: group.id,
        taskId: task.id,
        studentId: user.id,
        files: selectedFiles,
      });

      await createTaskSubmission({
        taskId: task.id,
        groupId: group.id,
        studentId: user.id,
        submissionNote: form.submissionNote.trim(),
        evidenceLinks: links,
        evidenceFiles: uploadedFiles,
        checklistConfirmed: true,
        lateReason: isLate ? form.lateReason.trim() : null,
        isLate,
      });

      const existingEvidence = task.evidence || [];
      updateTask(task.id, {
        evidence: [
          ...existingEvidence,
          ...uploadedFiles.map(file => ({
            fileName: file.fileName,
            uploadTime: new Date(file.uploadedAt),
            fileSize: file.fileSize,
            mimeType: file.mimeType,
            storagePath: file.storagePath,
            publicUrl: file.publicUrl,
          })),
        ],
      });

      if (task.status !== "Done") {
        updateTaskStatus(task.id, "Done", currentUserName);
      }

      addLog(
        [
          `Sinh viên ${currentUserName} đã nộp submission cho task "${task.name}" và đang chờ nhóm trưởng duyệt.`,
          `Ghi chú: ${form.submissionNote.trim()}`,
          links.length ? `Links: ${links.join(", ")}` : "",
          uploadedFiles.length ? `Files: ${uploadedFiles.map(file => file.fileName).join(", ")}` : "",
          isLate ? `Nộp trễ. Lý do: ${form.lateReason.trim()}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      );

      toast({
        title: "Nộp thành công",
        description: "Bạn đã nộp bằng chứng thành công. Submission đang chờ nhóm trưởng duyệt.",
      });

      if (isSupabaseConfigured) {
        await loadPersistedState();
      }
      navigate(`/student/tasks/${task.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Không thể nộp bằng chứng lúc này.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_42%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--card))_100%)]">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 md:px-6">
          {dataLoading ? <LoadingPage /> : null}

          {!dataLoading && connectionError ? (
            <Alert className="rounded-3xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Không thể tải dữ liệu task</AlertTitle>
              <AlertDescription>Vui lòng thử lại sau.</AlertDescription>
            </Alert>
          ) : null}

          {!dataLoading && !connectionError && !group ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6">
                <EmptyBlock title="Bạn chưa được phân vào nhóm nào." description="Khi có nhóm, bạn mới có thể nộp minh chứng cho task được giao." />
              </CardContent>
            </Card>
          ) : null}

          {!dataLoading && !connectionError && group && !task ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6">
                <EmptyBlock title="Không tìm thấy task." description="Task này không tồn tại hoặc đã bị thay đổi." />
              </CardContent>
            </Card>
          ) : null}

          {!dataLoading && !connectionError && group && task && !isAssignee ? (
            <Alert className="rounded-3xl border-rose-200 bg-rose-50 text-rose-900 [&>svg]:text-rose-700">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Không có quyền truy cập</AlertTitle>
              <AlertDescription>Bạn chỉ có thể nộp bằng chứng cho task được giao cho mình.</AlertDescription>
            </Alert>
          ) : null}

          {!dataLoading && !connectionError && group && task && isAssignee ? (
            <>
              <Card className="rounded-3xl border-0 shadow-card">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border border-primary/15 bg-primary/10 text-primary hover:bg-primary/10">
                          Nộp bằng chứng
                        </Badge>
                        {isLate ? (
                          <Badge className="border border-red-200 bg-red-50 text-red-700 hover:bg-red-50">
                            <TimerOff className="mr-1 h-3 w-3" />
                            Nộp trễ
                          </Badge>
                        ) : null}
                      </div>
                      <h1 className="mt-3 text-2xl font-semibold tracking-tight">{task.name}</h1>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Điền đầy đủ mô tả, thêm link hoặc file minh chứng, rồi gửi submission để nhóm trưởng review.
                      </p>
                    </div>

                    <Button variant="outline" className="rounded-2xl" onClick={() => navigate(`/student/tasks/${task.id}`)}>
                      Hủy
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Deadline</p>
                      <p className="mt-2 text-sm font-medium">{formatDate(task.deadline)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Trạng thái hiện tại</p>
                      <Badge className={cn("mt-2 border", status.className)}>{status.label}</Badge>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Submission status</p>
                      <p className="mt-2 text-sm font-medium">Pending Review</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {isLate ? (
                <Alert className="rounded-3xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Task nộp trễ</AlertTitle>
                  <AlertDescription>
                    Task này đã quá hạn. Bạn vẫn có thể nộp nhưng hệ thống sẽ ghi nhận là nộp trễ.
                  </AlertDescription>
                </Alert>
              ) : null}

              {workflowStatus === "approved" ? (
                <Alert className="rounded-3xl border-emerald-200 bg-emerald-50 text-emerald-900 [&>svg]:text-emerald-700">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Submission đã bị khóa</AlertTitle>
                  <AlertDescription>Task đã được duyệt. Bạn không thể chỉnh sửa submission nữa.</AlertDescription>
                </Alert>
              ) : null}

              <Card className="rounded-3xl border-0 shadow-card">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{latestSubmission ? "Chỉnh sửa submission" : "Tạo submission mới"}</CardTitle>
                  <CardDescription>
                    {historyLoading
                      ? "Đang tải submission gần nhất..."
                      : latestSubmission
                        ? "Bạn có thể cập nhật submission gần nhất khi task chưa được duyệt."
                        : "Submission sau khi nộp sẽ chuyển sang trạng thái chờ nhóm trưởng duyệt."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="submission-note">Submission note</Label>
                    <Textarea
                      id="submission-note"
                      value={form.submissionNote}
                      onChange={event => handleChange("submissionNote", event.target.value)}
                      placeholder="Mô tả ngắn gọn bạn đã làm gì, kết quả là gì..."
                      className="min-h-[140px] rounded-2xl"
                      disabled={!canSubmit || submitting}
                    />
                    {fieldErrors.submissionNote ? <p className="text-sm text-destructive">{fieldErrors.submissionNote}</p> : null}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="submission-links">Evidence links</Label>
                    <Textarea
                      id="submission-links"
                      value={form.linksText}
                      onChange={event => handleChange("linksText", event.target.value)}
                      placeholder={"Mỗi dòng một link minh chứng\nVí dụ: https://drive.google.com/..."}
                      className="min-h-[120px] rounded-2xl"
                      disabled={!canSubmit || submitting}
                    />
                    <p className="text-xs text-muted-foreground">
                      Có thể dùng Google Drive, GitHub, Figma, Docs, YouTube hoặc link deploy.
                    </p>
                    {fieldErrors.linksText ? <p className="text-sm text-destructive">{fieldErrors.linksText}</p> : null}
                  </div>

                  <div className="space-y-3 rounded-3xl border border-border/70 bg-background/80 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium">File minh chứng</p>
                        <p className="text-xs text-muted-foreground">Hỗ trợ PDF, DOCX, XLSX, PNG, JPG, ZIP. Tối đa 5 file, 10MB mỗi file.</p>
                      </div>
                      <Label
                        htmlFor="evidence-files"
                        className={cn(
                          "inline-flex cursor-pointer items-center justify-center rounded-2xl border border-input bg-background px-4 py-2 text-sm font-medium",
                          !canSubmit || submitting ? "pointer-events-none opacity-50" : "",
                        )}
                      >
                        <FileUp className="mr-2 h-4 w-4" />
                        Thêm file
                      </Label>
                    </div>

                    <Input
                      id="evidence-files"
                      type="file"
                      multiple
                      accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip"
                      className="hidden"
                      onChange={handleFileSelection}
                      disabled={!canSubmit || submitting}
                    />

                    {selectedFiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Chưa có file nào được chọn.</p>
                    ) : (
                      <div className="space-y-2">
                        {selectedFiles.map(file => (
                          <div
                            key={`${file.name}-${file.size}`}
                            className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                            <Button type="button" variant="ghost" size="icon" onClick={() => removeFile(`${file.name}-${file.size}`)} disabled={submitting}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {fieldErrors.files ? <p className="text-sm text-destructive">{fieldErrors.files}</p> : null}
                  </div>

                  {isLate ? (
                    <div className="space-y-2">
                      <Label htmlFor="late-reason">Lý do nộp trễ</Label>
                      <Textarea
                        id="late-reason"
                        value={form.lateReason}
                        onChange={event => handleChange("lateReason", event.target.value)}
                        placeholder="Giải thích lý do nộp trễ..."
                        className="min-h-[120px] rounded-2xl"
                        disabled={!canSubmit || submitting}
                      />
                      {fieldErrors.lateReason ? <p className="text-sm text-destructive">{fieldErrors.lateReason}</p> : null}
                    </div>
                  ) : null}

                  <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id="submission-confirm"
                        checked={form.confirmationChecked}
                        onCheckedChange={checked => handleChange("confirmationChecked", Boolean(checked))}
                        disabled={!canSubmit || submitting}
                      />
                      <div className="space-y-1">
                        <Label htmlFor="submission-confirm" className="cursor-pointer text-sm font-medium">
                          Tôi xác nhận đây là phần việc do tôi thực hiện hoặc đóng góp chính.
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Xác nhận này là bắt buộc trước khi gửi submission.
                        </p>
                      </div>
                    </div>
                    {fieldErrors.confirmationChecked ? <p className="mt-2 text-sm text-destructive">{fieldErrors.confirmationChecked}</p> : null}
                  </div>

                  {submitError ? (
                    <Alert className="rounded-2xl border-rose-200 bg-rose-50 text-rose-900 [&>svg]:text-rose-700">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Không thể nộp submission</AlertTitle>
                      <AlertDescription>{submitError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => navigate(`/student/tasks/${task.id}`)} disabled={submitting}>
                      Hủy
                    </Button>
                    <Button type="button" className="rounded-2xl" onClick={() => void handleSubmit()} disabled={!canSubmit || submitting}>
                      {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                      Nộp bằng chứng
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {latestSubmission ? (
                <Card className="rounded-3xl border-0 shadow-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Submission gần nhất</CardTitle>
                    <CardDescription>Submission này đang được dùng để prefill khi bạn chỉnh sửa.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-sm leading-6">{latestSubmission.submissionNote}</p>
                    </div>
                    {latestSubmission.evidenceLinks.length ? (
                      <div className="space-y-2">
                        {latestSubmission.evidenceLinks.map(link => (
                          <a key={link} href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline">
                            <Link2 className="h-4 w-4" />
                            {link}
                          </a>
                        ))}
                      </div>
                    ) : null}
                    {latestSubmission.evidenceFiles.length ? (
                      <div className="space-y-2">
                        {latestSubmission.evidenceFiles.map(file => (
                          <div key={`${file.fileName}-${file.uploadedAt}`} className="flex items-center gap-2 text-sm text-muted-foreground">
                            <FileText className="h-4 w-4" />
                            <span>{file.fileName}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default StudentTaskSubmit;
