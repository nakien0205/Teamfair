import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam } from "@/context/TeamContext";
import { tr } from "@/lib/i18n";
import {
  canManageRubric,
  parseStoredRubricTemplate,
  validateRubricTemplateInput,
} from "@/lib/rubricModel";
import { getAccessibleRubricProjects } from "@/lib/rubricProjectAccess";
import {
  duplicateRubric,
  fetchRubricSummaryById,
  fetchRubricWithTemplate,
  saveRubricTemplate,
  type RubricSummary,
} from "@/lib/rubricPersistence";
import DuplicateRubricDialog from "@/components/rubrics/DuplicateRubricDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, ArrowLeft, Check, Edit2, Loader2, Plus, Save, Trash2, X } from "lucide-react";

const LecturerRubricEdit = () => {
  const { rubricId } = useParams<{ rubricId: string }>();
  const { profile, user } = useAuth();
  const { groups } = useTeam();
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<RubricSummary | null>(null);
  const [rubricName, setRubricName] = useState("");
  const [rubricDescription, setRubricDescription] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [criteriaColumnKey, setCriteriaColumnKey] = useState<string | null>(null);
  const [maxScoreColumnKey, setMaxScoreColumnKey] = useState<string | null>(null);
  const [ratingColumnKeys, setRatingColumnKeys] = useState<string[]>([]);
  const [renamingHeaderIndex, setRenamingHeaderIndex] = useState<number | null>(null);
  const [renamingHeaderValue, setRenamingHeaderValue] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const currentRole =
    profile?.role ||
    ((user?.user_metadata?.app_role ||
      user?.app_metadata?.role ||
      user?.user_metadata?.role) as "student" | "lecturer" | "admin" | undefined);
  const projects = useMemo(
    () => getAccessibleRubricProjects(groups, user?.id, currentRole).map((group) => ({ id: group.id, name: group.name })),
    [currentRole, groups, user?.id],
  );

  useEffect(() => {
    const load = async () => {
      if (!rubricId) return;
      try {
        setLoading(true);
        setError(null);
        const [loadedSummary, loadedTemplate] = await Promise.all([
          fetchRubricSummaryById(rubricId),
          fetchRubricWithTemplate(rubricId),
        ]);

        const parsed = parseStoredRubricTemplate(
          loadedTemplate.template.table_json,
          loadedTemplate.template.columns_json,
          loadedTemplate.template.settings_json,
        );

        setSummary(loadedSummary);
        setRubricName(loadedSummary.rubric.name);
        setRubricDescription(loadedSummary.rubric.description || "");
        setHeaders(parsed.headers);
        setRows(parsed.rows);
        setCriteriaColumnKey(parsed.settings.criteriaColumnKey);
        setMaxScoreColumnKey(parsed.settings.maxScoreColumnKey);
        setRatingColumnKeys(parsed.settings.ratingColumnKeys);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [rubricId]);

  const canManage = useMemo(
    () =>
      canManageRubric({
        currentUserId: user?.id,
        currentUserRole: currentRole,
        createdBy: summary?.rubric.created_by,
      }),
    [currentRole, summary?.rubric.created_by, user?.id],
  );
  const isUsed = (summary?.usageCount || 0) > 0;

  const handleDuplicateSubmit = async ({ targetProjectId, newName }: { targetProjectId: string; newName: string }) => {
    if (!rubricId || !user?.id) return;

    try {
      setIsDuplicating(true);
      await duplicateRubric({
        rubricId,
        userId: user.id,
        targetProjectId,
        newName,
      });
      toast({
        title: tr(language, "Đã nhân bản rubric", "Rubric duplicated"),
        description: tr(
          language,
          "Bản sao mới đã được tạo để bạn chỉnh sửa an toàn.",
          "A new copy has been created for safe editing.",
        ),
      });
      setDuplicateDialogOpen(false);
      navigate(`/lecturer/rubrics?projectId=${targetProjectId}`);
    } catch (duplicateError) {
      toast({
        title: tr(language, "Không thể nhân bản rubric", "Unable to duplicate rubric"),
        description: duplicateError instanceof Error ? duplicateError.message : String(duplicateError),
        variant: "destructive",
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleSave = async () => {
    if (!summary || !user?.id || !canManage) return;

    const validationError = validateRubricTemplateInput({
      name: rubricName,
      headers,
      rows,
      criteriaColumnKey,
      maxScoreColumnKey,
    });

    if (validationError) {
      toast({
        title: tr(language, "Rubric chưa hợp lệ", "Rubric is invalid"),
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      await saveRubricTemplate(
        summary.rubric.project_id,
        summary.rubric.id,
        rubricName.trim(),
        rubricDescription,
        summary.rubric.original_file_name,
        summary.rubric.file_type,
        {
          columns: [],
          headers,
          rows,
          maxScoreColumnKey,
          settings: {
            headerRowIndex: 0,
            criteriaColumnKey,
            maxScoreColumnKey,
            ratingColumnKeys,
            autoAddScoreColumn: true,
            scoreColumnLabel: "Điểm chấm",
            commentColumnLabel: "Nhận xét",
            selectedSheetName: summary.selectedSheetName || undefined,
          },
        },
        user.id,
      );

      toast({
        title: tr(language, "Đã lưu chỉnh sửa", "Changes saved"),
        description: tr(language, "Rubric đã được cập nhật thành công.", "The rubric has been updated successfully."),
      });
      navigate(`/lecturer/rubrics/${summary.rubric.id}`);
    } catch (saveError) {
      toast({
        title: tr(language, "Không thể lưu rubric", "Unable to save rubric"),
        description: saveError instanceof Error ? saveError.message : String(saveError),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleAddRow = () => {
    const newRow = headers.reduce<Record<string, string>>((accumulator, header) => {
      accumulator[header] = "";
      return accumulator;
    }, {});
    setRows((current) => [...current, newRow]);
  };

  const handleDeleteRow = (index: number) => {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleAddColumn = () => {
    const name = newColumnName.trim();
    if (!name || headers.includes(name)) return;
    setHeaders((current) => [...current, name]);
    setRows((current) => current.map((row) => ({ ...row, [name]: "" })));
    setNewColumnName("");
  };

  const handleDeleteColumn = (header: string) => {
    if (headers.length <= 1) return;
    setHeaders((current) => current.filter((item) => item !== header));
    setRows((current) =>
      current.map((row) => {
        const nextRow = { ...row };
        delete nextRow[header];
        return nextRow;
      }),
    );
    if (criteriaColumnKey === header) setCriteriaColumnKey(null);
    if (maxScoreColumnKey === header) setMaxScoreColumnKey(null);
    if (ratingColumnKeys.includes(header)) {
      setRatingColumnKeys((current) => current.filter((item) => item !== header));
    }
  };

  const handleRenameHeader = (index: number) => {
    const oldName = headers[index];
    const newName = renamingHeaderValue.trim();
    if (!newName || oldName === newName || headers.includes(newName)) {
      setRenamingHeaderIndex(null);
      return;
    }

    setHeaders((current) => current.map((header, headerIndex) => (headerIndex === index ? newName : header)));
    setRows((current) =>
      current.map((row) => {
        const nextRow = { ...row, [newName]: row[oldName] || "" };
        delete nextRow[oldName];
        return nextRow;
      }),
    );

    if (criteriaColumnKey === oldName) setCriteriaColumnKey(newName);
    if (maxScoreColumnKey === oldName) setMaxScoreColumnKey(newName);
    if (ratingColumnKeys.includes(oldName)) {
      setRatingColumnKeys((current) => current.map((item) => (item === oldName ? newName : item)));
    }
    setRenamingHeaderIndex(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Card className="rounded-3xl border-red-200 p-8 text-center">
        <p className="text-sm text-red-600">{error || tr(language, "Không tìm thấy rubric.", "Rubric not found.")}</p>
      </Card>
    );
  }

  if (!canManage) {
    return (
      <div className="space-y-6">
        <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/lecturer/rubrics/${summary.rubric.id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tr(language, "Quay lại chi tiết", "Back to detail")}
        </Button>
        <Card className="rounded-3xl border-amber-200 bg-amber-50 p-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="space-y-3">
              <h1 className="text-lg font-semibold text-slate-900">
                {tr(language, "Bạn không sở hữu rubric này", "You do not own this rubric")}
              </h1>
              <p className="text-sm text-slate-700">
                {tr(
                  language,
                  "Bạn vẫn có thể xem và nhân bản rubric để tạo phiên bản mới cho dự án được phân công, nhưng không thể chỉnh sửa trực tiếp.",
                  "You can still view and duplicate this rubric into a new version, but you cannot edit it directly.",
                )}
              </p>
              <Button className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setDuplicateDialogOpen(true)}>
                {tr(language, "Nhân bản để chỉnh sửa", "Duplicate to edit")}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (isUsed) {
    return (
      <div className="space-y-6">
        <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/lecturer/rubrics/${summary.rubric.id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tr(language, "Quay lại chi tiết", "Back to detail")}
        </Button>
        <Card className="rounded-3xl border-amber-200 bg-amber-50 p-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="space-y-3">
              <h1 className="text-lg font-semibold text-slate-900">
                {tr(language, "Rubric này đã được dùng để chấm điểm", "This rubric has already been used for grading")}
              </h1>
              <p className="text-sm text-slate-700">
                {tr(
                  language,
                  "Rubric này đã được dùng để chấm điểm. Bạn nên nhân bản rubric để chỉnh sửa phiên bản mới.",
                  "This rubric has already been used for grading. Duplicate it before editing a new version.",
                )}
              </p>
              <Button className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500" onClick={() => setDuplicateDialogOpen(true)}>
                {tr(language, "Nhân bản để chỉnh sửa", "Duplicate to edit")}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button variant="outline" className="rounded-xl" onClick={() => navigate(`/lecturer/rubrics/${summary.rubric.id}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tr(language, "Quay lại chi tiết", "Back to detail")}
        </Button>
        <Button className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-500" disabled={saving} onClick={() => void handleSave()}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? tr(language, "Đang lưu...", "Saving...") : tr(language, "Lưu chỉnh sửa", "Save changes")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 rounded-3xl border-slate-200 p-6 shadow-sm">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Tên rubric</label>
            <Input value={rubricName} onChange={(event) => setRubricName(event.target.value)} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Mô tả</label>
            <Textarea value={rubricDescription} onChange={(event) => setRubricDescription(event.target.value)} rows={4} className="rounded-xl" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Hiển thị</label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {summary.rubric.visibility === "private" ? "Riêng tư" : "Theo dự án"}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Cột tiêu chí</label>
            <Select value={criteriaColumnKey || "none"} onValueChange={(value) => setCriteriaColumnKey(value === "none" ? null : value)}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Chọn cột" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">-- Chưa chọn --</SelectItem>
                {headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Cột điểm tối đa</label>
            <Select value={maxScoreColumnKey || "none"} onValueChange={(value) => setMaxScoreColumnKey(value === "none" ? null : value)}>
              <SelectTrigger className="rounded-xl"><SelectValue placeholder="Chọn cột" /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">-- Không dùng --</SelectItem>
                {headers.map((header) => <SelectItem key={header} value={header}>{header}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">Các cột mức đánh giá</label>
            <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
              {headers.filter((header) => header !== criteriaColumnKey && header !== maxScoreColumnKey).map((header) => {
                const selected = ratingColumnKeys.includes(header);
                return (
                  <Button
                    key={header}
                    variant="outline"
                    className={`h-8 justify-start rounded-lg px-2 text-xs ${selected ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"}`}
                    onClick={() =>
                      setRatingColumnKeys((current) =>
                        current.includes(header) ? current.filter((item) => item !== header) : [...current, header],
                      )
                    }
                  >
                    {header}
                  </Button>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="space-y-4 rounded-3xl border-slate-200 p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <Input value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} placeholder="Tên cột mới" className="w-52 rounded-xl" />
              <Button variant="outline" className="rounded-xl" onClick={handleAddColumn}>
                <Plus className="mr-2 h-4 w-4" />
                Thêm cột
              </Button>
            </div>
            <Button variant="outline" className="rounded-xl" onClick={handleAddRow}>
              <Plus className="mr-2 h-4 w-4" />
              Thêm dòng
            </Button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[720px] w-full border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  {headers.map((header, index) => (
                    <th key={header} className="border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 last:border-r-0">
                      {renamingHeaderIndex === index ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            value={renamingHeaderValue}
                            onChange={(event) => setRenamingHeaderValue(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") handleRenameHeader(index);
                              if (event.key === "Escape") setRenamingHeaderIndex(null);
                            }}
                            className="h-7 rounded-lg px-2 text-xs"
                          />
                          <Button size="icon" className="h-6 w-6 rounded-md bg-emerald-600 text-white hover:bg-emerald-500" onClick={() => handleRenameHeader(index)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6 rounded-md" onClick={() => setRenamingHeaderIndex(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <div className="group/header flex items-center justify-between gap-2">
                          <span className="truncate">{header}</span>
                          <div className="flex opacity-0 transition-opacity group-hover/header:opacity-100">
                            <Button size="icon" variant="ghost" className="h-6 w-6 rounded-md text-slate-500 hover:text-slate-700" onClick={() => { setRenamingHeaderIndex(index); setRenamingHeaderValue(header); }}>
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteColumn(header)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </th>
                  ))}
                  <th className="w-12 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr key={`row-${rowIndex}`} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                    {headers.map((header) => (
                      <td key={`${header}-${rowIndex}`} className="border-r border-slate-100 p-1 last:border-r-0">
                        <input
                          type="text"
                          value={row[header] || ""}
                          onChange={(event) =>
                            setRows((current) =>
                              current.map((item, index) =>
                                index === rowIndex ? { ...item, [header]: event.target.value } : item,
                              ),
                            )
                          }
                          className="h-8 w-full rounded-md border-none bg-transparent px-2 text-xs text-slate-900 outline-none ring-1 ring-transparent transition focus:ring-indigo-500/40"
                        />
                      </td>
                    ))}
                    <td className="p-1 text-center">
                      <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => handleDeleteRow(rowIndex)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <DuplicateRubricDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        sourceRubric={summary}
        projects={projects}
        language={language}
        mode="duplicate"
        isSubmitting={isDuplicating}
        onSubmit={handleDuplicateSubmit}
      />
    </div>
  );
};

export default LecturerRubricEdit;
