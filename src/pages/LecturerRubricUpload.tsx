import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam } from "@/context/TeamContext";
import { tr } from "@/lib/i18n";
import { parseRubricFile } from "@/lib/rubricParser";
import { getAccessibleRubricProjects } from "@/lib/rubricProjectAccess";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, FileSpreadsheet, FileWarning, Loader2, Upload } from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const LecturerRubricUpload = () => {
  const { language } = useLanguage();
  const { groups } = useTeam();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchParams] = useSearchParams();
  const currentRole =
    profile?.role ||
    ((user?.user_metadata?.app_role ||
      user?.app_metadata?.role ||
      user?.user_metadata?.role) as "student" | "lecturer" | "admin" | undefined);

  const projects = useMemo(
    () =>
      getAccessibleRubricProjects(groups, user?.id, currentRole).map((group) => ({
        id: group.id,
        name: group.name,
        lecturerId: group.lecturer_id,
      })),
    [currentRole, groups, user?.id],
  );

  const initialProjectId = searchParams.get("projectId") || "";
  const [selectedProjectId, setSelectedProjectId] = useState(
    projects.some((project) => project.id === initialProjectId) ? initialProjectId : "",
  );
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;

  const validateFile = (file: File) => {
    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!selectedProjectId) {
      return "Vui lòng chọn dự án trước khi tải lên rubric.";
    }

    if (!selectedProject) {
      return "Bạn không có quyền tạo rubric cho dự án này.";
    }

    if (!extension || !["xlsx", "xls", "csv"].includes(extension)) {
      return "File không đúng định dạng. Vui lòng tải lên file .xlsx, .xls hoặc .csv.";
    }

    if (file.size === 0) {
      return "File đang trống. Vui lòng chọn file có dữ liệu rubric.";
    }

    if (file.size > MAX_FILE_SIZE) {
      return "File vượt quá dung lượng cho phép 10MB.";
    }

    return null;
  };

  const processFile = async (file: File) => {
    const validationError = validateFile(file);
    setErrorMessage(validationError);

    if (validationError) {
      toast({
        title: tr(language, "Lỗi tải file", "Upload error"),
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setUploading(true);
    try {
      const parsed = await parseRubricFile(file);
      if (parsed.sheets.every((sheet) => sheet.data === null)) {
        throw new Error("Tất cả sheet đều trống hoặc không hợp lệ.");
      }

      sessionStorage.setItem(
        "teamfair_temp_rubric",
        JSON.stringify({
          projectId: selectedProjectId,
          projectName: selectedProject?.name || "",
          originalFileName: file.name,
          fileType: file.type || file.name.split(".").pop()?.toLowerCase() || "unknown",
          name: file.name.replace(/\.[^/.]+$/, ""),
          isMultiSheet: parsed.isMultiSheet,
          sheets: parsed.sheets,
        }),
      );

      toast({
        title: tr(language, "Tải lên thành công", "Upload success"),
        description: tr(language, "Đã chuyển sang bước xem trước rubric.", "Moved to rubric preview."),
      });
      navigate(`/lecturer/rubrics/preview?projectId=${selectedProjectId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể đọc dữ liệu từ file.";
      setErrorMessage(message);
      toast({
        title: tr(language, "Lỗi đọc file", "Read error"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="container mx-auto max-w-3xl space-y-6 px-6 py-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/lecturer/rubrics")}
          className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tr(language, "Quay lại Thang chấm điểm", "Back to rubrics")}
        </Button>

        <Card className="rounded-3xl border-slate-200 p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <FileWarning className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            {tr(language, "Chưa có dự án được phân công", "No assigned projects")}
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
            {tr(
              language,
              "Bạn chưa được phân công dự án nào nên chưa thể tạo rubric.",
              "You have not been assigned to any project yet, so rubric creation is unavailable.",
            )}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 px-6 py-6">
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate("/lecturer/rubrics")}
        className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        {tr(language, "Quay lại Thang chấm điểm", "Back to rubrics")}
      </Button>

      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
          <Upload className="h-6 w-6 text-indigo-600" />
          {tr(language, "Tải lên Rubric", "Upload rubric")}
        </h1>
        <p className="text-sm text-slate-500">
          {tr(
            language,
            "Chọn dự án trước, sau đó tải lên file Excel hoặc CSV để hệ thống mở bước xem trước và chỉnh sửa mẫu rubric.",
            "Select a project first, then upload an Excel or CSV file for preview and rubric editing.",
          )}
        </p>
      </div>

      <Card className="rounded-3xl border-slate-200 p-6 shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">
            {tr(language, "Chọn dự án", "Select project")}
          </label>
          <Select value={selectedProjectId || "none"} onValueChange={(value) => setSelectedProjectId(value === "none" ? "" : value)}>
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder={tr(language, "Chọn dự án áp dụng cho rubric", "Select a project for this rubric")} />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="none">{tr(language, "Chọn dự án áp dụng cho rubric", "Select a project for this rubric")}</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card
        className={`min-h-[320px] rounded-3xl border-2 border-dashed p-10 text-center transition-all ${
          dragActive ? "border-indigo-500 bg-indigo-50 shadow-lg shadow-indigo-500/10" : "border-slate-300 bg-white"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(false);
          const droppedFile = event.dataTransfer.files?.[0];
          if (droppedFile) {
            void processFile(droppedFile);
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={(event) => {
            const selectedFile = event.target.files?.[0];
            if (selectedFile) {
              void processFile(selectedFile);
            }
            event.target.value = "";
          }}
          disabled={uploading}
        />

        {uploading ? (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold text-slate-900">
                {tr(language, "Đang xử lý dữ liệu...", "Processing rubric...")}
              </h2>
              <p className="text-sm text-slate-500">
                {tr(language, "Đang đọc sheet, cột và các tiêu chí chấm điểm.", "Reading sheets, columns and criteria.")}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <FileSpreadsheet className="h-8 w-8" />
            </div>
            <div className="space-y-1">
              <h2 className="font-semibold text-slate-900">
                {tr(language, "Kéo thả file vào đây hoặc bấm để chọn", "Drag a file here or click to browse")}
              </h2>
              <p className="text-sm text-slate-500">
                {tr(language, "Hỗ trợ .xlsx, .xls, .csv. Giới hạn tối đa 10MB.", "Supports .xlsx, .xls, .csv up to 10MB.")}
              </p>
            </div>
            <Button
              className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
              onClick={() => {
                if (!selectedProjectId) {
                  const message = "Vui lòng chọn dự án trước khi tải lên rubric.";
                  setErrorMessage(message);
                  toast({
                    title: tr(language, "Thiếu dự án", "Project required"),
                    description: message,
                    variant: "destructive",
                  });
                  return;
                }
                fileInputRef.current?.click();
              }}
            >
              {tr(language, "Chọn file", "Choose file")}
            </Button>
          </div>
        )}
      </Card>

      {errorMessage ? (
        <Card className="flex items-start gap-3 rounded-2xl border-red-200 bg-red-50 p-4 text-red-600">
          <FileWarning className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">{tr(language, "Không thể tải file", "Unable to upload file")}</h3>
            <p className="text-xs leading-relaxed text-red-500">{errorMessage}</p>
          </div>
        </Card>
      ) : null}
    </div>
  );
};

export default LecturerRubricUpload;
