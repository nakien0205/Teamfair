import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { Sparkles, Users, FolderOpen, ClipboardPenLine, MessageSquareQuote, FileUp, BookOpenText, CheckCircle, Scale, Brain, ArrowRight } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import DashboardSidebar, { DashboardSidebarItem } from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/context/TeamContext";
import { useLanguage } from "@/context/LanguageContext";
import { t } from "@/lib/i18n";
import { useState } from "react";

const StudentLayout = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { currentUserName, studentRole, dataLoading } = useTeam();
  const { language } = useLanguage();
  const [isFadingOut, setIsFadingOut] = useState(false);

  const isLeader = studentRole === "Leader";

  const handleLogout = () => {
    setIsFadingOut(true);
    // Fade out animation (300ms) then navigate
    setTimeout(() => {
      navigate("/login", { replace: true });
      void signOut();
    }, 300);
  };

  // Determine active key from pathname
  let activeKey = "overview";
  if (pathname.includes("/student/my-group")) activeKey = "my-group";
  else if (pathname.includes("/student/my-tasks") || pathname.includes("/student/tasks/")) activeKey = "tasks";
  else if (pathname.includes("/student/work-logs")) activeKey = "work-logs";
  else if (pathname.includes("/student/peer-review")) activeKey = "peer-review";
  else if (pathname.includes("/student/my-contribution")) activeKey = "my-contribution";
  else if (pathname.includes("/student/feedback")) activeKey = "feedback";
  else if (pathname.includes("/student/appeals")) activeKey = "appeals";
  else if (pathname.includes("/student/documents")) activeKey = "materials";
  else if (pathname.includes("/leader/tasks")) activeKey = "leader-tasks";
  else if (pathname.includes("/leader/submissions")) activeKey = "leader-submissions";
  else if (pathname.includes("/leader/member-evaluations")) activeKey = "leader-evaluations";
  else if (pathname.includes("/leader/progress-report")) activeKey = "leader-progress";

  const handleSelect = (key: string) => {
    if (dataLoading) return;

    switch (key) {
      case "overview": navigate("/student/dashboard"); break;
      case "my-group": navigate("/student/my-group"); break;
      case "tasks": navigate("/student/my-tasks"); break;
      case "work-logs": navigate("/student/work-logs"); break;
      case "peer-review": navigate("/student/peer-review"); break;
      case "my-contribution": navigate("/student/my-contribution"); break;
      case "feedback": navigate("/student/feedback"); break;
      case "appeals": navigate("/student/appeals"); break;
      case "materials": navigate("/student/documents"); break;
      case "switch-projects": navigate("/projects"); break;
      case "leader-tasks": navigate("/leader/tasks"); break;
      case "leader-submissions": navigate("/leader/submissions"); break;
      case "leader-evaluations": navigate("/leader/member-evaluations"); break;
      case "leader-progress": navigate("/leader/progress-report"); break;
    }
  };

  const sidebarItems: DashboardSidebarItem[] = [
    // Workspace
    { key: "overview", label: "Tổng quan", icon: <Sparkles className="h-4 w-4" />, section: "workspace" },
    { key: "my-group", label: "Nhóm của tôi", icon: <Users className="h-4 w-4" />, section: "workspace" },
    { key: "tasks", label: "Task của tôi", icon: <FolderOpen className="h-4 w-4" />, section: "workspace" },
    { key: "work-logs", label: "Nhật ký làm việc", icon: <ClipboardPenLine className="h-4 w-4" />, section: "workspace" },
    { key: "peer-review", label: "Đánh giá chéo", icon: <MessageSquareQuote className="h-4 w-4" />, section: "workspace" },
    { key: "my-contribution", label: "Điểm đóng góp", icon: <CheckCircle className="h-4 w-4" />, section: "workspace" },
    { key: "feedback", label: "Phản hồi", icon: <Scale className="h-4 w-4" />, section: "workspace" },
    { key: "appeals", label: "Giải trình", icon: <Brain className="h-4 w-4" />, section: "workspace" },

    // Resources
    { key: "materials", label: "Tài liệu", icon: <FileUp className="h-4 w-4" />, section: "resources" },

    // Other
    { key: "switch-projects", label: "Đổi dự án", icon: <BookOpenText className="h-4 w-4" />, section: "other" },
  ];

  if (isLeader) {
    sidebarItems.push(
      { key: "leader-tasks", label: "Quản lý task", icon: <FolderOpen className="h-4 w-4" />, section: "leader" },
      { key: "leader-submissions", label: "Duyệt submission", icon: <CheckCircle className="h-4 w-4" />, section: "leader" },
      { key: "leader-evaluations", label: "Đánh giá thành viên", icon: <MessageSquareQuote className="h-4 w-4" />, section: "leader" },
      { key: "leader-progress", label: "Báo cáo tiến độ", icon: <ArrowRight className="h-4 w-4" />, section: "leader" }
    );
  }

  return (
    <DashboardShell
      sidebar={
        <DashboardSidebar
          title={t(language, "student")}
          subtitle={currentUserName}
          items={sidebarItems}
          activeKey={activeKey}
          onSelect={handleSelect}
        />
      }
      header={
        <DashboardHeader
          roleLabel={t(language, "student")}
          onExit={handleLogout}
          onHomeClick={() => navigate("/")}
          leftSlot={<SidebarTrigger />}
          showRoleSelect={false}
        />
      }
    >
      <div className={`transition-opacity duration-300 ${isFadingOut ? 'opacity-0' : 'opacity-100'}`}>
        <Outlet />
      </div>
    </DashboardShell>
  );
};

export default StudentLayout;
