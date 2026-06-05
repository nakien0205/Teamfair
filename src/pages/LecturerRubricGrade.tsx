import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam } from "@/context/TeamContext";
import { tr } from "@/lib/i18n";
import { canAccessRubricProject } from "@/lib/rubricProjectAccess";
import {
  fetchRubricGrade,
  fetchRubricWithTemplate,
  insertRubricAuditLog,
  reopenRubricGrade,
  saveRubricGrade,
  type RubricDbRow,
  type RubricTemplateDbRow,
} from "@/lib/rubricPersistence";
import {
  normalizeRubricGradeStatus,
  parseStoredRubricTemplate,
  validateRubricGradeTable,
  type RubricGradeStatus,
} from "@/lib/rubricModel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  FolderOpen,
  Loader2,
  Maximize2,
  Minimize2,
  Save,
  Unlock,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LecturerGradingEvidenceView } from "@/components/rubrics/LecturerGradingEvidenceView";

type GradeRow = Record<string, string>;
type SelectedCellsState = Record<string, { selectedRatingColumn: string }>;

const LecturerRubricGrade = () => {
  const { projectId, groupId, rubricId } = useParams<{ projectId: string; groupId: string; rubricId: string }>();
  const { groups, loadPersistedState } = useTeam();
  const { profile, user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const group = useMemo(() => groups.find((item) => item.id === groupId), [groupId, groups]);
  const lecturerDisplayName = profile?.full_name || user?.email || (user?.id ? `${user.id.slice(0, 8)}...` : "Lecturer");
  const currentRole =
    profile?.role ||
    ((user?.user_metadata?.app_role ||
      user?.app_metadata?.role ||
      user?.user_metadata?.role) as "student" | "lecturer" | "admin" | undefined);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rubric, setRubric] = useState<RubricDbRow | null>(null);
  const [template, setTemplate] = useState<RubricTemplateDbRow | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<GradeRow[]>([]);
  const [ratingColumnKeys, setRatingColumnKeys] = useState<string[]>([]);
  const [criteriaColumnKey, setCriteriaColumnKey] = useState<string | null>(null);
  const [maxScoreColumnKey, setMaxScoreColumnKey] = useState<string | null>(null);
  const [scoreColumnLabel, setScoreColumnLabel] = useState("Điểm chấm");
  const [commentColumnLabel, setCommentColumnLabel] = useState("Nhận xét");
  const [selectedCells, setSelectedCells] = useState<SelectedCellsState>({});
  const [overallFeedback, setOverallFeedback] = useState("");
  const [status, setStatus] = useState<RubricGradeStatus>("draft");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [lockedAt, setLockedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      if (!rubricId || !groupId) return;

      if (!canAccessRubricProject(projectId, groups, user?.id, currentRole)) {
        toast({
          title: tr(language, "Không có quyền truy cập", "Access denied"),
          description: "Bạn không có quyền chấm điểm cho dự án này.",
          variant: "destructive",
        });
        navigate("/lecturer/rubrics?tab=grading", { replace: true });
        return;
      }

      try {
        setLoading(true);
        const [{ rubric: rubricRow, template: templateRow }, existingGrade] = await Promise.all([
          fetchRubricWithTemplate(rubricId),
          fetchRubricGrade(groupId, rubricId),
        ]);

        const parsedTemplate = parseStoredRubricTemplate(
          templateRow.table_json,
          templateRow.columns_json,
          templateRow.settings_json,
        );

        setRubric(rubricRow);
        setTemplate(templateRow);
        setHeaders(parsedTemplate.headers);
        setCriteriaColumnKey(parsedTemplate.settings.criteriaColumnKey);
        setMaxScoreColumnKey(parsedTemplate.settings.maxScoreColumnKey);
        setRatingColumnKeys(parsedTemplate.settings.ratingColumnKeys);
        setScoreColumnLabel(parsedTemplate.settings.scoreColumnLabel);
        setCommentColumnLabel(parsedTemplate.settings.commentColumnLabel);

        if (existingGrade) {
          const gradeRows = Array.isArray(existingGrade.grade_table_json)
            ? (existingGrade.grade_table_json as unknown[]).map((row) => {
                const raw = row as Record<string, unknown>;
                const nextRow: GradeRow = {};
                [...parsedTemplate.headers, "score", "comment"].forEach((key) => {
                  nextRow[key] = raw[key] === null || raw[key] === undefined ? "" : String(raw[key]);
                });
                return nextRow;
              })
            : [];

          setRows(gradeRows);
          const cells = (existingGrade.selected_cells_json as any) || {};
          setOverallFeedback(cells.__overall_feedback || "");
          const cleanCells = { ...cells };
          delete cleanCells.__overall_feedback;
          setSelectedCells(cleanCells);
          setStatus(normalizeRubricGradeStatus(existingGrade.status));
          setSubmittedAt(existingGrade.submitted_at);
          setLockedAt(existingGrade.locked_at);
        } else {
          setRows(
            parsedTemplate.rows.map((row) => {
              const nextRow: GradeRow = {};
              parsedTemplate.headers.forEach((header) => {
                nextRow[header] = row[header] || "";
              });
              nextRow.score = "";
              nextRow.comment = "";
              return nextRow;
            }),
          );
          setSelectedCells({});
          setOverallFeedback("");
          setStatus("draft");
          setSubmittedAt(null);
          setLockedAt(null);

          if (user?.id) {
            void insertRubricAuditLog(user.id, "START_RUBRIC_GRADE", "rubrics", rubricId, {
              group_id: groupId,
              project_id: projectId,
            });
          }
        }
      } catch (error) {
        toast({
          title: tr(language, "Không thể tải dữ liệu", "Unable to load rubric"),
          description: error instanceof Error ? error.message : String(error),
          variant: "destructive",
        });
        navigate("/lecturer/rubrics");
      } finally {
        setLoading(false);
      }
    };

    void initialize();
  }, [currentRole, groupId, groups, language, navigate, projectId, rubricId, toast, user?.id]);

  const readOnly = status === "submitted" || status === "locked";
  const displayHeaders = useMemo(() => [...headers, "score", "comment"], [headers]);

  const totalScore = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const score = Number(row.score);
        return sum + (Number.isNaN(score) ? 0 : score);
      }, 0),
    [rows],
  );

  const maxTotalScore = useMemo(() => {
    if (!maxScoreColumnKey) return 0;
    return rows.reduce((sum, row) => {
      const value = Number(row[maxScoreColumnKey]);
      return sum + (Number.isNaN(value) ? 0 : value);
    }, 0);
  }, [maxScoreColumnKey, rows]);

  const scaledScore = useMemo(() => {
    if (!maxTotalScore) return null;
    return Math.round(((totalScore / maxTotalScore) * 10) * 10) / 10;
  }, [maxTotalScore, totalScore]);

  const validate = (requireScores: boolean) => {
    const result = validateRubricGradeTable({ rows, maxScoreColumnKey, requireScores });
    setErrors(
      result.errors.reduce<Record<number, string>>((accumulator, error) => {
        accumulator[error.rowIndex] = error.message;
        return accumulator;
      }, {}),
    );
    return result;
  };

  const updateRowValue = (rowIndex: number, key: string, value: string) => {
    if (readOnly) return;

    setRows((current) => current.map((row, index) => (index === rowIndex ? { ...row, [key]: value } : row)));

    if (key === "score" && maxScoreColumnKey) {
      const maxScore = Number(rows[rowIndex][maxScoreColumnKey]);
      const inputScore = Number(value);
      
      if (!Number.isNaN(maxScore) && !Number.isNaN(inputScore) && inputScore > maxScore) {
        setErrors((current) => ({
          ...current,
          [rowIndex]: "ERROR_HIDDEN",
        }));
        return;
      }
    }

    if (errors[rowIndex]) {
      setErrors((current) => {
        const next = { ...current };
        delete next[rowIndex];
        return next;
      });
    }
  };

  const toggleRatingCell = (rowIndex: number, ratingColumnKey: string) => {
    if (readOnly) return;

    setSelectedCells((current) => {
      const existing = current[String(rowIndex)];
      if (existing?.selectedRatingColumn === ratingColumnKey) {
        const next = { ...current };
        delete next[String(rowIndex)];
        return next;
      }

      return {
        ...current,
        [String(rowIndex)]: { selectedRatingColumn: ratingColumnKey },
      };
    });
  };

  const persistGrade = async (nextStatus: RubricGradeStatus) => {
    if (!rubricId || !groupId || !projectId || !user?.id) return;

    const validation = validate(nextStatus === "submitted");
    if (!validation.isValid) {
      toast({
        title: tr(language, "Bảng điểm chưa hợp lệ", "Grade sheet is invalid"),
        description: validation.errors[0]?.message || tr(language, "Vui lòng kiểm tra lại điểm từng tiêu chí.", "Please review each row."),
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      await saveRubricGrade(
        rubricId,
        groupId,
        projectId,
        user.id,
        rows as unknown as { [key: string]: string }[],
        { ...selectedCells, __overall_feedback: overallFeedback },
        totalScore,
        maxTotalScore,
        nextStatus,
      );

      setStatus(nextStatus);
      if (nextStatus === "submitted") {
        setSubmittedAt(new Date().toISOString());
        await loadPersistedState();
      }

      toast({
        title: nextStatus === "submitted" ? tr(language, "Đã gửi điểm", "Grade submitted") : tr(language, "Đã lưu bản nháp", "Draft saved"),
        description:
          nextStatus === "submitted"
            ? tr(language, "Bảng chấm điểm đã được gửi và chuyển sang chế độ chỉ xem.", "The grade sheet has been submitted and is now read-only.")
            : tr(language, "Tiến trình chấm điểm đã được lưu.", "Your grading progress has been saved."),
      });
    } catch (error) {
      toast({
        title: tr(language, "Không thể lưu bảng điểm", "Unable to save grade sheet"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = async () => {
    if (!user?.id || !rubricId) return;

    try {
      setSaving(true);
      const existingGrade = await fetchRubricGrade(groupId || "", rubricId);
      if (!existingGrade) {
        throw new Error("Không tìm thấy bản ghi chấm điểm để mở lại.");
      }

      await reopenRubricGrade(existingGrade.id, user.id);
      setStatus("draft");
      setSubmittedAt(null);
      setLockedAt(null);
      toast({
        title: tr(language, "Đã mở lại bản chấm", "Grade sheet reopened"),
        description: tr(language, "Bạn có thể tiếp tục chỉnh sửa bản chấm điểm này.", "You can continue editing this grade sheet."),
      });
    } catch (error) {
      toast({
        title: tr(language, "Không thể mở lại bản chấm", "Unable to reopen grade"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-80px)] flex-col items-center justify-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        <p className="text-sm text-slate-500">{tr(language, "Đang tải rubric và dữ liệu chấm điểm...", "Loading rubric and grade data...")}</p>
      </div>
    );
  }

  const evidenceContent = <LecturerGradingEvidenceView groupId={groupId || ""} />;

  const gradingContent = (
    <div className="flex h-full flex-col gap-6">
      <Card className="flex flex-1 flex-col space-y-4 rounded-3xl border-slate-200 p-4 sm:p-6 shadow-sm min-h-0">
        <div className="flex items-center justify-between gap-3 shrink-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <ClipboardCheck className="h-4 w-4 text-indigo-600" />
            {tr(language, "Bảng chấm điểm chi tiết", "Detailed grading sheet")}
          </h2>
        </div>

        {!maxScoreColumnKey ? (
          <div className="shrink-0 flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {tr(
                language,
                "Rubric này chưa có cột điểm tối đa, hệ thống sẽ không kiểm tra giới hạn điểm cho từng tiêu chí.",
                "This rubric has no max score column, so the system will not validate score limits per criterion.",
              )}
            </span>
          </div>
        ) : null}

        {readOnly ? (
          <div className="shrink-0 flex items-start gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span>
              {status === "locked"
                ? tr(language, "Bảng chấm điểm này đã khóa hoàn toàn và chỉ còn chế độ xem.", "This grade sheet is locked and can only be viewed.")
                : tr(language, "Bảng chấm điểm này đã được gửi và đang ở chế độ chỉ xem.", "This grade sheet has been submitted and is now read-only.")}
            </span>
          </div>
        ) : null}

        <div className="flex-1 overflow-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-[880px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr className="border-b border-slate-200">
                {displayHeaders.map((header) => {
                  const isCriteriaColumn = header === criteriaColumnKey;
                  const label =
                    header === "score" ? scoreColumnLabel : header === "comment" ? commentColumnLabel : header;

                  return (
                    <th
                      key={header}
                      className={`border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 last:border-r-0 ${
                        isCriteriaColumn ? "sticky left-0 z-20 bg-slate-100" : ""
                      } ${header === "comment" ? "min-w-[220px]" : "min-w-[120px]"}`}
                    >
                      {label}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`grade-row-${rowIndex}`} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                  {displayHeaders.map((header) => {
                    const isCriteriaColumn = header === criteriaColumnKey;
                    const rowError = errors[rowIndex];

                    if (header === "score" || header === "comment") {
                      return (
                        <td key={`${header}-${rowIndex}`} className="border-r border-slate-200 p-1 last:border-r-0">
                          <div className="relative">
                            <Input
                              value={row[header] || ""}
                              disabled={readOnly}
                              onChange={(event) => updateRowValue(rowIndex, header, event.target.value)}
                              placeholder={header === "score" ? "0" : tr(language, "Nhập nhận xét...", "Enter comment...")}
                              className={`rounded-lg text-xs ${rowError && header === "score" ? "border-red-400 focus-visible:ring-red-500 bg-red-50" : ""}`}
                            />
                            {rowError && rowError !== "ERROR_HIDDEN" && header === "score" ? (
                              <span className="absolute -bottom-5 left-0 rounded border border-red-200 bg-white px-1 text-[10px] text-red-500">
                                {rowError}
                              </span>
                            ) : null}
                          </div>
                        </td>
                      );
                    }

                    if (ratingColumnKeys.includes(header)) {
                      const selected = selectedCells[String(rowIndex)]?.selectedRatingColumn === header;
                      return (
                        <td
                          key={`${header}-${rowIndex}`}
                          className={`cursor-pointer border-r border-slate-200 px-3 py-2 last:border-r-0 ${
                            selected ? "bg-indigo-50" : "hover:bg-slate-50"
                          }`}
                          onClick={() => toggleRatingCell(rowIndex, header)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className={`text-xs ${selected ? "font-medium text-indigo-700" : "text-slate-600"}`}>{row[header]}</span>
                            <div
                              className={`flex h-4 w-4 items-center justify-center rounded-full border ${
                                selected ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-300 bg-white text-transparent"
                              }`}
                            >
                              <Check className="h-3 w-3" strokeWidth={3} />
                            </div>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td
                        key={`${header}-${rowIndex}`}
                        className={`border-r border-slate-200 px-3 py-2 text-slate-700 last:border-r-0 ${isCriteriaColumn ? "sticky left-0 z-10 bg-white font-medium" : ""}`}
                      >
                        {row[header]}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="shrink-0 mt-4 space-y-2">
          <label className="text-sm font-semibold text-slate-900">{tr(language, "Nhận xét chung cho nhóm", "Overall group feedback")}</label>
          <Textarea
            value={overallFeedback}
            disabled={readOnly}
            onChange={(e) => setOverallFeedback(e.target.value)}
            placeholder={tr(language, "Nhập nhận xét chung...", "Enter overall feedback...")}
            className="rounded-xl min-h-[80px]"
          />
        </div>

        <p className="shrink-0 text-xs text-slate-500 mt-2">
          {tr(language, "Mỗi tiêu chí chỉ chọn một mức đánh giá. Điểm chấm và nhận xét được lưu riêng cho từng dòng.", "Each criterion can have only one selected rating. Scores and comments are stored per row.")}
        </p>
      </Card>
    </div>
  );

  return (
    <div className={`flex flex-col bg-slate-50 overflow-hidden ${isFullScreen ? "fixed inset-0 z-[100]" : "h-[calc(100vh-64px)]"}`}>
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 z-20 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/lecturer/grading")}
            className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{tr(language, "Quay lại danh sách chấm điểm", "Back to grading")}</span>
          </Button>
          <div className="hidden md:flex flex-col">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="truncate max-w-[150px]" title={group?.name || projectId}>{group?.name || projectId}</span>
              <span className="text-slate-300">/</span>
              <span className="truncate max-w-[200px]" title={rubric?.name}>{rubric?.name}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${status === "submitted" ? "bg-emerald-500" : status === "locked" ? "bg-slate-500" : "bg-amber-500"}`}></span>
                {status === "submitted" ? "Đã gửi" : status === "locked" ? "Đã khóa" : "Bản nháp"}
              </span>
              <span>•</span>
              <span className="font-medium text-slate-700">Tổng điểm: {totalScore.toFixed(1)} / {maxTotalScore.toFixed(1)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => setIsFullScreen(!isFullScreen)} 
            className="rounded-xl hidden lg:flex border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          >
            {isFullScreen ? (
              <><Minimize2 className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">{tr(language, "Thu nhỏ", "Exit Full Screen")}</span></>
            ) : (
              <><Maximize2 className="h-4 w-4 sm:mr-2" /> <span className="hidden sm:inline">{tr(language, "Toàn màn hình", "Full Screen")}</span></>
            )}
          </Button>
          
          {status === "submitted" ? (
            <Button
              variant="outline"
              onClick={() => void handleReopen()}
              disabled={saving}
              className="rounded-xl border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
            >
              <Unlock className="mr-2 h-4 w-4" />
              {tr(language, "Mở lại để chỉnh sửa", "Reopen for editing")}
            </Button>
          ) : status === "locked" ? null : (
            <>
              <Button variant="outline" onClick={() => void persistGrade("draft")} disabled={saving} className="rounded-xl">
                <Save className="mr-2 h-4 w-4" />
                {tr(language, "Lưu bản nháp", "Save draft")}
              </Button>
              <Button onClick={() => setShowSubmitDialog(true)} disabled={saving} className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500">
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {tr(language, "Gửi điểm", "Submit grade")}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="hidden lg:flex flex-1 min-h-0">
        <div className="w-[45%] border-r border-slate-200 p-4 h-full">
          {evidenceContent}
        </div>
        <div className="w-[55%] p-4 h-full overflow-y-auto">
          {gradingContent}
        </div>
      </div>

      <div className="flex lg:hidden flex-1 min-h-0 flex-col bg-slate-50">
        <Tabs defaultValue="grading" className="flex flex-1 flex-col h-full">
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="evidence">{tr(language, "Dữ liệu sinh viên nộp", "Submitted Data")}</TabsTrigger>
              <TabsTrigger value="grading">{tr(language, "Chấm điểm", "Grading")}</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="evidence" className="flex-1 overflow-y-auto p-4 m-0 data-[state=active]:flex">
            {evidenceContent}
          </TabsContent>
          <TabsContent value="grading" className="flex-1 overflow-y-auto p-4 m-0 data-[state=active]:block">
            {gradingContent}
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{tr(language, "Xác nhận gửi điểm", "Confirm grade submission")}</DialogTitle>
            <DialogDescription>
              {tr(
                language,
                "Sau khi gửi, bảng chấm điểm sẽ chuyển sang chế độ chỉ xem. Sinh viên chỉ có thể xem khi hệ thống cho phép.",
                "Once submitted, the grade sheet becomes read-only. Students can only view it if the product allows that state.",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowSubmitDialog(false)}>
              {tr(language, "Hủy", "Cancel")}
            </Button>
            <Button
              onClick={() => void persistGrade("submitted")}
              disabled={saving}
              className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {tr(language, "Xác nhận & Gửi", "Confirm & Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LecturerRubricGrade;
