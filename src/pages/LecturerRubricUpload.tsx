import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTeam } from "@/context/TeamContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  FileSpreadsheet,
  Upload,
  ArrowLeft,
  Loader2,
  FileWarning,
  Layers
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import DashboardSidebar from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { parseRubricFile } from "@/lib/rubricParser";

const LecturerRubricUpload = () => {
  const { currentUserName } = useTeam();
  const { signOut } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file: File) => {
    setErrorMsg(null);
    const extension = file.name.split('.').pop()?.toLowerCase();
    
    // 1. Validate format
    if (extension !== 'csv' && extension !== 'xlsx') {
      const msg = "File không đúng định dạng. Vui lòng tải lên file .xlsx hoặc .csv.";
      setErrorMsg(msg);
      toast({ title: tr(language, "Lỗi định dạng", "Format Error"), description: msg, variant: "destructive" });
      return;
    }

    // 2. Validate size
    if (file.size > MAX_FILE_SIZE) {
      const msg = "File vượt quá dung lượng cho phép.";
      setErrorMsg(msg);
      toast({ title: tr(language, "Lỗi dung lượng", "Size Error"), description: msg, variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      // 3. Parse File
      const parsedData = await parseRubricFile(file);
      
      // 4. Save to sessionStorage
      const rubricName = file.name.replace(/\.[^/.]+$/, ""); // strip extension
      sessionStorage.setItem("teamfair_temp_rubric", JSON.stringify({
        originalFileName: file.name,
        fileType: file.type || extension,
        name: rubricName,
        parsedData
      }));

      toast({
        title: tr(language, "Tải lên thành công", "Upload Success"),
        description: tr(language, "Chuyển đến trang xem trước cấu trúc...", "Redirecting to preview page..."),
      });

      // 5. Navigate to preview page
      navigate("/lecturer/rubrics/preview");
    } catch (err) {
      console.error(err);
      const msg = "Không thể đọc dữ liệu từ file.";
      setErrorMsg(msg);
      toast({ title: tr(language, "Lỗi đọc file", "Read Error"), description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      void processFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      void processFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
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
      <div className="container mx-auto px-6 py-6 max-w-2xl space-y-6">
        
        {/* Navigation back */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/lecturer/rubrics")}
            className="text-slate-400 hover:text-white flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {tr(language, "Quay lại danh sách", "Back to Rubrics List")}
          </Button>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Upload className="h-6 w-6 text-indigo-400" />
            {tr(language, "Tải lên file Rubric mới", "Upload New Rubric File")}
          </h1>
          <p className="text-slate-400 text-sm">
            {tr(
              language,
              "Hệ thống sẽ tự động quét và chuyển đổi file Excel/CSV của bạn thành cấu trúc bảng tương tác để chỉnh sửa.",
              "The system will automatically parse and convert your Excel/CSV file into an editable spreadsheet grid."
            )}
          </p>
        </div>

        {/* Drag and Drop Area */}
        <Card
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`bg-slate-900/40 border-2 border-dashed rounded-3xl p-10 text-center flex flex-col items-center justify-center min-h-[320px] transition-all duration-300 ${
            dragActive
              ? "border-indigo-500 bg-indigo-500/5 shadow-indigo-500/10 shadow-lg"
              : "border-slate-800 hover:border-slate-700 bg-slate-900/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".xlsx,.csv"
            onChange={handleChange}
            disabled={uploading}
          />

          {uploading ? (
            <div className="space-y-4 animate-pulse">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto w-fit">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-slate-200">
                  {tr(language, "Đang xử lý dữ liệu...", "Processing spreadsheet...")}
                </h3>
                <p className="text-xs text-slate-400">
                  {tr(language, "Đang trích xuất cấu trúc cột và các tiêu chí chấm điểm...", "Extracting columns and grading criteria...")}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto w-fit group-hover:scale-105 transition-transform duration-300">
                <FileSpreadsheet className="h-8 w-8" />
              </div>

              <div className="space-y-1">
                <h3 className="font-bold text-slate-200">
                  {tr(language, "Kéo thả file vào đây hoặc click để chọn", "Drag & drop file here or click to select")}
                </h3>
                <p className="text-xs text-slate-400">
                  {tr(language, "Hỗ trợ file Excel (.xlsx) và CSV (.csv) lên đến 10MB", "Supports Excel (.xlsx) and CSV (.csv) files up to 10MB")}
                </p>
              </div>

              <Button
                type="button"
                onClick={onButtonClick}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20"
              >
                {tr(language, "Chọn File", "Choose File")}
              </Button>
            </div>
          )}
        </Card>

        {/* Error Messages */}
        {errorMsg && (
          <Card className="bg-rose-500/5 border border-rose-500/20 rounded-2xl p-4 flex items-start gap-3 text-rose-400">
            <FileWarning className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold">{tr(language, "Có lỗi xảy ra", "Error occurred")}</h4>
              <p className="text-xs text-rose-300/90 leading-relaxed">{errorMsg}</p>
            </div>
          </Card>
        )}
      </div>
    </DashboardShell>
  );
};

export default LecturerRubricUpload;
