import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTeam } from "@/context/TeamContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  FileSpreadsheet,
  Save,
  CheckCircle2,
  ArrowLeft,
  Loader2,
  Unlock,
  AlertTriangle,
  ClipboardCheck,
  Layers
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  fetchRubricWithTemplate,
  fetchRubricGrade,
  saveRubricGrade,
  type RubricDbRow,
  type RubricTemplateDbRow
} from "@/lib/rubricPersistence";

interface GradeCellError {
  rowIndex: number;
  message: string;
}

const LecturerRubricGrade = () => {
  const { groupId, rubricId } = useParams<{ groupId: string; rubricId: string }>();
  const { groups, currentUserName, loadPersistedState } = useTeam();
  const { profile, signOut } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const activeGroup = useMemo(() => groups.find(g => g.id === groupId), [groups, groupId]);

  // Rubric & Template DB records
  const [rubric, setRubric] = useState<RubricDbRow | null>(null);
  const [template, setTemplate] = useState<RubricTemplateDbRow | null>(null);
  const [loading, setLoading] = useState(true);

  // Grade state
  const [gradeTable, setGradeTable] = useState<any[]>([]);
  const [gradeStatus, setGradeStatus] = useState<'Draft' | 'Submitted'>('Draft');
  
  // Validation Errors state
  const [errors, setErrors] = useState<GradeCellError[]>([]);

  // Dialogs
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Rubric template and existing grade
  useEffect(() => {
    const initPage = async () => {
      if (!rubricId || !groupId) return;
      try {
        setLoading(true);
        const { rubric: r, template: t } = await fetchRubricWithTemplate(rubricId);
        setRubric(r);
        setTemplate(t);

        const existingGrade = await fetchRubricGrade(groupId, rubricId);
        
        if (existingGrade) {
          setGradeTable(existingGrade.grade_table_json);
          setGradeStatus(existingGrade.status);
        } else {
          // Initialize table structure with Score and Comment columns
          const initializedTable = t.table_json.map((row: any) => ({
            ...row,
            score: "",
            comment: ""
          }));
          setGradeTable(initializedTable);
          setGradeStatus('Draft');
        }
      } catch (err) {
        toast({
          title: tr(language, "Lỗi tải dữ liệu", "Data load error"),
          description: err instanceof Error ? err.message : String(err),
          variant: "destructive"
        });
        navigate("/lecturer/rubrics");
      } finally {
        setLoading(false);
      }
    };

    void initPage();
  }, [rubricId, groupId]);

  // Headers list for display: original template columns + grading columns
  const displayHeaders = useMemo(() => {
    if (!template) return [];
    return [...template.columns_json, "score", "comment"];
  }, [template]);

  // Max score column key from template settings
  const maxScoreColumnKey = useMemo(() => {
    if (!template) return null;
    return template.settings_json?.maxScoreColumnKey || null;
  }, [template]);

  // Core business rules validation
  const validateGradeTable = (table: any[]): { isValid: boolean; cellErrors: GradeCellError[] } => {
    const cellErrors: GradeCellError[] = [];

    table.forEach((row, rowIndex) => {
      const scoreStr = String(row.score || "").trim();
      
      // If score is left empty, we treat it as 0 or require score. Let's validate only if something is entered, 
      // or validate that it must be a number if we attempt to submit.
      if (scoreStr === "") {
        return; // Empty score allowed in Draft (evaluates to 0). But when submitting, let's treat empty as 0.
      }

      const scoreNum = Number(scoreStr);

      // Rule: "Điểm chấm phải là số."
      if (isNaN(scoreNum)) {
        cellErrors.push({
          rowIndex,
          message: "Điểm chấm phải là số."
        });
        return;
      }

      // Rule: "Điểm chấm không được âm."
      if (scoreNum < 0) {
        cellErrors.push({
          rowIndex,
          message: "Điểm chấm không được âm."
        });
        return;
      }

      // Rule: "If max score column exists, score cannot exceed max score."
      if (maxScoreColumnKey && row[maxScoreColumnKey]) {
        const maxScoreVal = parseFloat(row[maxScoreColumnKey]);
        if (!isNaN(maxScoreVal) && scoreNum > maxScoreVal) {
          cellErrors.push({
            rowIndex,
            message: "Điểm chấm không được vượt quá điểm tối đa."
          });
        }
      }
    });

    return {
      isValid: cellErrors.length === 0,
      cellErrors
    };
  };

  const handleCellChange = (rowIndex: number, colName: string, val: string) => {
    if (gradeStatus === 'Submitted') return; // Read-only

    const updatedTable = gradeTable.map((row, idx) => 
      idx === rowIndex ? { ...row, [colName]: val } : row
    );
    setGradeTable(updatedTable);

    // Validate and update errors live
    const { cellErrors } = validateGradeTable(updatedTable);
    setErrors(cellErrors);
  };

  // Live total score calculations
  const totalCalculatedScore = useMemo(() => {
    return gradeTable.reduce((sum, row) => {
      const val = parseFloat(row.score);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [gradeTable]);

  const maxTotalScore = useMemo(() => {
    if (!maxScoreColumnKey) return 10; // Default out of 10 if no max score column
    return gradeTable.reduce((sum, row) => {
      const val = parseFloat(row[maxScoreColumnKey]);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);
  }, [gradeTable, maxScoreColumnKey]);

  // Operations
  const handleSaveDraft = async () => {
    if (!rubricId || !groupId || !activeGroup?.id) return;
    
    // Check validation errors before saving draft
    const { isValid, cellErrors } = validateGradeTable(gradeTable);
    setErrors(cellErrors);
    
    if (!isValid) {
      toast({
        title: tr(language, "Lỗi nhập liệu", "Input Error"),
        description: cellErrors[0].message,
        variant: "destructive"
      });
      return;
    }

    try {
      setIsSubmitting(true);
      await saveRubricGrade(
        rubricId,
        groupId,
        activeGroup.id,
        profile?.id || "",
        gradeTable,
        totalCalculatedScore,
        maxTotalScore,
        'Draft'
      );

      setGradeStatus('Draft');
      toast({
        title: tr(language, "Lưu thành công", "Save Success"),
        description: "Điểm đã được lưu nháp.",
      });
    } catch (err) {
      console.error(err);
      toast({
        title: tr(language, "Lỗi hệ thống", "System Error"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenSubmitConfirm = () => {
    const { isValid, cellErrors } = validateGradeTable(gradeTable);
    setErrors(cellErrors);

    if (!isValid) {
      toast({
        title: tr(language, "Lỗi nhập liệu", "Input Error"),
        description: cellErrors[0].message,
        variant: "destructive"
      });
      return;
    }

    setIsSubmitConfirmOpen(true);
  };

  const handleFinalSubmit = async () => {
    if (!rubricId || !groupId || !activeGroup?.id) return;
    setIsSubmitConfirmOpen(false);

    try {
      setIsSubmitting(true);
      await saveRubricGrade(
        rubricId,
        groupId,
        activeGroup.id,
        profile?.id || "",
        gradeTable,
        totalCalculatedScore,
        maxTotalScore,
        'Submitted'
      );

      setGradeStatus('Submitted');
      toast({
        title: tr(language, "Gửi thành công", "Submit Success"),
        description: "Điểm đã được gửi thành công.",
      });

      // Reload team context to reflect cascade lecturer score updates
      await loadPersistedState();
    } catch (err) {
      console.error(err);
      toast({
        title: tr(language, "Lỗi hệ thống", "System Error"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopenGrading = async () => {
    if (!confirm(tr(language, "Bạn có chắc chắn muốn mở khóa chấm lại không? Trạng thái sẽ quay lại Bản nháp.", "Are you sure you want to unlock grading? The status will revert to Draft."))) {
      return;
    }
    if (!rubricId || !groupId || !activeGroup?.id) return;

    try {
      setIsSubmitting(true);
      await saveRubricGrade(
        rubricId,
        groupId,
        activeGroup.id,
        profile?.id || "",
        gradeTable,
        totalCalculatedScore,
        maxTotalScore,
        'Draft'
      );

      setGradeStatus('Draft');
      toast({
        title: tr(language, "Đã mở khóa", "Grading Unlocked"),
        description: tr(language, "Bạn hiện có thể tiếp tục chấm điểm.", "You can now resume grading."),
      });
    } catch (err) {
      console.error(err);
      toast({
        title: tr(language, "Lỗi mở khóa", "Unlock Error"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardShell
      sidebar={
        <DashboardSidebar
          title={tr(language, "Giảng viên", "Lecturer")}
          subtitle={currentUserName}
          items={[
            { key: 'overview', label: tr(language, 'Tổng quan', 'Overview'), icon: <Layers /> },
            { key: 'rubrics', label: tr(language, 'Thang chấm điểm', 'Rubric'), icon: <FileSpreadsheet /> },
          ]}
          activeKey="rubrics"
          onSelect={(key) => {
            if (key === 'overview') {
              navigate('/dashboard-lecturer');
            } else if (key === 'rubrics') {
              navigate('/lecturer/rubrics');
            }
          }}
        />
      }
      header={
        <DashboardHeader
          roleLabel={tr(language, "Giảng viên", "Lecturer")}
          onExit={() => {
            void signOut();
            navigate("/login");
          }}
          leftSlot={<SidebarTrigger />}
          showRoleSelect={false}
        />
      }
    >
      <div className="container mx-auto px-6 py-6 max-w-6xl space-y-6">
        
        {/* Navigation block */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/lecturer/rubrics")}
            className="text-slate-400 hover:text-white flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {tr(language, "Quay lại danh sách", "Back to Rubrics List")}
          </Button>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {gradeStatus === 'Submitted' ? (
              <Button
                onClick={handleReopenGrading}
                disabled={isSubmitting}
                className="bg-amber-600/20 hover:bg-amber-600 text-amber-300 border border-amber-500/30 rounded-xl flex items-center gap-2"
              >
                <Unlock className="h-4 w-4" />
                {tr(language, "Mở khóa chấm lại", "Reopen Grading")}
              </Button>
            ) : (
              <>
                <Button
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                  variant="outline"
                  className="border-slate-800 hover:bg-slate-800 text-slate-200 rounded-xl flex items-center gap-2"
                >
                  <Save className="h-4 w-4" />
                  {tr(language, "Lưu Nháp", "Save Draft")}
                </Button>
                <Button
                  onClick={handleOpenSubmitConfirm}
                  disabled={isSubmitting}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {tr(language, "Gửi Điểm", "Submit Grade")}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Loading overlay state */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            <p className="text-slate-400 text-sm font-medium animate-pulse">
              {tr(language, "Đang tải cấu trúc rubric & kết quả chấm...", "Loading rubric and grades...")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
            
            {/* Info details card */}
            <Card className="lg:col-span-1 bg-slate-900/60 border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                  {tr(language, "Thông tin chấm điểm", "Grading Details")}
                </span>
                <h2 className="font-display text-xl font-extrabold text-white mt-1 line-clamp-2">
                  {rubric?.name}
                </h2>
                <p className="text-xs text-slate-400 mt-1 line-clamp-3">
                  {rubric?.description || tr(language, "Không có mô tả.", "No description.")}
                </p>
              </div>

              <div className="border-t border-slate-800/80 pt-4 space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">{tr(language, "Nhóm:", "Group:")}</span>
                  <span className="font-bold text-slate-200">{activeGroup?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{tr(language, "Trạng thái:", "Status:")}</span>
                  <span className={`px-2 py-0.5 rounded font-semibold text-[10px] ${
                    gradeStatus === 'Submitted'
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {gradeStatus === 'Submitted' 
                      ? tr(language, "Đã gửi", "Submitted") 
                      : tr(language, "Bản nháp", "Draft")
                    }
                  </span>
                </div>
              </div>

              {/* Total score box */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-4 text-center">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wide">
                  {tr(language, "Tổng điểm", "Total Score")}
                </span>
                <div className="text-3xl font-extrabold text-white mt-1">
                  {totalCalculatedScore.toFixed(1)}
                  <span className="text-sm font-semibold text-slate-500"> / {maxTotalScore.toFixed(1)}</span>
                </div>
                {maxScoreColumnKey && maxTotalScore > 0 && (
                  <div className="text-[10px] text-slate-400 mt-1">
                    {tr(language, "Quy đổi hệ 10:", "Scaled (out of 10):")}{" "}
                    <span className="text-indigo-400 font-bold">
                      {((totalCalculatedScore / maxTotalScore) * 10).toFixed(1)}
                    </span>
                  </div>
                )}
              </div>
            </Card>

            {/* Grading spreadsheet grid */}
            <Card className="lg:col-span-3 bg-slate-900/60 border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-indigo-400" />
                {tr(language, "Bảng chấm điểm chi tiết", "Spreadsheet Evaluation Board")}
              </h3>

              {gradeStatus === 'Submitted' && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 text-xs text-slate-400 flex items-start gap-2 leading-relaxed">
                  <AlertTriangle className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                  <span>
                    {tr(
                      language,
                      "Bảng điểm này đã được gửi và khóa lại. Để chỉnh sửa, vui lòng bấm nút 'Mở khóa chấm lại' ở trên.",
                      "This grade has been submitted and locked. Click 'Reopen Grading' above to make edits."
                    )}
                  </span>
                </div>
              )}

              {/* Interactive evaluation grid */}
              <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/40 max-h-[460px]">
                <table className="w-full text-sm border-collapse min-w-[700px]">
                  <thead className="bg-slate-900 sticky top-0 z-10">
                    <tr className="border-b border-slate-800">
                      {displayHeaders.map((header) => {
                        const isScore = header === "score";
                        const isComment = header === "comment";
                        let label = header;
                        
                        if (isScore) label = "Điểm chấm";
                        else if (isComment) label = "Nhận xét";

                        return (
                          <th
                            key={header}
                            className={`px-3 py-2 text-left font-semibold border-r border-slate-800 last:border-r-0 ${
                              isScore ? 'text-indigo-400 min-w-[90px] w-28' :
                              isComment ? 'text-indigo-400 min-w-[200px]' : 'text-slate-300 min-w-[120px]'
                            }`}
                          >
                            {label}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {gradeTable.map((row, rowIndex) => {
                      const rowError = errors.find(err => err.rowIndex === rowIndex);
                      
                      return (
                        <tr
                          key={rowIndex}
                          className={`border-b border-slate-900 last:border-0 hover:bg-slate-900/30 transition-colors ${
                            rowError ? 'bg-rose-500/5' : ''
                          }`}
                        >
                          {displayHeaders.map((header) => {
                            const isScore = header === "score";
                            const isComment = header === "comment";

                            if (isScore) {
                              return (
                                <td key={header} className="p-1 border-r border-slate-900">
                                  <div className="relative">
                                    <Input
                                      type="text"
                                      value={row[header] || ""}
                                      onChange={e => handleCellChange(rowIndex, header, e.target.value)}
                                      disabled={gradeStatus === 'Submitted'}
                                      placeholder="0"
                                      className={`h-8 w-full bg-slate-950/60 text-slate-100 text-xs rounded border text-center ${
                                        rowError 
                                          ? 'border-rose-500 focus-visible:ring-rose-500' 
                                          : 'border-slate-800 focus-visible:ring-indigo-500'
                                      }`}
                                    />
                                    {rowError && (
                                      <span className="absolute left-0 -bottom-5 z-20 text-[9px] text-rose-400 font-medium whitespace-nowrap bg-slate-950 px-1 border border-rose-900/40 rounded">
                                        {rowError.message}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            }

                            if (isComment) {
                              return (
                                <td key={header} className="p-1 border-r border-slate-900">
                                  <Input
                                    type="text"
                                    value={row[header] || ""}
                                    onChange={e => handleCellChange(rowIndex, header, e.target.value)}
                                    disabled={gradeStatus === 'Submitted'}
                                    placeholder={tr(language, "Nhập phản hồi...", "Enter feedback...")}
                                    className="h-8 w-full bg-slate-950/60 border-slate-800 text-slate-100 text-xs rounded"
                                  />
                                </td>
                              );
                            }

                            // Read-only original template cells
                            return (
                              <td
                                key={header}
                                className="px-3 py-2 text-slate-300 border-r border-slate-900 truncate max-w-[200px]"
                                title={row[header]}
                              >
                                {row[header]}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="text-[11px] text-slate-500">
                * {tr(
                  language,
                  "Nhập điểm số và nhận xét phản hồi cho từng tiêu chí chấm điểm tương ứng của nhóm sinh viên.",
                  "Enter the corresponding score and feedback comments for each evaluation criteria of the student team."
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Confirm Submission Dialog */}
      <Dialog open={isSubmitConfirmOpen} onOpenChange={setIsSubmitConfirmOpen}>
        <DialogContent className="sm:max-w-[420px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-indigo-400" />
              {tr(language, "Xác nhận gửi điểm", "Confirm Grade Submission")}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs leading-relaxed mt-2">
              {tr(
                language,
                "Sau khi gửi, bảng điểm của nhóm sẽ bị khóa lại. Điểm trung bình quy đổi cũng sẽ được tự động đồng bộ hóa làm điểm Giảng viên cho các thành viên. Bạn có chắc chắn muốn gửi điểm chính thức?",
                "Once submitted, this evaluation sheet will be locked. The scaled score will be cascaded as the overall lecturer score for all team members. Are you sure you want to proceed?"
              )}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="ghost"
              onClick={() => setIsSubmitConfirmOpen(false)}
              className="text-slate-400 hover:text-white rounded-xl"
            >
              {tr(language, "Hủy", "Cancel")}
            </Button>
            <Button
              onClick={handleFinalSubmit}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20"
            >
              {tr(language, "Xác nhận gửi", "Confirm Submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
};

export default LecturerRubricGrade;
