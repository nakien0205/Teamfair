import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTeam } from "@/context/TeamContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  FileSpreadsheet,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Settings,
  Grid3X3,
  Edit2,
  Check,
  X,
  Layers
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
import { saveRubricTemplate } from "@/lib/rubricPersistence";
import type { ParsedRubric } from "@/lib/rubricParser";

const LecturerRubricPreview = () => {
  const { groups, currentGroupIndex, currentUserName } = useTeam();
  const { profile, signOut } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const activeGroup = groups[currentGroupIndex];

  // Raw uploaded details from sessionStorage
  const [rubricName, setRubricName] = useState("");
  const [rubricDesc, setRubricDesc] = useState("");
  const [originalFileName, setOriginalFileName] = useState("");
  const [fileType, setFileType] = useState("");
  
  // Grid structure
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [maxScoreColumnKey, setMaxScoreColumnKey] = useState<string | null>(null);

  // Editing headers helper states
  const [renamingHeaderIndex, setRenamingHeaderIndex] = useState<number | null>(null);
  const [renamingHeaderValue, setRenamingHeaderValue] = useState("");

  // Adding new column state
  const [newColName, setNewColName] = useState("");
  const [isAddColOpen, setIsAddColOpen] = useState(false);

  // Load from session storage
  useEffect(() => {
    const rawTemp = sessionStorage.getItem("teamfair_temp_rubric");
    if (!rawTemp) {
      toast({
        title: tr(language, "Không tìm thấy dữ liệu", "Data not found"),
        description: tr(language, "Vui lòng tải lên file rubric trước.", "Please upload a rubric file first."),
        variant: "destructive"
      });
      navigate("/lecturer/rubrics/upload");
      return;
    }

    try {
      const parsed = JSON.parse(rawTemp) as {
        originalFileName: string;
        fileType: string;
        name: string;
        parsedData: ParsedRubric;
      };

      setRubricName(parsed.name);
      setOriginalFileName(parsed.originalFileName);
      setFileType(parsed.fileType);
      setHeaders(parsed.parsedData.headers);
      setRows(parsed.parsedData.rows);
      setMaxScoreColumnKey(parsed.parsedData.maxScoreColumnKey);
    } catch (err) {
      console.error("Lỗi đọc dữ liệu tạm từ bộ nhớ trình duyệt:", err);
      navigate("/lecturer/rubrics/upload");
    }
  }, []);

  // Spreadsheet helpers
  const handleCellChange = (rowIndex: number, colName: string, val: string) => {
    setRows(prevRows => 
      prevRows.map((row, idx) => 
        idx === rowIndex ? { ...row, [colName]: val } : row
      )
    );
  };

  const handleAddRow = () => {
    const newRow = headers.reduce<Record<string, string>>((acc, header) => {
      acc[header] = "";
      return acc;
    }, {});
    setRows([...rows, newRow]);
  };

  const handleDeleteRow = (index: number) => {
    setRows(rows.filter((_, idx) => idx !== index));
  };

  const handleAddColumn = () => {
    const name = newColName.trim();
    if (!name) return;
    if (headers.includes(name)) {
      toast({
        title: tr(language, "Trùng tên cột", "Duplicate Column"),
        description: tr(language, "Tên cột này đã tồn tại trong bảng.", "This column name already exists."),
        variant: "destructive"
      });
      return;
    }

    setHeaders([...headers, name]);
    setRows(prevRows => prevRows.map(row => ({ ...row, [name]: "" })));
    setNewColName("");
    setIsAddColOpen(false);

    toast({
      title: tr(language, "Đã thêm cột", "Column Added"),
      description: tr(language, `Cột "${name}" đã được thêm thành công.`, `Column "${name}" added successfully.`),
    });
  };

  const handleDeleteColumn = (colName: string) => {
    if (headers.length <= 1) {
      toast({
        title: tr(language, "Lỗi", "Error"),
        description: tr(language, "Bảng phải chứa ít nhất một cột.", "The table must contain at least one column."),
        variant: "destructive"
      });
      return;
    }

    if (!confirm(tr(language, `Bạn có chắc chắn muốn xóa cột "${colName}"? Tất cả dữ liệu của cột này sẽ bị mất.`, `Are you sure you want to delete column "${colName}"? All data in this column will be lost.`))) {
      return;
    }

    setHeaders(headers.filter(h => h !== colName));
    setRows(prevRows => 
      prevRows.map(row => {
        const newRow = { ...row };
        delete newRow[colName];
        return newRow;
      })
    );

    if (maxScoreColumnKey === colName) {
      setMaxScoreColumnKey(null);
    }
  };

  const startRenameHeader = (index: number, currentVal: string) => {
    setRenamingHeaderIndex(index);
    setRenamingHeaderValue(currentVal);
  };

  const saveRenameHeader = (index: number) => {
    const oldName = headers[index];
    const newName = renamingHeaderValue.trim();

    if (!newName) {
      setRenamingHeaderIndex(null);
      return;
    }

    if (oldName === newName) {
      setRenamingHeaderIndex(null);
      return;
    }

    if (headers.includes(newName)) {
      toast({
        title: tr(language, "Trùng tên cột", "Duplicate Column"),
        description: tr(language, "Tên cột này đã tồn tại trong bảng.", "This column name already exists."),
        variant: "destructive"
      });
      return;
    }

    // Update headers
    setHeaders(headers.map((h, i) => i === index ? newName : h));

    // Update keys in rows
    setRows(prevRows => 
      prevRows.map(row => {
        const newRow = { ...row };
        newRow[newName] = newRow[oldName] || "";
        delete newRow[oldName];
        return newRow;
      })
    );

    // Update max score selection key if necessary
    if (maxScoreColumnKey === oldName) {
      setMaxScoreColumnKey(newName);
    }

    setRenamingHeaderIndex(null);
  };

  // Submit and Save to Database
  const handleSaveRubric = async () => {
    if (!activeGroup?.id) return;
    const nameTrimmed = rubricName.trim();

    // Validations in Vietnamese
    if (!nameTrimmed) {
      toast({
        title: tr(language, "Lỗi xác thực", "Validation Error"),
        description: "Tên rubric không được để trống.",
        variant: "destructive"
      });
      return;
    }

    if (rows.length === 0) {
      toast({
        title: tr(language, "Lỗi xác thực", "Validation Error"),
        description: "Rubric phải có ít nhất một dòng dữ liệu.",
        variant: "destructive"
      });
      return;
    }

    try {
      const templateData: ParsedRubric = {
        headers,
        rows,
        maxScoreColumnKey,
        settings: {
          headerRowIndex: 0,
          maxScoreColumnKey,
          autoAddScoreColumn: true,
          scoreColumnLabel: "Điểm chấm",
          commentColumnLabel: "Nhận xét"
        }
      };

      await saveRubricTemplate(
        activeGroup.id,
        null, // new template
        nameTrimmed,
        rubricDesc.trim(),
        originalFileName || null,
        fileType || null,
        templateData,
        profile?.id || ""
      );

      toast({
        title: tr(language, "Thành công", "Success"),
        description: "Rubric đã được lưu thành công.",
      });

      // Clear temp storage and redirect
      sessionStorage.removeItem("teamfair_temp_rubric");
      navigate("/lecturer/rubrics");
    } catch (err) {
      console.error(err);
      toast({
        title: tr(language, "Lỗi lưu file", "Save Error"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive"
      });
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
        
        {/* Navigation back */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/lecturer/rubrics/upload")}
            className="text-slate-400 hover:text-white flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {tr(language, "Quay lại tải lên", "Back to Upload")}
          </Button>

          <Button
            onClick={handleSaveRubric}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            {tr(language, "Lưu Thang điểm", "Save Rubric")}
          </Button>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Grid3X3 className="h-6 w-6 text-indigo-400" />
            {tr(language, "Xem trước & hiệu chỉnh Rubric", "Preview & Edit Rubric")}
          </h1>
          <p className="text-slate-400 text-sm">
            {tr(
              language,
              "Chỉnh sửa nội dung tiêu chí, cột, hàng, và cấu hình cột điểm tối đa trước khi lưu chính thức.",
              "Edit criteria content, columns, rows, and identify the max score column before final saving."
            )}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          
          {/* Settings Panel */}
          <Card className="lg:col-span-1 bg-slate-900/60 border-slate-800 rounded-3xl p-6 space-y-4">
            <h3 className="font-bold text-slate-100 flex items-center gap-2 border-b border-slate-800 pb-3">
              <Settings className="h-4 w-4 text-indigo-400" />
              {tr(language, "Cấu hình Rubric", "Rubric Settings")}
            </h3>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">
                {tr(language, "Tên Rubric *", "Rubric Name *")}
              </label>
              <Input
                value={rubricName}
                onChange={e => setRubricName(e.target.value)}
                placeholder={tr(language, "Nhập tên rubric...", "Enter rubric name...")}
                className="bg-slate-950 border-slate-800 text-slate-200 focus:border-indigo-500 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">
                {tr(language, "Mô tả", "Description")}
              </label>
              <Textarea
                value={rubricDesc}
                onChange={e => setRubricDesc(e.target.value)}
                placeholder={tr(language, "Mô tả mục đích hoặc cách sử dụng...", "Describe purpose or usage...")}
                rows={3}
                className="bg-slate-950 border-slate-800 text-slate-200 focus:border-indigo-500 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <span>{tr(language, "Cột Điểm Tối Đa", "Max Score Column")}</span>
                <span className="text-slate-500 text-[10px] font-normal">({tr(language, "Tùy chọn", "Optional")})</span>
              </label>
              <Select
                value={maxScoreColumnKey || "none"}
                onValueChange={(val) => setMaxScoreColumnKey(val === "none" ? null : val)}
              >
                <SelectTrigger className="w-full bg-slate-950 border-slate-800 rounded-xl text-slate-200">
                  <SelectValue placeholder={tr(language, "Chọn cột...", "Select column...")} />
                </SelectTrigger>
                <SelectContent className="bg-slate-950 border-slate-800 text-slate-200 rounded-xl">
                  <SelectItem value="none" className="focus:bg-slate-900 rounded-lg text-slate-400">
                    -- {tr(language, "Không có", "None")} --
                  </SelectItem>
                  {headers.map(h => (
                    <SelectItem key={h} value={h} className="focus:bg-slate-900 rounded-lg">
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Spreadsheet Table Grid */}
          <Card className="lg:col-span-2 bg-slate-900/60 border-slate-800 rounded-3xl p-6 space-y-4 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-100 flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-indigo-400" />
                {tr(language, "Nội dung bảng điểm", "Spreadsheet Grid")}
              </h3>

              <div className="flex gap-2">
                <Dialog open={isAddColOpen} onOpenChange={setIsAddColOpen}>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl flex items-center gap-1"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {tr(language, "Thêm cột", "Add Col")}
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl z-[9999]">
                    <DialogHeader>
                      <DialogTitle className="text-lg font-bold text-slate-100">
                        {tr(language, "Thêm cột mới", "Add New Column")}
                      </DialogTitle>
                      <DialogDescription className="text-slate-400 text-xs">
                        {tr(language, "Vui lòng nhập tên cho cột mới.", "Please enter a name for the new column.")}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-2">
                      <Input
                        value={newColName}
                        onChange={e => setNewColName(e.target.value)}
                        placeholder={tr(language, "Tên cột...", "Column name...")}
                        className="bg-slate-950 border-slate-800 text-slate-200 focus:border-indigo-500 rounded-xl"
                      />
                    </div>
                    <DialogFooter>
                      <Button
                        variant="ghost"
                        onClick={() => setIsAddColOpen(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        {tr(language, "Hủy", "Cancel")}
                      </Button>
                      <Button
                        onClick={handleAddColumn}
                        disabled={!newColName.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl"
                      >
                        {tr(language, "Thêm", "Add")}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddRow}
                  className="border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {tr(language, "Thêm dòng", "Add Row")}
                </Button>
              </div>
            </div>

            {/* Editable Spreadsheet Table */}
            <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-950/40 max-h-[380px]">
              <table className="w-full text-sm border-collapse min-w-[600px]">
                <thead className="bg-slate-900 sticky top-0 z-10">
                  <tr className="border-b border-slate-800">
                    {headers.map((header, index) => (
                      <th
                        key={header}
                        className="px-3 py-2 text-left font-semibold text-slate-300 border-r border-slate-800 last:border-r-0 min-w-[120px]"
                      >
                        {renamingHeaderIndex === index ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={renamingHeaderValue}
                              onChange={e => setRenamingHeaderValue(e.target.value)}
                              className="h-7 text-xs bg-slate-950 border-slate-800 p-1 text-slate-200"
                              autoFocus
                              onKeyDown={e => {
                                if (e.key === "Enter") saveRenameHeader(index);
                                if (e.key === "Escape") setRenamingHeaderIndex(null);
                              }}
                            />
                            <Button
                              size="icon"
                              onClick={() => saveRenameHeader(index)}
                              className="h-6 w-6 shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setRenamingHeaderIndex(null)}
                              className="h-6 w-6 shrink-0 text-slate-400 hover:text-white"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between group/header">
                            <span className="truncate pr-2">
                              {header}
                              {maxScoreColumnKey === header && (
                                <span className="ml-1 text-[9px] bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1 rounded">
                                  {tr(language, "Điểm max", "Max")}
                                </span>
                              )}
                            </span>
                            <div className="opacity-0 group-hover/header:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => startRenameHeader(index, header)}
                                className="h-5 w-5 text-slate-400 hover:text-white rounded"
                              >
                                <Edit2 className="h-2.5 w-2.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteColumn(header)}
                                className="h-5 w-5 text-slate-500 hover:text-rose-400 rounded"
                              >
                                <Trash2 className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-center text-slate-500 font-normal w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rowIndex) => (
                    <tr
                      key={rowIndex}
                      className="border-b border-slate-900 last:border-0 hover:bg-slate-900/30 transition-colors"
                    >
                      {headers.map((header) => (
                        <td
                          key={header}
                          className="p-1 border-r border-slate-900 last:border-r-0"
                        >
                          <input
                            type="text"
                            value={row[header] || ""}
                            onChange={e => handleCellChange(rowIndex, header, e.target.value)}
                            className="bg-transparent text-slate-200 border-none focus:outline-none focus:ring-1 focus:ring-indigo-500/40 rounded w-full h-8 px-2 text-xs"
                          />
                        </td>
                      ))}
                      <td className="p-1 text-center align-middle">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteRow(rowIndex)}
                          className="h-7 w-7 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-md"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-[11px] text-slate-500 flex justify-between">
              <span>* {tr(language, "Nhấp đúp chuột hoặc chọn ô để chỉnh sửa giá trị dữ liệu.", "Double click or focus any cell to edit cell values.")}</span>
              <span>
                {tr(language, "Tổng số dòng:", "Total rows:")} {rows.length}
              </span>
            </div>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
};

export default LecturerRubricPreview;
