import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import {
  AlertCircle,
  BookOpenText,
  CalendarDays,
  ClipboardPenLine,
  FileText,
  FileUp,
  FolderOpen,
  Link as LinkIcon,
  Loader2,
  PencilLine,
  RefreshCcw,
  Sparkles,
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { TaskListSkeleton } from "@/components/skeletons";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam } from "@/context/TeamContext";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createStudentWorkLog, listStudentWorkLogs, softDeleteStudentWorkLog, updateStudentWorkLog, uploadWorkLogAttachment, type WorkLogAttachment, type WorkLogRecord } from "@/lib/workLogs";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = [".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg", ".zip"];

const workLogSchema = z.object({
  workDate: z.string().min(1, "Vui lòng chọn ngày làm việc."),
  hoursSpent: z
    .string()
    .min(1, "Vui lòng nhập thời gian thực hiện.")
    .refine(value => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric > 0 && numeric <= 24;
    }, "Thời gian thực hiện phải lớn hơn 0 và không vượt quá 24 giờ."),
  description: z.string().trim().min(20, "Mô tả cần ít nhất 20 ký tự."),
  evidenceLink: z.string(),
});

type WorkLogFormState = {
  taskId: string;
  workDate: string;
  hoursSpent: string;
  description: string;
  evidenceLink: string;
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

const formatDateTime = (value?: string | null) => {
  if (!value) return "Chưa cập nhật";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Chưa cập nhật";
  return dateTimeFormatter.format(parsed);
};

const getTodayInputValue = () => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const defaultFormState = (taskId = "none"): WorkLogFormState => ({
  taskId,
  workDate: getTodayInputValue(),
  hoursSpent: "1",
  description: "",
  evidenceLink: "",
});

const isProjectMilestoneLocked = (descriptions: string[]) =>
  descriptions.some(description => {
    const normalized = description.toLowerCase();
    return normalized.includes("[milestone_locked]") || normalized.includes("[project_locked]");
  });

const LoadingPage = () => (
  <div className="space-y-6">
    <Skeleton className="h-32 rounded-3xl" />
    <Skeleton className="h-[420px] rounded-3xl" />
  </div>
);

const EmptyBlock = ({
  title,
  description,
}: {
  title: string;
  description: string;
}) => (
  <div className="flex min-h-[240px] flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-background/70 px-6 py-10 text-center">
    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
      <ClipboardPenLine className="h-5 w-5" />
    </div>
    <p className="text-base font-semibold">{title}</p>
    <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
  </div>
);

const StudentWorkLogs = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { language } = useLanguage();
  const { toast } = useToast();
  const { profile, loading: authLoading, signOut, user } = useAuth();
  const { groups, currentGroupIndex, tasks, currentUserName, dataLoading, connectionError, loadPersistedState, addLog } = useTeam();

  const [logs, setLogs] = useState<WorkLogRecord[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<WorkLogRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WorkLogRecord | null>(null);
  const [form, setForm] = useState<WorkLogFormState>(defaultFormState());
  const [uploadedAttachment, setUploadedAttachment] = useState<WorkLogAttachment | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof WorkLogFormState | "attachment", string>>>({});
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || !profile) return;
    if (profile.role === "lecturer" || profile.role === "admin") {
      navigate("/dashboard-lecturer", { replace: true });
    }
  }, [authLoading, navigate, profile]);

  const group = groups[currentGroupIndex] || groups[0];
  const lockState = useMemo(
    () => isProjectMilestoneLocked(group?.activityLog.map(entry => entry.description) || []),
    [group?.activityLog],
  );

  const visibleTasks = useMemo(() => {
    if (!group) return [];
    const relatedTaskId = searchParams.get("taskId");
    const inGroup = tasks.filter(task => group.id && group.tasks.some(groupTask => groupTask.id === task.id));
    if (!relatedTaskId) return inGroup;
    return [
      ...inGroup.filter(task => task.id === relatedTaskId),
      ...inGroup.filter(task => task.id !== relatedTaskId),
    ];
  }, [group, searchParams, tasks]);

  const loadLogs = useCallback(async () => {
    if (!user?.id || !group) return;
    setLogsLoading(true);
    setLogsError("");
    try {
      const data = await listStudentWorkLogs(user.id, group.id);
      setLogs(data);
    } catch (error) {
      setLogsError(error instanceof Error ? error.message : "Không thể tải work log.");
      setLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [group, user?.id]);

  useEffect(() => {
    if (!user?.id || !group) {
      setLogs([]);
      setLogsLoading(false);
      setLogsError("");
      return;
    }
    void loadLogs();
  }, [group, loadLogs, user?.id]);

  const taskNameById = useMemo(() => {
    const map = new Map<string, string>();
    visibleTasks.forEach(task => map.set(task.id, task.name));
    return map;
  }, [visibleTasks]);

  const openCreateDialog = () => {
    const preferredTaskId = searchParams.get("taskId");
    const resolvedTaskId = preferredTaskId && taskNameById.has(preferredTaskId) ? preferredTaskId : "none";
    setEditingLog(null);
    setForm(defaultFormState(resolvedTaskId));
    setUploadedAttachment(null);
    setFieldErrors({});
    setSubmitError("");
    setDialogOpen(true);
  };

  const openEditDialog = (log: WorkLogRecord) => {
    setEditingLog(log);
    setForm({
      taskId: log.taskId || "none",
      workDate: log.workDate,
      hoursSpent: `${log.timeSpentHours}`,
      description: log.description,
      evidenceLink: log.evidenceLink || "",
    });
    setUploadedAttachment(log.attachments[0] || null);
    setFieldErrors({});
    setSubmitError("");
    setDialogOpen(true);
  };

  const handleFieldChange = <K extends keyof WorkLogFormState>(key: K, value: WorkLogFormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setFieldErrors(current => ({ ...current, [key]: undefined }));
    setSubmitError("");
  };

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !group || !user?.id) return;

    const lowerName = file.name.toLowerCase();
    const extension = lowerName.slice(lowerName.lastIndexOf("."));
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
      setFieldErrors(current => ({ ...current, attachment: "Định dạng file không được hỗ trợ." }));
      event.target.value = "";
      return;
    }
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setFieldErrors(current => ({ ...current, attachment: "File vượt quá dung lượng cho phép." }));
      event.target.value = "";
      return;
    }

    setFieldErrors(current => ({ ...current, attachment: undefined }));
    try {
      const attachment = await uploadWorkLogAttachment({
        groupId: group.id,
        studentId: user.id,
        file,
      });
      setUploadedAttachment(attachment);
    } catch (error) {
      setFieldErrors(current => ({
        ...current,
        attachment: error instanceof Error ? error.message : "Không thể tải attachment.",
      }));
    } finally {
      event.target.value = "";
    }
  };

  const validateTaskId = (value: string) => value === "none" || taskNameById.has(value);

  const handleSave = async () => {
    if (!group || !user?.id) return;

    const parsed = workLogSchema.safeParse(form);
    const nextErrors: Partial<Record<keyof WorkLogFormState | "attachment", string>> = {};

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof WorkLogFormState | undefined;
        if (key && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
    }

    const workDateTime = new Date(form.workDate);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (Number.isNaN(workDateTime.getTime()) || workDateTime > today) {
      nextErrors.workDate = "Ngày làm việc không được ở tương lai.";
    }

    if (form.evidenceLink.trim()) {
      try {
        const url = new URL(form.evidenceLink.trim());
        if (!["http:", "https:"].includes(url.protocol)) {
          nextErrors.evidenceLink = "Evidence link không hợp lệ.";
        }
      } catch {
        nextErrors.evidenceLink = "Evidence link không hợp lệ.";
      }
    }

    if (!validateTaskId(form.taskId)) {
      nextErrors.taskId = "Bạn chỉ có thể liên kết work log với task trong nhóm của mình.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }

    if (lockState) {
      setSubmitError("Milestone hiện đã bị khóa nên bạn không thể chỉnh sửa work log.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      const payload = {
        taskId: form.taskId === "none" ? null : form.taskId,
        workDate: form.workDate,
        timeSpentHours: Number(form.hoursSpent),
        description: form.description.trim(),
        evidenceLink: form.evidenceLink.trim() || null,
        attachments: uploadedAttachment ? [uploadedAttachment] : [],
      };

      const savedLog = editingLog
        ? await updateStudentWorkLog(editingLog.id, payload)
        : await createStudentWorkLog({
            groupId: group.id,
            studentId: user.id,
            ...payload,
          });

      setLogs(current => {
        if (editingLog) {
          return current.map(item => (item.id === savedLog.id ? savedLog : item));
        }
        return [savedLog, ...current];
      });

      addLog(
        editingLog
          ? `Sinh viên ${currentUserName} đã cập nhật work log ngày ${form.workDate}.`
          : `Sinh viên ${currentUserName} đã thêm work log ngày ${form.workDate}.`,
      );

      toast({
        title: editingLog ? "Đã cập nhật work log" : "Đã lưu work log",
        description: "Work log giúp ghi nhận quá trình làm việc, đặc biệt với các công việc khó thể hiện bằng file hoặc task output.",
      });

      setDialogOpen(false);
      setEditingLog(null);
      setUploadedAttachment(null);
      setFieldErrors({});
      setForm(defaultFormState());
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("taskId");
      setSearchParams(nextParams, { replace: true });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Không thể lưu work log.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (lockState) {
      setSubmitError("Milestone hiện đã bị khóa nên bạn không thể xóa work log.");
      setDeleteTarget(null);
      return;
    }

    try {
      await softDeleteStudentWorkLog(deleteTarget.id);
      setLogs(current => current.filter(item => item.id !== deleteTarget.id));
      addLog(`Sinh viên ${currentUserName} đã xóa mềm work log ngày ${deleteTarget.workDate}.`);
      toast({
        title: "Đã xóa work log",
        description: "Work log đã được ẩn khỏi danh sách của bạn.",
      });
    } catch (error) {
      toast({
        title: "Không thể xóa work log",
        description: error instanceof Error ? error.message : "Đã có lỗi xảy ra.",
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_42%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--card))_100%)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
          {dataLoading ? <TaskListSkeleton /> : null}

          {!dataLoading && connectionError ? (
            <Alert className="rounded-3xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Không thể tải work log</AlertTitle>
              <AlertDescription className="mt-2 flex flex-col gap-4">
                <p>Đã có lỗi khi đồng bộ work log. Vui lòng thử tải lại.</p>
                <div>
                  <Button variant="outline" className="border-amber-300 bg-white" onClick={() => void loadPersistedState()}>
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    Tải lại dữ liệu
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {!dataLoading && !connectionError && !group ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6">
                <EmptyBlock title="Bạn chưa được phân vào nhóm nào." description="Khi đã tham gia nhóm, bạn có thể tạo và quản lý work log tại đây." />
              </CardContent>
            </Card>
          ) : null}

          {!dataLoading && !connectionError && group ? (
            <>
              <Card className="rounded-3xl border-0 shadow-card">
                <CardContent className="space-y-5 p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className="border border-primary/15 bg-primary/10 text-primary hover:bg-primary/10">
                          Work log
                        </Badge>
                        <Badge variant="outline" className="border-border/70 bg-background/80 text-muted-foreground">
                          {group.name}
                        </Badge>
                        {lockState ? (
                          <Badge className="border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                            Milestone đã khóa
                          </Badge>
                        ) : null}
                      </div>
                      <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">Work log của tôi</h1>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                        Work log giúp ghi nhận quá trình làm việc, đặc biệt với các công việc khó thể hiện bằng file hoặc task output.
                      </p>
                    </div>

                    <Button className="rounded-2xl" onClick={openCreateDialog} disabled={lockState}>
                      <ClipboardPenLine className="mr-2 h-4 w-4" />
                      Thêm work log
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {logsLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-[180px] rounded-3xl" />
                  ))}
                </div>
              ) : logsError ? (
                <Alert className="rounded-3xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Không thể tải work log</AlertTitle>
                  <AlertDescription>{logsError}</AlertDescription>
                </Alert>
              ) : logs.length === 0 ? (
                <Card className="rounded-3xl border-0 shadow-card">
                  <CardContent className="p-6">
                    <EmptyBlock
                      title="Bạn chưa có work log nào."
                      description="Hãy thêm work log để ghi lại tiến độ, công việc hỗ trợ, nghiên cứu, phối hợp nhóm hoặc ghi chú họp."
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {logs.map(log => (
                    <Card key={log.id} className="rounded-3xl border-0 shadow-card">
                      <CardContent className="space-y-4 p-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge className="border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-100">
                                <CalendarDays className="mr-1 h-3 w-3" />
                                {formatDate(log.workDate)}
                              </Badge>
                              <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">
                                {log.timeSpentHours} giờ
                              </Badge>
                              <Badge variant="outline" className="border-border/70 bg-background/80 text-muted-foreground">
                                {log.relatedTaskName || "Chưa liên kết task"}
                              </Badge>
                            </div>
                            <p className="text-sm leading-6">{log.description}</p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" className="rounded-2xl" onClick={() => openEditDialog(log)} disabled={lockState}>
                              <PencilLine className="mr-2 h-4 w-4" />
                              Chỉnh sửa
                            </Button>
                            <Button variant="outline" className="rounded-2xl text-rose-700" onClick={() => setDeleteTarget(log)} disabled={lockState}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Xóa
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Related task</p>
                            <p className="mt-2 text-sm font-medium">{log.relatedTaskName || "Không liên kết"}</p>
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Evidence link</p>
                            {log.evidenceLink ? (
                              <a href={log.evidenceLink} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline">
                                <LinkIcon className="h-4 w-4" />
                                Mở link
                              </a>
                            ) : (
                              <p className="mt-2 text-sm text-muted-foreground">Chưa có link</p>
                            )}
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Attachment</p>
                            {log.attachments.length ? (
                              <div className="mt-2 space-y-2">
                                {log.attachments.map(attachment => (
                                  <p key={`${attachment.fileName}-${attachment.uploadedAt}`} className="text-sm font-medium">
                                    {attachment.fileName}
                                  </p>
                                ))}
                              </div>
                            ) : (
                              <p className="mt-2 text-sm text-muted-foreground">Chưa có file</p>
                            )}
                          </div>
                          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                            <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Created at</p>
                            <p className="mt-2 text-sm font-medium">{formatDateTime(log.createdAt)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={open => {
          setDialogOpen(open);
          if (!open) {
            setEditingLog(null);
            setUploadedAttachment(null);
            setFieldErrors({});
            setSubmitError("");
            setForm(defaultFormState());
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingLog ? "Chỉnh sửa work log" : "Thêm work log"}</DialogTitle>
            <DialogDescription>
              Work log là bằng chứng hỗ trợ cho phân tích đóng góp, nhưng không tự quyết định điểm cuối cùng.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Related task</Label>
              <Select value={form.taskId} onValueChange={value => handleFieldChange("taskId", value)}>
                <SelectTrigger className="rounded-2xl">
                  <SelectValue placeholder="Chọn task liên quan (không bắt buộc)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Không liên kết task</SelectItem>
                  {visibleTasks.map(task => (
                    <SelectItem key={task.id} value={task.id}>
                      {task.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.taskId ? <p className="text-sm text-destructive">{fieldErrors.taskId}</p> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="work-date">Work date</Label>
                <Input
                  id="work-date"
                  type="date"
                  value={form.workDate}
                  onChange={event => handleFieldChange("workDate", event.target.value)}
                  className="rounded-2xl"
                />
                {fieldErrors.workDate ? <p className="text-sm text-destructive">{fieldErrors.workDate}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="hours-spent">Time spent (giờ)</Label>
                <Input
                  id="hours-spent"
                  type="number"
                  min="0.25"
                  max="24"
                  step="0.25"
                  value={form.hoursSpent}
                  onChange={event => handleFieldChange("hoursSpent", event.target.value)}
                  className="rounded-2xl"
                />
                {fieldErrors.hoursSpent ? <p className="text-sm text-destructive">{fieldErrors.hoursSpent}</p> : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="work-description">Description</Label>
              <Textarea
                id="work-description"
                value={form.description}
                onChange={event => handleFieldChange("description", event.target.value)}
                placeholder="Mô tả công việc đã làm, kết quả, học được gì, đã phối hợp ra sao..."
                className="min-h-[140px] rounded-2xl"
              />
              {fieldErrors.description ? <p className="text-sm text-destructive">{fieldErrors.description}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="evidence-link">Evidence link</Label>
              <Input
                id="evidence-link"
                value={form.evidenceLink}
                onChange={event => handleFieldChange("evidenceLink", event.target.value)}
                placeholder="https://drive.google.com/... hoặc https://github.com/..."
                className="rounded-2xl"
              />
              {fieldErrors.evidenceLink ? <p className="text-sm text-destructive">{fieldErrors.evidenceLink}</p> : null}
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Attachment</p>
                  <p className="text-xs text-muted-foreground">Tối đa 10MB. Hỗ trợ PDF, DOCX, XLSX, PNG, JPG, ZIP.</p>
                </div>
                <Label
                  htmlFor="work-log-attachment"
                  className={cn("inline-flex cursor-pointer items-center rounded-2xl border border-input bg-background px-4 py-2 text-sm font-medium", submitting ? "pointer-events-none opacity-50" : "")}
                >
                  <FileUp className="mr-2 h-4 w-4" />
                  Tải file
                </Label>
              </div>
              <Input id="work-log-attachment" type="file" accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg,.zip" className="hidden" onChange={event => void handleAttachmentChange(event)} />
              {uploadedAttachment ? (
                <div className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">
                  {uploadedAttachment.fileName}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có attachment.</p>
              )}
              {fieldErrors.attachment ? <p className="text-sm text-destructive">{fieldErrors.attachment}</p> : null}
            </div>

            {submitError ? (
              <Alert className="rounded-2xl border-rose-200 bg-rose-50 text-rose-900 [&>svg]:text-rose-700">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Không thể lưu work log</AlertTitle>
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setDialogOpen(false)} disabled={submitting}>
              Hủy
            </Button>
            <Button className="rounded-2xl" onClick={() => void handleSave()} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Lưu work log
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={open => (!open ? setDeleteTarget(null) : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa work log</AlertDialogTitle>
            <AlertDialogDescription>
              Work log sẽ được xóa mềm khỏi danh sách của bạn và vẫn để lại dấu vết trong audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>Xóa work log</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default StudentWorkLogs;
