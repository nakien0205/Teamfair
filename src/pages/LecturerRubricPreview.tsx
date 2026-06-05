import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam } from "@/context/TeamContext";
import { tr } from "@/lib/i18n";
import type { ParsedRubric, SheetParseResult } from "@/lib/rubricParser";
import { canAccessRubricProject, getAccessibleRubricProjects } from "@/lib/rubricProjectAccess";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { insertRubricAuditLog, saveRubricTemplate } from "@/lib/rubricPersistence";
import { validateRubricTemplateInput } from "@/lib/rubricModel";
import { ArrowLeft, Check, Edit2, FileSpreadsheet, Grid3X3, Plus, Save, Settings, Trash2, X } from "lucide-react";

type TempRubricPayload = {
  projectId: string;
  projectName?: string;
  originalFileName: string;
  fileType: string;
  name: string;
  isMultiSheet: boolean;
  sheets: SheetParseResult[];
};

const LecturerRubricPreview = () => {
  const { groups } = useTeam();
  const { profile, user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const currentRole =
    profile?.role ||
    ((user?.user_metadata?.app_role ||
      user?.app_metadata?.role ||
      user?.user_metadata?.role) as "student" | "lecturer" | "admin" | undefined);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [rubricName, setRubricName] = useState("");
  const [rubricDescription, setRubricDescription] = useState("");
  const [originalFileName, setOriginalFileName] = useState("");
  const [fileType, setFileType] = useState("");
  const [isMultiSheet, setIsMultiSheet] = useState(false);
  const [availableSheets, setAvailableSheets] = useState<SheetParseResult[]>([]);
  const [selectedSheetName, setSelectedSheetName] = useState("");
  const [previewLogged, setPreviewLogged] = useState(false);

  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [criteriaColumnKey, setCriteriaColumnKey] = useState<string | null>(null);
  const [maxScoreColumnKey, setMaxScoreColumnKey] = useState<string | null>(null);
  const [ratingColumnKeys, setRatingColumnKeys] = useState<string[]>([]);

  const [renamingHeaderIndex, setRenamingHeaderIndex] = useState<number | null>(null);
  const [renamingHeaderValue, setRenamingHeaderValue] = useState("");
  const [newColumnName, setNewColumnName] = useState("");
  const [isAddColumnOpen, setIsAddColumnOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedProject = useMemo(
    () =>
      getAccessibleRubricProjects(groups, user?.id, currentRole).find((group) => group.id === selectedProjectId) || null,
    [currentRole, groups, selectedProjectId, user?.id],
  );

  useEffect(() => {
    const raw = sessionStorage.getItem("teamfair_temp_rubric");
    if (!raw) {
      toast({
        title: tr(language, "Không tìm thấy dữ liệu", "Missing data"),
        description: tr(language, "Vui lòng tải file rubric trước khi xem bước preview.", "Please upload a rubric file first."),
        variant: "destructive",
      });
      navigate("/lecturer/rubrics/upload", { replace: true });
      return;
    }

    try {
      const parsed = JSON.parse(raw) as TempRubricPayload;
      if (!canAccessRubricProject(parsed.projectId, groups, user?.id, currentRole)) {
        toast({
          title: tr(language, "Không thể tạo rubric", "Unable to create rubric"),
          description: "Bạn không có quyền tạo rubric cho dự án này.",
          variant: "destructive",
        });
        navigate("/lecturer/rubrics", { replace: true });
        return;
      }
      setSelectedProjectId(parsed.projectId);
      setRubricName(parsed.name);
      setOriginalFileName(parsed.originalFileName);
      setFileType(parsed.fileType);
      setIsMultiSheet(parsed.isMultiSheet);
      setAvailableSheets(parsed.sheets);

      const firstValidSheet = parsed.sheets.find((sheet) => sheet.data !== null);
      if (firstValidSheet?.data) {
        setSelectedSheetName(firstValidSheet.sheetName);
        setHeaders(firstValidSheet.data.headers);
        setRows(firstValidSheet.data.rows);
        setCriteriaColumnKey(firstValidSheet.data.settings.criteriaColumnKey);
        setMaxScoreColumnKey(firstValidSheet.data.settings.maxScoreColumnKey);
        setRatingColumnKeys(firstValidSheet.data.settings.ratingColumnKeys);
      }
    } catch (error) {
      console.error("[Rubrics] Failed to restore temporary preview payload", error);
      navigate("/lecturer/rubrics/upload", { replace: true });
    }
  }, [currentRole, groups, language, navigate, toast, user?.id]);

  useEffect(() => {
    if (!user?.id || !selectedProjectId || previewLogged) return;
    if (!originalFileName || headers.length === 0) return;

    void insertRubricAuditLog(user.id, "UPLOAD_RUBRIC_PREVIEW", "rubric_preview", selectedProjectId, {
      file_name: originalFileName,
      file_type: fileType,
      selected_sheet: selectedSheetName || null,
      columns: headers,
      row_count: rows.length,
    }).finally(() => setPreviewLogged(true));
  }, [fileType, headers, originalFileName, previewLogged, rows.length, selectedProjectId, selectedSheetName, user?.id]);

  const loadSheetData = (sheetName: string) => {
    const targetSheet = availableSheets.find((sheet) => sheet.sheetName === sheetName);
    if (!targetSheet?.data) return;

    setSelectedSheetName(sheetName);
    setHeaders(targetSheet.data.headers);
    setRows(targetSheet.data.rows);
    setCriteriaColumnKey(targetSheet.data.settings.criteriaColumnKey);
    setMaxScoreColumnKey(targetSheet.data.settings.maxScoreColumnKey);
    setRatingColumnKeys(targetSheet.data.settings.ratingColumnKeys);
  };

  const handleCellChange = (rowIndex: number, header: string, value: string) => {
    setRows((current) => current.map((row, index) => (index === rowIndex ? { ...row, [header]: value } : row)));
  };

  const handleAddRow = () => {
    const newRow = headers.reduce<Record<string, string>>((accumulator, header) => {
      accumulator[header] = "";
      return accumulator;
    }, {});
    setRows((current) => [...current, newRow]);
  };

  const handleDeleteRow = (rowIndex: number) => {
    setRows((current) => current.filter((_, index) => index !== rowIndex));
  };

  const handleAddColumn = () => {
    const trimmedName = newColumnName.trim();
    if (!trimmedName) return;
    if (headers.includes(trimmedName)) {
      toast({
        title: tr(language, "Tên cột bị trùng", "Duplicate column"),
        description: tr(language, "Tên cột này đã tồn tại trong bảng.", "That column name already exists."),
        variant: "destructive",
      });
      return;
    }

    setHeaders((current) => [...current, trimmedName]);
    setRows((current) => current.map((row) => ({ ...row, [trimmedName]: "" })));
    setNewColumnName("");
    setIsAddColumnOpen(false);
  };

  const handleDeleteColumn = (header: string) => {
    if (headers.length <= 1) {
      toast({
        title: tr(language, "Không thể xóa cột", "Cannot delete column"),
        description: tr(language, "Rubric phải còn ít nhất một cột.", "The rubric must keep at least one column."),
        variant: "destructive",
      });
      return;
    }

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

  const handleRenameHeader = (headerIndex: number) => {
    const oldHeader = headers[headerIndex];
    const newHeader = renamingHeaderValue.trim();

    if (!newHeader || oldHeader === newHeader) {
      setRenamingHeaderIndex(null);
      return;
    }

    if (headers.includes(newHeader)) {
      toast({
        title: tr(language, "Tên cột bị trùng", "Duplicate column"),
        description: tr(language, "Tên cột này đã tồn tại trong bảng.", "That column name already exists."),
        variant: "destructive",
      });
      return;
    }

    setHeaders((current) => current.map((header, index) => (index === headerIndex ? newHeader : header)));
    setRows((current) =>
      current.map((row) => {
        const nextRow = { ...row, [newHeader]: row[oldHeader] || "" };
        delete nextRow[oldHeader];
        return nextRow;
      }),
    );

    if (criteriaColumnKey === oldHeader) setCriteriaColumnKey(newHeader);
    if (maxScoreColumnKey === oldHeader) setMaxScoreColumnKey(newHeader);
    if (ratingColumnKeys.includes(oldHeader)) {
      setRatingColumnKeys((current) => current.map((item) => (item === oldHeader ? newHeader : item)));
    }

    setRenamingHeaderIndex(null);
  };

  const handleSaveRubric = async () => {
    if (!selectedProjectId || !selectedProject || !user?.id) {
      toast({
        title: tr(language, "Không thể lưu rubric", "Unable to save rubric"),
        description: tr(language, "Vui lòng chọn đúng dự án trước khi lưu rubric.", "Please select a valid project before saving this rubric."),
        variant: "destructive",
      });
      return;
    }

    const canCreateForProject = canAccessRubricProject(selectedProjectId, groups, user.id, currentRole);
    if (!canCreateForProject) {
      toast({
        title: tr(language, "Không thể lưu rubric", "Unable to save rubric"),
        description: tr(
          language,
          "Bạn không có quyền tạo rubric cho dự án này.",
          "You do not have permission to create a rubric for this project.",
        ),
        variant: "destructive",
      });
      return;
    }

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

    const parsedData: ParsedRubric = {
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
        selectedSheetName: isMultiSheet ? selectedSheetName : undefined,
        availableSheets: isMultiSheet ? availableSheets.map((sheet) => sheet.sheetName) : undefined,
        multiSheetImport: isMultiSheet,
      },
    };

    try {
      setSaving(true);
      await saveRubricTemplate(
        selectedProjectId,
        null,
        rubricName.trim(),
        rubricDescription,
        originalFileName || null,
        fileType || null,
        parsedData,
        user.id,
      );

      sessionStorage.removeItem("teamfair_temp_rubric");
      toast({
        title: tr(language, "Đã lưu rubric", "Rubric saved"),
        description: tr(language, "Rubric đã được lưu thành công.", "The rubric has been saved successfully."),
      });
      navigate("/lecturer/rubrics");
    } catch (error) {
      toast({
        title: tr(language, "Không thể lưu rubric", "Unable to save rubric"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-6 px-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/lecturer/rubrics/upload${selectedProjectId ? `?projectId=${selectedProjectId}` : ""}`)}
          className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tr(language, "Quay lại tải lên", "Back to upload")}
        </Button>

        <Button
          onClick={() => void handleSaveRubric()}
          disabled={saving}
          className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? tr(language, "Đang lưu...", "Saving...") : tr(language, "Lưu Rubric", "Save rubric")}
        </Button>
      </div>

      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
          <Grid3X3 className="h-6 w-6 text-indigo-600" />
          {tr(language, "Xem trước và chỉnh sửa Rubric", "Preview and edit rubric")}
        </h1>
        <p className="text-sm text-slate-500">
          {tr(
            language,
            "Kiểm tra lại dữ liệu spreadsheet, chọn cột tiêu chí, cột điểm tối đa và các cột mức đánh giá trước khi lưu.",
            "Review the spreadsheet, then confirm the criteria, max score and rating columns before saving.",
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 rounded-3xl border-slate-200 p-6 shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-base font-semibold text-slate-900">
            <Settings className="h-4 w-4 text-indigo-600" />
            {tr(language, "Cấu hình rubric", "Rubric settings")}
          </h2>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">{tr(language, "Tên rubric", "Rubric name")}</label>
            <Input value={rubricName} onChange={(event) => setRubricName(event.target.value)} className="rounded-xl" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">{tr(language, "Dự án áp dụng", "Project")}</label>
            <Input value={selectedProject?.name || ""} readOnly className="rounded-xl bg-slate-50" />
          </div>

          {isMultiSheet && availableSheets.length > 1 ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700">{tr(language, "Chọn sheet để import", "Selected sheet")}</label>
              <Select value={selectedSheetName} onValueChange={loadSheetData}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder={tr(language, "Chọn sheet", "Select sheet")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {availableSheets.map((sheet) => (
                    <SelectItem key={sheet.sheetName} value={sheet.sheetName} disabled={!sheet.data}>
                      {sheet.sheetName}
                      {!sheet.data ? ` (${sheet.error || "Không hợp lệ"})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">{tr(language, "Mô tả", "Description")}</label>
            <Textarea
              value={rubricDescription}
              onChange={(event) => setRubricDescription(event.target.value)}
              rows={4}
              className="rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">{tr(language, "Tên file gốc", "Original file")}</label>
            <Input value={originalFileName} readOnly className="rounded-xl bg-slate-50" />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">{tr(language, "Cột tiêu chí", "Criteria column")}</label>
            <Select value={criteriaColumnKey || "none"} onValueChange={(value) => setCriteriaColumnKey(value === "none" ? null : value)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={tr(language, "Chọn cột", "Select column")} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">-- {tr(language, "Chưa chọn", "None")} --</SelectItem>
                {headers.map((header) => (
                  <SelectItem key={header} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">{tr(language, "Cột điểm tối đa", "Max score column")}</label>
            <Select value={maxScoreColumnKey || "none"} onValueChange={(value) => setMaxScoreColumnKey(value === "none" ? null : value)}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={tr(language, "Chọn cột", "Select column")} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="none">-- {tr(language, "Không dùng", "None")} --</SelectItem>
                {headers.map((header) => (
                  <SelectItem key={header} value={header}>
                    {header}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-700">{tr(language, "Các cột mức đánh giá", "Rating columns")}</label>
            <div className="grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
              {headers
                .filter((header) => header !== criteriaColumnKey && header !== maxScoreColumnKey)
                .map((header) => {
                  const selected = ratingColumnKeys.includes(header);
                  return (
                    <Button
                      key={header}
                      variant="outline"
                      className={`h-8 justify-start rounded-lg px-2 text-xs ${
                        selected ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600"
                      }`}
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
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
              {tr(language, "Bảng rubric", "Rubric table")}
            </h2>

            <div className="flex gap-2">
              <Dialog open={isAddColumnOpen} onOpenChange={setIsAddColumnOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="rounded-xl">
                    <Plus className="mr-2 h-4 w-4" />
                    {tr(language, "Thêm cột", "Add column")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-3xl">
                  <DialogHeader>
                    <DialogTitle>{tr(language, "Thêm cột mới", "Add a new column")}</DialogTitle>
                    <DialogDescription>
                      {tr(language, "Nhập tên cột mới rồi xác nhận để thêm vào bảng rubric.", "Enter a column name to add it to the rubric table.")}
                    </DialogDescription>
                  </DialogHeader>
                  <Input value={newColumnName} onChange={(event) => setNewColumnName(event.target.value)} className="rounded-xl" />
                  <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsAddColumnOpen(false)}>
                      {tr(language, "Hủy", "Cancel")}
                    </Button>
                    <Button className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500" onClick={handleAddColumn}>
                      {tr(language, "Thêm", "Add")}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <Button variant="outline" className="rounded-xl" onClick={handleAddRow}>
                <Plus className="mr-2 h-4 w-4" />
                {tr(language, "Thêm dòng", "Add row")}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-[640px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr className="border-b border-slate-200">
                  {headers.map((header, index) => (
                    <th key={header} className="min-w-[140px] border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 last:border-r-0">
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
                          <span className="truncate">
                            {header}
                            {header === criteriaColumnKey ? " • Tiêu chí" : ""}
                            {header === maxScoreColumnKey ? " • Điểm tối đa" : ""}
                          </span>
                          <div className="flex opacity-0 transition-opacity group-hover/header:opacity-100">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 rounded-md text-slate-500 hover:text-slate-700"
                              onClick={() => {
                                setRenamingHeaderIndex(index);
                                setRenamingHeaderValue(header);
                              }}
                            >
                              <Edit2 className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                              onClick={() => handleDeleteColumn(header)}
                            >
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
                          onChange={(event) => handleCellChange(rowIndex, header, event.target.value)}
                          className="h-8 w-full rounded-md border-none bg-transparent px-2 text-xs text-slate-900 outline-none ring-1 ring-transparent transition focus:ring-indigo-500/40"
                        />
                      </td>
                    ))}
                    <td className="p-1 text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => handleDeleteRow(rowIndex)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-slate-500">
            {tr(language, "Rubric phải có ít nhất một dòng dữ liệu và một cột tiêu chí trước khi lưu.", "The rubric needs at least one row and one criteria column before saving.")}
          </p>
        </Card>
      </div>
    </div>
  );
};

export default LecturerRubricPreview;
