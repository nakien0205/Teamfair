import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { 
  LayoutDashboard, 
  Users, 
  BarChart, 
  AlertTriangle, 
  ClipboardList, 
  Star, 
  CheckCircle, 
  Download, 
  FileText, 
  Activity, 
  Settings, 
  Folder 
} from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import DashboardSidebar, { DashboardSidebarItem } from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam } from "@/context/TeamContext";
import { t, tr } from "@/lib/i18n";
import { useState, useMemo } from "react"; 
import { SettingsModal } from "@/components/SettingsModal";

const LOGOUT_TRANSITION_MS = 420;

const LecturerLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { dataLoading } = useTeam();
  const { language } = useLanguage();

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleExit = () => {
    navigate("/projects");
  };

  // Compute Display Name fallback logic: full_name > email > short uuid
  const displayName = profile?.full_name 
    ? profile.full_name 
    : profile?.email 
      ? profile.email 
      : profile?.id 
        ? profile.id.substring(0, 8) 
        : "Lecturer";

  // Determine active key from pathname
  let activeKey = "overview";
  if (pathname.includes("/lecturer/groups")) activeKey = "groups";
  else if (pathname.includes("/lecturer/progress")) activeKey = "progress";
  else if (pathname.includes("/lecturer/reports")) activeKey = "reports";
  else if (pathname.includes("/lecturer/rubrics") || pathname.includes("/lecturer/grading")) activeKey = "rubrics";
  else if (pathname.includes("/lecturer/student-evaluations")) activeKey = "student-evaluations";
  else if (pathname.includes("/lecturer/contribution")) activeKey = "contribution";
  else if (pathname.includes("/lecturer/export-reports")) activeKey = "export-reports";
  else if (pathname.includes("/lecturer/documents")) activeKey = "documents";
  else if (pathname.includes("/lecturer/activity")) activeKey = "activity";

  const handleSelect = (key: string) => {
    if (dataLoading) return;

    switch (key) {
      case "overview": navigate("/lecturer/dashboard"); break;
      case "groups": navigate("/lecturer/groups"); break;
      case "progress": navigate("/lecturer/progress"); break;
      case "reports": navigate("/lecturer/reports"); break;
      case "rubrics": navigate("/lecturer/rubrics"); break;
      case "student-evaluations": navigate("/lecturer/student-evaluations"); break;
      case "contribution": navigate("/lecturer/contribution"); break;
      case "export-reports": navigate("/lecturer/export-reports"); break;
      case "documents": navigate("/lecturer/documents"); break;
      case "activity": navigate("/lecturer/activity"); break;
      case "settings": setIsSettingsOpen(true); break;
      case "switch-projects": navigate("/projects"); break;
    }
  };

  // 🌟 Bản sao hoàn hảo theo cấu trúc của StudentLayout
  const processedSidebarItems = useMemo<DashboardSidebarItem[]>(() => {
    const items: DashboardSidebarItem[] = [
      // Workspace
      { key: "overview", label: tr(language, "Tổng quan", "Overview"), icon: <LayoutDashboard className="h-4 w-4" />, section: "workspace" },
      { key: "groups", label: tr(language, "Nhóm sinh viên", "Student Groups"), icon: <Users className="h-4 w-4" />, section: "workspace" },
      // { key: "progress", label: tr(language, "Tiến độ nhóm", "Group Progress"), icon: <BarChart className="h-4 w-4" />, section: "workspace" },
      // { key: "reports", label: tr(language, "Báo cáo", "Reports"), icon: <AlertTriangle className="h-4 w-4" />, section: "workspace" },

      // Evaluation (Đánh giá)
      { key: "rubrics", label: tr(language, "Thang chấm điểm", "Rubrics"), icon: <ClipboardList className="h-4 w-4" />, section: "workspace" },
      // { key: "student-evaluations", label: tr(language, "Đánh giá sinh viên", "Student Evaluations"), icon: <Star className="h-4 w-4" />, section: "workspace" },
      { key: "contribution", label: tr(language, "Điểm đóng góp", "Contribution"), icon: <CheckCircle className="h-4 w-4" />, section: "workspace" },
      { key: "export-reports", label: tr(language, "Xuất báo cáo", "Export Reports"), icon: <Download className="h-4 w-4" />, section: "workspace" },

      // Resources
      { key: "documents", label: tr(language, "Tài liệu", "Documents"), icon: <FileText className="h-4 w-4" />, section: "resources" },
      { key: "activity", label: tr(language, "Hoạt động", "Activity"), icon: <Activity className="h-4 w-4" />, section: "resources" },

      // Settings (Other)
      { key: "settings", label: tr(language, "Cấu hình", "Settings"), icon: <Settings className="h-4 w-4" />, section: "other" },
      { key: "switch-projects", label: tr(language, "Đổi dự án", "Switch Projects"), icon: <Folder className="h-4 w-4" />, section: "other" },
    ];

    // Vì Giảng viên hiển thị cố định không phân quyền leader nên ta return thẳng items luôn
    return items;
  }, [language]); 

  return (
    <div className="relative min-h-svh">
      <div
        className={`relative min-h-svh overflow-hidden transition-opacity duration-500 ease-out ${
          isLoggingOut ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <DashboardShell
          sidebar={
            <DashboardSidebar
              title={t(language, "lecturer")}
              subtitle={displayName}
              items={processedSidebarItems}
              activeKey={activeKey}
              onSelect={handleSelect}
            />
          }
          header={
            <DashboardHeader
              roleLabel={t(language, "lecturer")}
              onExit={handleExit}
              onHomeClick={() => navigate("/")}
              leftSlot={<SidebarTrigger />}
              showRoleSelect={false}
            />
          }
        >
          <div className="container mx-auto max-w-7xl space-y-6 px-6 py-6 transition-opacity duration-300">
            <Outlet />
          </div>
          <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
        </DashboardShell>
      </div>
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-50 bg-background/70 backdrop-blur-[2px] transition-opacity duration-500 ${
          isLoggingOut ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
};

export default LecturerLayout;