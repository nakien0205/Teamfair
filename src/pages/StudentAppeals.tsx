import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import {
  AlertCircle,
  ClipboardPenLine,
  FileUp,
  PencilLine,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import StudentShell from "@/components/student/StudentShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { t, tr } from "@/lib/i18n";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/context/TeamContext";
import {
  createDraftStudentAppeal,
  getStudentAppealList,
  getStudentFeedbackList,
  submitDraftStudentAppeal,
  updateDraftStudentAppeal,
} from "@/lib/studentApi";
import {
  appealFormSchema,
  appealStatusMeta,
  appealTypeMeta,
  type AppealAttachment,
  type StudentAppealRecord,
  type StudentAppealType,
  uploadAppealAttachment,
} from "@/lib/studentAppeals";
import type { StudentFeedbackRecord } from "@/lib/studentFeedback";
import { cn } from "@/lib/utils";

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = [".pdf", ".docx", ".png", ".jpg", ".jpeg", ".zip"];

type AppealFormState = {
  appealType: StudentAppealType;
  relatedTaskId: string;
  relatedFeedbackId: string;
  relatedMilestone: string;
  explanationContent: string;
  evidenceLinksText: string;
  confirmationChecked: boolean;
};

const defaultFormState: AppealFormState = {
  appealType: "risk_flag",
  relatedTaskId: "none",
  relatedFeedbackId: "none",
  relatedMilestone: "",
  explanationContent: "",
  evidenceLinksText: "",
  confirmationChecked: false,
};

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const loadingCards = () => (
  <div className="space-y-6">
    <Skeleton className="h-28 rounded-3xl" />
    <Skeleton className="h-[480px] rounded-3xl" />
  </div>
);

const parseLinks = (value: string) =>
  value
    .split("\n")
    .map(item => item.trim())
    .filter(Boolean);

const StudentAppeals = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { groups, currentGroupIndex, tasks, lecturerStudentReviews, currentUserName, addLog } = useTeam();

  const [items, setItems] = useState<StudentAppealRecord[]>([]);
  const [feedbackOptions, setFeedbackOptions] = useState<StudentFeedbackRecord[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<StudentAppealRecord | null>(null);
  const [form, setForm] = useState<AppealFormState>(defaultFormState);
  const [attachments, setAttachments] = useState<AppealAttachment[]>([]);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AppealFormState | "links" | "attachments", string>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const group = groups[currentGroupIndex] || groups[0];

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    void Promise.all([
      getStudentAppealList(user.id),
      getStudentFeedbackList({
        studentId: user.id,
        studentName: currentUserName,
        tasks,
        lecturerReviews: lecturerStudentReviews,
      }),
    ])
      .then(([appeals, feedback]) => {
        if (cancelled) return;
        setItems(appeals);
        setFeedbackOptions(feedback);
      })
      .catch(fetchError => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Không thể tải giải trình.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserName, lecturerStudentReviews, tasks, user?.id]);

  const openCreateDialog = () => {
    setEditingItem(null);
    setForm(defaultFormState);
    setAttachments([]);
    setFieldErrors({});
    setError("");
    setDialogOpen(true);
  };

  const openEditDialog = (item: StudentAppealRecord) => {
    setEditingItem(item);
    setForm({
      appealType: item.appealType,
      relatedTaskId: item.relatedTaskId || "none",
      relatedFeedbackId: item.relatedFeedbackId || "none",
      relatedMilestone: item.relatedMilestone || "",
      explanationContent: item.explanationContent,
      evidenceLinksText: item.evidenceLinks.join("\n"),
      confirmationChecked: false,
    });
    setAttachments(item.attachments);
    setFieldErrors({});
    setError("");
    setDialogOpen(true);
  };

  const handleFieldChange = <K extends keyof AppealFormState>(key: K, value: AppealFormState[K]) => {
    setForm(current => ({ ...current, [key]: value }));
    setFieldErrors(current => ({ ...current, [key]: undefined }));
    setError("");
  };

  const handleAttachmentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !group?.id || !user?.id) return;

    const extension = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
      setFieldErrors(current => ({ ...current, attachments: tr(language, "Định dạng file không được hỗ trợ.", "Unsupported file format.") }));
      event.target.value = "";
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      setFieldErrors(current => ({ ...current, attachments: tr(language, "File vượt quá dung lượng cho phép.", "File exceeds the allowed size.") }));
      event.target.value = "";
      return;
    }

    if (attachments.length >= 5) {
      setFieldErrors(current => ({ ...current, attachments: tr(language, "Chỉ được tải tối đa 5 file.", "Only 5 files can be uploaded.") }));
      event.target.value = "";
      return;
    }

    try {
      const uploaded = await uploadAppealAttachment({
        groupId: group.id,
        studentId: user.id,
        file,
      });
      setAttachments(current => [...current, uploaded]);
      setFieldErrors(current => ({ ...current, attachments: undefined }));
    } catch (uploadError) {
      setFieldErrors(current => ({
        ...current,
        attachments: uploadError instanceof Error ? uploadError.message : tr(language, "Không thể tải attachment.", "Failed to upload attachment."),
      }));
    } finally {
      event.target.value = "";
    }
  };

  const validateLinks = (value: string) => {
    for (const link of parseLinks(value)) {
      try {
        const url = new URL(link);
        if (!["http:", "https:"].includes(url.protocol)) {
          return tr(language, "Link không hợp lệ.", "Invalid link.");
        }
      } catch {
        return tr(language, "Link không hợp lệ.", "Invalid link.");
      }
    }
    return "";
  };

  const handleSave = async (submitNow: boolean) => {
    if (!group?.id || !user?.id) return;
    setSaving(true);
    setError("");

    const parsed = appealFormSchema.safeParse({
      appealType: form.appealType,
      explanationContent: form.explanationContent,
      confirmationChecked: submitNow ? form.confirmationChecked : true,
    });

    const nextErrors: Partial<Record<keyof AppealFormState | "links" | "attachments", string>> = {};
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof AppealFormState | undefined;
        if (key && !nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
    }

    const linkError = validateLinks(form.evidenceLinksText);
    if (linkError) nextErrors.links = linkError;

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setSaving(false);
      return;
    }

    const payload = {
      appealType: form.appealType,
      relatedTaskId: form.relatedTaskId === "none" ? null : form.relatedTaskId,
      relatedFeedbackId: form.relatedFeedbackId === "none" ? null : form.relatedFeedbackId,
      relatedPeriodId: null,
      relatedMilestone: form.relatedMilestone.trim() || null,
      explanationContent: form.explanationContent.trim(),
      evidenceLinks: parseLinks(form.evidenceLinksText),
      attachments,
    };

    try {
      let saved: StudentAppealRecord;
      if (editingItem) {
        saved = await updateDraftStudentAppeal(editingItem.id, payload);
        addLog(tr(language, `Sinh viên ${currentUserName} đã cập nhật bản nháp giải trình "${editingItem.id}".`, `Student ${currentUserName} has updated the draft appeal "${editingItem.id}".`));
      } else {
        saved = await createDraftStudentAppeal({
          id: "",
          groupId: group.id,
          studentId: user.id,
          appealType: payload.appealType,
          relatedTaskId: payload.relatedTaskId,
          relatedFeedbackId: payload.relatedFeedbackId,
          relatedPeriodId: null,
          relatedMilestone: payload.relatedMilestone,
          explanationContent: payload.explanationContent,
          evidenceLinks: payload.evidenceLinks,
          attachments: payload.attachments,
          status: "draft",
        });
        addLog(`Sinh viên ${currentUserName} đã tạo bản nháp giải trình "${saved.id}".`);
      }

      if (submitNow) {
        await submitDraftStudentAppeal(saved.id);
        addLog(`Sinh viên ${currentUserName} đã gửi giải trình "${saved.id}".`);
        saved = { ...saved, status: "submitted", submittedAt: new Date().toISOString() };
        toast({
          title: "Đã gửi giải trình",
          description: "Giải trình của bạn đã được gửi. Giảng viên hoặc nhóm trưởng sẽ xem xét.",
        });
      } else {
        toast({
          title: "Đã lưu bản nháp",
          description: "Bạn có thể quay lại chỉnh sửa trước khi gửi chính thức.",
        });
      }

      setItems(current => {
        const withoutCurrent = current.filter(item => item.id !== saved.id);
        return [{ ...saved, status: submitNow ? "submitted" : saved.status }, ...withoutCurrent];
      });
      setDialogOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Không thể lưu giải trình.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_42%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--card))_100%)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
          {loading ? loadingCards() : null}

          {!loading && (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-primary/15 bg-primary/10 text-primary hover:bg-primary/10">
                    {tr(language, "Giải trình", "Appeals")}
                  </Badge>
                  <Badge variant="outline" className="border-border/70 bg-background/80 text-muted-foreground">
                    {tr(language, "Yêu cầu xem xét lại", "Request for Reconsideration")}
                  </Badge>
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{tr(language, "Giải trình và bổ sung minh chứng", "Appeals and Additional Evidence")}</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    {tr(language, "Việc gửi giải trình không tự động thay đổi điểm. Quyết định cuối cùng thuộc về giảng viên.", "Submitting an appeal does not automatically change the grade. The final decision rests with the instructor.")} 
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button className="rounded-2xl" onClick={openCreateDialog}>
                    <ClipboardPenLine className="mr-2 h-4 w-4" />
                    {tr(language, "Gửi giải trình", "Submit Appeal")}
                  </Button>
                  <Button variant="outline" className="rounded-2xl" onClick={() => navigate("/student/my-contribution")}>
                    {tr(language, "Xem điểm đóng góp", "View My Contributions")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && error ? (
            <Alert className="rounded-3xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{tr(language, "Không thể tải giải trình", "Failed to load appeals")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {!loading && items.length === 0 ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="flex min-h-[280px] flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                <ShieldAlert className="h-10 w-10 text-muted-foreground" />
                <p>{tr(language, "Bạn chưa gửi giải trình nào.", "You have not submitted any appeals.")}</p>
              </CardContent>
            </Card>
          ) : null}

          {!loading && items.length > 0 ? (
            <div className="space-y-4">
              {items.map(item => (
                <Card key={item.id} className="rounded-3xl border-0 shadow-card">
                  <CardContent className="space-y-4 p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className={cn("border", appealStatusMeta[item.status].className)}>
                            {appealStatusMeta[item.status].label}
                          </Badge>
                          <Badge variant="outline" className="border-border/70 bg-background/80 text-muted-foreground">
                            {appealTypeMeta[item.appealType]}
                          </Badge>
                        </div>
                        <p className="text-sm leading-7">{item.explanationContent}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.status === "draft" ? (
                          <Button variant="outline" className="rounded-2xl" onClick={() => openEditDialog(item)}>
                            <PencilLine className="mr-2 h-4 w-4" />
                            Chỉnh sửa
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Task liên quan</p>
                        <p className="mt-2 text-sm font-medium">
                          {tasks.find(task => task.id === item.relatedTaskId)?.name || "Không liên kết"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Feedback liên quan</p>
                        <p className="mt-2 text-sm font-medium">
                          {feedbackOptions.find(option => option.id === item.relatedFeedbackId)?.senderName || "Không liên kết"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Updated at</p>
                        <p className="mt-2 text-sm font-medium">{dateFormatter.format(new Date(item.updatedAt))}</p>
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Attachments</p>
                        <p className="mt-2 text-sm font-medium">{item.attachments.length} file</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onOpenChange={open => {
          setDialogOpen(open);
          if (!open) {
            setEditingItem(null);
            setForm(defaultFormState);
            setAttachments([]);
            setFieldErrors({});
            setError("");
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? tr(language, "Chỉnh sửa giải trình", "Edit Appeal") : tr(language, "Tạo giải trình mới", "Create New Appeal")}</DialogTitle>
            <DialogDescription>
              {tr(language, "Trình bày rõ vấn đề, phần đóng góp của bạn và bằng chứng liên quan. Giải trình là yêu cầu xem xét lại, không tự thay đổi điểm.", "Clearly state the issue, your contribution, and relevant evidence. An appeal is a request for reconsideration, not an automatic grade change.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{tr(language, "Loại giải trình", "Appeal Type")}</Label>
                <Select value={form.appealType} onValueChange={value => handleFieldChange("appealType", value as StudentAppealType)}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(appealTypeMeta).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.appealType ? <p className="text-sm text-destructive">{fieldErrors.appealType}</p> : null}
              </div>

              <div className="space-y-2">
                <Label>Task liên quan</Label>
                <Select value={form.relatedTaskId} onValueChange={value => handleFieldChange("relatedTaskId", value)}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không liên kết task</SelectItem>
                    {tasks.map(task => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Feedback liên quan</Label>
                <Select value={form.relatedFeedbackId} onValueChange={value => handleFieldChange("relatedFeedbackId", value)}>
                  <SelectTrigger className="rounded-2xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Không liên kết feedback</SelectItem>
                    {feedbackOptions.map(item => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.senderName} - {item.content.slice(0, 40)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="related-milestone">Milestone liên quan</Label>
                <Input
                  id="related-milestone"
                  value={form.relatedMilestone}
                  onChange={event => handleFieldChange("relatedMilestone", event.target.value)}
                  placeholder="Ví dụ: Milestone 1"
                  className="rounded-2xl"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="appeal-content">Nội dung giải trình</Label>
              <Textarea
                id="appeal-content"
                value={form.explanationContent}
                onChange={event => handleFieldChange("explanationContent", event.target.value)}
                placeholder="Hãy trình bày rõ vấn đề, phần đóng góp của bạn và bằng chứng liên quan..."
                className="min-h-[160px] rounded-2xl"
              />
              {fieldErrors.explanationContent ? <p className="text-sm text-destructive">{fieldErrors.explanationContent}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="appeal-links">Evidence links</Label>
              <Textarea
                id="appeal-links"
                value={form.evidenceLinksText}
                onChange={event => handleFieldChange("evidenceLinksText", event.target.value)}
                placeholder="Mỗi dòng một URL minh chứng"
                className="min-h-[120px] rounded-2xl"
              />
              {fieldErrors.links ? <p className="text-sm text-destructive">{fieldErrors.links}</p> : null}
            </div>

            <div className="space-y-3 rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">File đính kèm</p>
                  <p className="text-xs text-muted-foreground">PDF, DOCX, PNG, JPG, ZIP. Tối đa 5 file, 10MB mỗi file.</p>
                </div>
                <Label htmlFor="appeal-attachment" className="inline-flex cursor-pointer items-center rounded-2xl border border-input bg-background px-4 py-2 text-sm font-medium">
                  <FileUp className="mr-2 h-4 w-4" />
                  Tải file
                </Label>
              </div>
              <Input id="appeal-attachment" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,.zip" className="hidden" onChange={event => void handleAttachmentChange(event)} />
              {attachments.length ? (
                <div className="space-y-2">
                  {attachments.map(attachment => (
                    <div key={`${attachment.fileName}-${attachment.uploadedAt}`} className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-sm">
                      <span>{attachment.fileName}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setAttachments(current => current.filter(item => item.uploadedAt !== attachment.uploadedAt))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Chưa có file đính kèm.</p>
              )}
              {fieldErrors.attachments ? <p className="text-sm text-destructive">{fieldErrors.attachments}</p> : null}
            </div>

            <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="appeal-confirm"
                  checked={form.confirmationChecked}
                  onCheckedChange={checked => handleFieldChange("confirmationChecked", Boolean(checked))}
                />
                <div className="space-y-1">
                  <Label htmlFor="appeal-confirm" className="cursor-pointer text-sm font-medium">
                    Tôi xác nhận nội dung giải trình là đúng sự thật.
                  </Label>
                  <p className="text-xs text-muted-foreground">Bắt buộc khi gửi chính thức.</p>
                </div>
              </div>
              {fieldErrors.confirmationChecked ? <p className="mt-2 text-sm text-destructive">{fieldErrors.confirmationChecked}</p> : null}
            </div>

            {error ? (
              <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Không thể lưu giải trình</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" className="rounded-2xl" onClick={() => setDialogOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" className="rounded-2xl" onClick={() => void handleSave(false)} disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu bản nháp"}
              </Button>
              <Button className="rounded-2xl" onClick={() => void handleSave(true)} disabled={saving}>
                {saving ?  "Đang gửi..." : "Gửi giải trình"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentAppeals;
