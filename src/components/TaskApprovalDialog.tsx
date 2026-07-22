import { useState, useEffect } from "react";
import { useTeam, Task } from "@/context/TeamContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { tr } from "@/lib/i18n";
import { listStudentWorkLogs, type WorkLogRecord } from "@/lib/workLogs";
import { createSignedFileUrl } from "@/lib/storage";
import { fetchTaskVerification, type TaskVerificationResult } from "@/lib/contributionAi";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Clock,
  User,
  Download,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  XCircle,
  FileCheck,
  Calendar,
  Percent,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onApprove: (task: Task) => void;
  onNeedRevision: (task: Task, feedback: string) => void;
}

export default function TaskApprovalDialog({
  open,
  onOpenChange,
  task,
  onApprove,
  onNeedRevision,
}: Props) {
  const { members, groups, currentGroupIndex } = useTeam();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [workLogs, setWorkLogs] = useState<WorkLogRecord[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  // AI Verification State
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<TaskVerificationResult | null>(null);

  // Revision state
  const [showRevisionForm, setShowRevisionForm] = useState(false);
  const [revisionNote, setRevisionNote] = useState("");

  const currentGroup = groups[currentGroupIndex];

  // Resolve assignee ID
  const assignee = task
    ? members.find((m) => m.name === task.assignedTo)
    : null;
  const assigneeId = assignee?.id;
  const groupId = currentGroup?.id;

  // Load work logs when dialog opens
  useEffect(() => {
    if (open && task && assigneeId && groupId) {
      setLoadingLogs(true);
      setAiResult(null);
      setShowRevisionForm(false);
      setRevisionNote("");
      listStudentWorkLogs(assigneeId, groupId)
        .then((logs) => {
          const filtered = logs.filter((log) => log.taskId === task.id);
          setWorkLogs(filtered);
        })
        .catch((err) => {
          console.error("Failed to load work logs:", err);
        })
        .finally(() => {
          setLoadingLogs(false);
        });
    }
  }, [open, task, assigneeId, groupId]);

  if (!task) return null;

  const handleDownload = async (fileName: string, storagePath: string) => {
    setDownloadingFile(storagePath);
    try {
      const signedUrl = await createSignedFileUrl("evidence", storagePath);
      window.open(signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      toast({
        title: tr(language, "Lỗi", "Error"),
        description: tr(
          language,
          "Không thể tải file",
          "Could not download file"
        ),
        variant: "destructive",
      });
    } finally {
      setDownloadingFile(null);
    }
  };

  const handleAiVerify = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      // 1. Generate signed urls for all evidence files
      const evidenceFilesWithUrls = [];
      if (task.evidence && task.evidence.length > 0) {
        for (const ev of task.evidence) {
          if (ev.storagePath) {
            const url = await createSignedFileUrl("evidence", ev.storagePath);
            evidenceFilesWithUrls.push({
              fileName: ev.fileName,
              signedUrl: url,
            });
          }
        }
      }

      // 2. Call backend
      const payload = {
        task_id: task.id,
        task_name: task.name,
        task_description: task.description || "",
        student_name: task.assignedTo,
        work_logs: workLogs.map((log) => ({
          date: log.workDate,
          hours: log.timeSpentHours,
          description: log.description,
        })),
        evidence_files: evidenceFilesWithUrls,
      };

      const result = await fetchTaskVerification(payload);
      if (result) {
        setAiResult(result);
        toast({
          title: tr(language, "Xác minh hoàn tất", "Verification complete"),
          description: tr(
            language,
            "AI đã hoàn thành phân tích bằng chứng.",
            "AI has finished analyzing evidence."
          ),
        });
      } else {
        throw new Error("No response from AI server");
      }
    } catch (err) {
      toast({
        title: tr(language, "Lỗi xác minh AI", "AI Verification Error"),
        description: tr(
          language,
          "Không thể liên kết với server AI. Vui lòng kiểm tra lại.",
          "Could not contact AI server. Please try again."
        ),
        variant: "destructive",
      });
    } finally {
      setAiLoading(false);
    }
  };

  const submitRevision = () => {
    if (!revisionNote.trim()) {
      toast({
        title: tr(language, "Lỗi", "Error"),
        description: tr(
          language,
          "Vui lòng nhập lý do yêu cầu sửa đổi.",
          "Please enter a reason for revision."
        ),
        variant: "destructive",
      });
      return;
    }
    onNeedRevision(task, revisionNote.trim());
    onOpenChange(false);
  };

  const priorityColor = (priority?: string) => {
    if (priority === "High") return "bg-red-50 text-red-700 border-red-200";
    if (priority === "Medium") return "bg-amber-50 text-amber-700 border-amber-200";
    return "bg-slate-50 text-slate-700 border-slate-200";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[22px] border border-white/60 bg-white/90 shadow-[0_20px_50px_rgba(15,23,42,0.15)] backdrop-blur-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-indigo-600" />
            {tr(language, "Chi tiết và Duyệt Task", "Task Details & Approval")}
          </DialogTitle>
          <DialogDescription>
            {tr(
              language,
              "Review tài liệu bằng chứng, nhật ký đóng đóng góp và sử dụng trợ lý AI xác minh trước khi duyệt.",
              "Review evidence, work logs, and use AI assistant to verify before approval."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3 text-slate-700 text-sm">
          {/* Section 1: Task Core Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/50 border border-slate-100 rounded-2xl p-4">
            <div className="space-y-2 col-span-1 sm:col-span-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {tr(language, "Tên nhiệm vụ", "Task name")}
              </span>
              <div className="font-semibold text-base text-slate-900">{task.name}</div>
              {task.description && (
                <p className="text-slate-500 text-xs mt-1 bg-slate-50/50 p-2 rounded-lg border border-slate-100">
                  {task.description}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                {tr(language, "Thực hiện bởi", "Assigned To")}
              </span>
              <div className="font-medium text-slate-800">{task.assignedTo}</div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {tr(language, "Hạn chót", "Deadline")}
              </span>
              <div className="font-medium text-slate-800">
                {task.deadline || tr(language, "Chưa đặt hạn", "No deadline")}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Percent className="h-3.5 w-3.5" />
                {tr(language, "Đóng góp", "Contribution Weight")}
              </span>
              <div className="font-medium text-slate-800">
                {task.contributionPercent}%
              </div>
            </div>

            {task.priority && (
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {tr(language, "Độ ưu tiên", "Priority")}
                </span>
                <div>
                  <Badge variant="outline" className={`${priorityColor(task.priority)}`}>
                    {task.priority}
                  </Badge>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Evidence Files */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-slate-500" />
              {tr(language, "Tài liệu Bằng chứng", "Evidence Documents")}
            </h3>
            {!task.evidence || task.evidence.length === 0 ? (
              <p className="text-slate-400 text-xs italic bg-slate-50/30 p-3 rounded-xl border border-dashed border-slate-200">
                {tr(
                  language,
                  "Chưa có tài liệu bằng chứng nào được tải lên.",
                  "No evidence files uploaded yet."
                )}
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {task.evidence.map((ev) => (
                  <div
                    key={`${ev.fileName}-${ev.uploadTime}`}
                    className="flex items-center justify-between border border-slate-200 bg-white/70 hover:bg-white p-3 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-indigo-500 shrink-0" />
                      <span className="truncate text-xs font-medium text-slate-700">
                        {ev.fileName}
                      </span>
                    </div>
                    {ev.storagePath && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1 hover:text-indigo-600"
                        disabled={downloadingFile === ev.storagePath}
                        onClick={() => handleDownload(ev.fileName, ev.storagePath)}
                      >
                        {downloadingFile === ev.storagePath ? (
                          <RefreshCw className="h-3 w-3 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        {tr(language, "Tải về", "Download")}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 3: Work logs */}
          <div className="space-y-2">
            <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-slate-500" />
              {tr(language, "Nhật ký làm việc liên quan", "Related Work Logs")}
            </h3>
            {loadingLogs ? (
              <p className="text-slate-400 text-xs animate-pulse">
                {tr(language, "Đang tải nhật ký...", "Loading logs...")}
              </p>
            ) : workLogs.length === 0 ? (
              <p className="text-slate-400 text-xs italic bg-slate-50/30 p-3 rounded-xl border border-dashed border-slate-200">
                {tr(
                  language,
                  "Chưa ghi nhận nhật ký làm việc nào khớp với task này.",
                  "No work logs linked to this task."
                )}
              </p>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {workLogs.map((log) => (
                  <div
                    key={log.id}
                    className="border border-slate-100 bg-slate-50/40 p-2.5 rounded-xl text-xs space-y-1"
                  >
                    <div className="flex justify-between text-slate-500 font-medium">
                      <span>{log.workDate}</span>
                      <span className="text-indigo-600 font-semibold">
                        {log.timeSpentHours} hrs
                      </span>
                    </div>
                    <p className="text-slate-700 leading-relaxed">{log.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 4: AI Verification Result */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                {tr(language, "Xác minh bằng AI", "AI Verification")}
              </h3>
              <Button
                size="sm"
                className="rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 gap-1.5 text-xs font-semibold"
                disabled={aiLoading}
                onClick={handleAiVerify}
              >
                {aiLoading ? (
                  <>
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    {tr(language, "Đang xác minh...", "Verifying...")}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3 w-3 text-indigo-500 fill-indigo-500 animate-pulse" />
                    {tr(language, "Xác minh", "Verify with AI")}
                  </>
                )}
              </Button>
            </div>

            {aiLoading && (
              <div className="border border-indigo-100 bg-indigo-50/20 rounded-2xl p-4 animate-pulse flex flex-col gap-3">
                <div className="h-4 bg-indigo-200/50 rounded w-1/3"></div>
                <div className="h-3 bg-indigo-200/30 rounded w-full"></div>
                <div className="h-3 bg-indigo-200/30 rounded w-5/6"></div>
              </div>
            )}

            {!aiLoading && aiResult && (
              <div
                className={`border rounded-2xl p-4 space-y-3 ${
                  aiResult.status === "verified"
                    ? "bg-emerald-50/50 border-emerald-200 text-emerald-900"
                    : "bg-amber-50/50 border-amber-200 text-amber-900"
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    {aiResult.status === "verified" ? (
                      <CheckCircle className="h-5 w-5 text-emerald-600 fill-emerald-100" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-600 fill-amber-100" />
                    )}
                    <span className="font-bold text-sm">
                      {aiResult.status === "verified"
                        ? tr(
                            language,
                            "AI KHUYÊN DUYỆT (Verified)",
                            "AI RECOMMENDS APPROVE"
                          )
                        : tr(
                            language,
                            "AI YÊU CẦU SỬA ĐỔI (Need Revision)",
                            "AI REQUESTS REVISION"
                          )}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`${
                      aiResult.status === "verified"
                        ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                        : "bg-amber-100 border-amber-300 text-amber-800"
                    }`}
                  >
                    Confidence: {aiResult.confidence_score}%
                  </Badge>
                </div>

                <div className="space-y-1">
                  <div className="font-semibold text-xs text-slate-500 uppercase tracking-wider">
                    {tr(language, "Phân tích của AI", "AI Analysis")}
                  </div>
                  <p className="text-xs leading-relaxed">{aiResult.reasoning}</p>
                </div>

                <div className="space-y-1 pt-1 border-t border-slate-200/50">
                  <div className="font-semibold text-xs text-slate-500 uppercase tracking-wider">
                    {tr(language, "Gợi ý phản hồi", "Suggested feedback")}
                  </div>
                  <p className="text-xs italic leading-relaxed text-slate-600">
                    "{aiResult.suggested_feedback}"
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Form revision if active */}
          {showRevisionForm && (
            <div className="space-y-2 border-t border-slate-200/50 pt-3 animate-in slide-in-from-top-3 duration-250">
              <Label className="font-semibold text-red-600 flex items-center gap-1 text-xs">
                <AlertTriangle className="h-3.5 w-3.5" />
                {tr(language, "Nhập lý do yêu cầu sửa đổi", "Reason for revision")}
              </Label>
              <Textarea
                placeholder={tr(
                  language,
                  "Nhập ghi chú chi tiết về những gì sinh viên cần hoàn thiện thêm...",
                  "Enter details of what the student needs to complete..."
                )}
                value={revisionNote}
                onChange={(e) => setRevisionNote(e.target.value)}
                className="h-20 rounded-xl border-slate-200 focus:border-red-400 focus:ring-red-400"
              />
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 border-t border-slate-100 pt-4">
          {showRevisionForm ? (
            <>
              <Button
                variant="destructive"
                className="rounded-xl flex-1 bg-red-600 hover:bg-red-700"
                onClick={submitRevision}
              >
                <XCircle className="h-4 w-4 mr-1" />
                {tr(language, "Gửi Yêu Cầu Sửa Đổi", "Submit Revision Request")}
              </Button>
              <Button
                variant="outline"
                className="rounded-xl flex-1 border-slate-200"
                onClick={() => setShowRevisionForm(false)}
              >
                {tr(language, "Hủy", "Cancel")}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                className="rounded-xl border-slate-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-200 sm:flex-1"
                onClick={() => setShowRevisionForm(true)}
              >
                <XCircle className="h-4 w-4 mr-1 shrink-0" />
                {tr(language, "Yêu cầu chỉnh sửa", "Need Revision")}
              </Button>
              <Button
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium sm:flex-1"
                onClick={() => {
                  onApprove(task);
                  onOpenChange(false);
                }}
              >
                <CheckCircle className="h-4 w-4 mr-1 shrink-0" />
                {tr(language, "Duyệt Task", "Approve Task")}
              </Button>
              <Button
                variant="ghost"
                className="rounded-xl border border-slate-200 sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                {tr(language, "Đóng", "Close")}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
