import { useState, useEffect } from "react";
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
  Plus,
  Trash2,
  GraduationCap,
  ArrowLeft,
  Loader2,
  Calendar,
  Layers,
  HelpCircle
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { fetchRubrics, deleteRubric, type RubricDbRow } from "@/lib/rubricPersistence";

const LecturerRubricsList = () => {
  const { groups, currentGroupIndex, currentUserName } = useTeam();
  const { profile, signOut } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [rubrics, setRubrics] = useState<RubricDbRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSelectGroupOpen, setIsSelectGroupOpen] = useState(false);
  const [selectedRubricId, setSelectedRubricId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");

  const activeGroup = groups[currentGroupIndex];

  // Fetch rubrics on load
  const loadRubrics = async () => {
    if (!activeGroup?.id) return;
    try {
      setLoading(true);
      const data = await fetchRubrics(activeGroup.id);
      setRubrics(data);
    } catch (err) {
      toast({
        title: tr(language, "Lỗi", "Error"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRubrics();
  }, [activeGroup?.id]);

  const handleDelete = async (rubricId: string) => {
    if (!confirm(tr(language, "Bạn có chắc chắn muốn xóa rubric này không? Hành động này cũng sẽ xóa tất cả kết quả chấm điểm liên quan.", "Are you sure you want to delete this rubric? This will also remove all associated grading scores."))) {
      return;
    }
    try {
      await deleteRubric(rubricId, profile?.id || null);
      toast({
        title: tr(language, "Thành công", "Success"),
        description: tr(language, "Đã xóa rubric thành công.", "Rubric deleted successfully."),
      });
      loadRubrics();
    } catch (err) {
      toast({
        title: tr(language, "Lỗi", "Error"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const handleStartGrading = (rubricId: string) => {
    setSelectedRubricId(rubricId);
    if (groups.length > 0) {
      setSelectedGroupId(groups[0].id);
    }
    setIsSelectGroupOpen(true);
  };

  const proceedToGrading = () => {
    if (!selectedRubricId || !selectedGroupId) return;
    setIsSelectGroupOpen(false);
    navigate(`/lecturer/groups/${selectedGroupId}/rubrics/${selectedRubricId}/grade`);
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
      <div className="container mx-auto px-6 py-6 max-w-5xl space-y-6">
        
        {/* Breadcrumb Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard-lecturer")}
            className="text-slate-400 hover:text-white flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {tr(language, "Quay lại Bảng điều khiển", "Back to Dashboard")}
          </Button>

          <Button
            onClick={() => navigate("/lecturer/rubrics/upload")}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            {tr(language, "Tải lên Rubric mới", "Upload New Rubric")}
          </Button>
        </div>

        {/* Header Title */}
        <div className="space-y-1">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-indigo-400" />
            {tr(language, "Quản lý Thang chấm điểm (Rubric)", "Rubric Templates Management")}
          </h1>
          <p className="text-slate-400 text-sm">
            {tr(
              language,
              "Tải lên, định cấu hình và sử dụng các file Rubric Excel/CSV để chấm điểm các nhóm sinh viên.",
              "Upload, configure, and apply Excel/CSV rubrics to grade student teams."
            )}
          </p>
        </div>

        {/* Rubrics List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
            <p className="text-slate-400 text-sm font-medium animate-pulse">
              {tr(language, "Đang tải danh sách rubric...", "Loading rubrics...")}
            </p>
          </div>
        ) : rubrics.length === 0 ? (
          <Card className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center gap-4">
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <HelpCircle className="h-8 w-8" />
            </div>
            <h3 className="font-bold text-lg text-slate-100">
              {tr(language, "Chưa có Thang chấm điểm", "No Rubrics Uploaded")}
            </h3>
            <p className="text-sm text-slate-400 max-w-sm">
              {tr(
                language,
                "Hãy tải lên thang chấm điểm ở định dạng file .xlsx hoặc .csv để bắt đầu đánh giá các nhóm sinh viên.",
                "Upload a grading rubric in .xlsx or .csv format to start evaluating student groups."
              )}
            </p>
            <Button
              onClick={() => navigate("/lecturer/rubrics/upload")}
              className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              {tr(language, "Tải lên ngay", "Upload Now")}
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {rubrics.map((rubric) => (
              <Card
                key={rubric.id}
                className="group bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-indigo-500/40 rounded-3xl p-6 flex flex-col justify-between transition-all duration-300 shadow-xl"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="p-3 w-fit rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 group-hover:scale-105 transition-transform duration-300">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(rubric.id)}
                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg h-8 w-8"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-100 group-hover:text-indigo-300 transition-colors text-base line-clamp-1">
                      {rubric.name}
                    </h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1 min-h-[2rem]">
                      {rubric.description || tr(language, "Không có mô tả.", "No description provided.")}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-800/80 mt-4 pt-4 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {new Date(rubric.created_at).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleStartGrading(rubric.id)}
                    className="bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white rounded-lg flex items-center gap-1 text-xs"
                  >
                    <GraduationCap className="h-3.5 w-3.5" />
                    {tr(language, "Chấm điểm nhóm", "Grade Group")}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Select Group Dialog */}
      <Dialog open={isSelectGroupOpen} onOpenChange={setIsSelectGroupOpen}>
        <DialogContent className="sm:max-w-[420px] bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 duration-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-tight bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-indigo-400" />
              {tr(language, "Chọn nhóm để chấm điểm", "Select Group to Grade")}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              {tr(
                language,
                "Vui lòng chọn nhóm sinh viên mà bạn muốn áp dụng thang chấm điểm này.",
                "Please choose the student group you want to apply this rubric on."
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-2">
            <label className="text-xs font-semibold text-slate-300">
              {tr(language, "Nhóm sinh viên", "Student Group")}
            </label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger className="w-full bg-slate-950 border-slate-800 rounded-xl text-slate-100 h-10">
                <SelectValue placeholder={tr(language, "Chọn nhóm...", "Select group...")} />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 border-slate-800 text-slate-100 rounded-xl">
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id} className="focus:bg-slate-900 rounded-lg">
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button
              variant="ghost"
              onClick={() => setIsSelectGroupOpen(false)}
              className="text-slate-400 hover:text-white rounded-xl"
            >
              {tr(language, "Hủy", "Cancel")}
            </Button>
            <Button
              onClick={proceedToGrading}
              disabled={!selectedGroupId}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20"
            >
              {tr(language, "Bắt đầu chấm", "Start Grading")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardShell>
  );
};

export default LecturerRubricsList;
