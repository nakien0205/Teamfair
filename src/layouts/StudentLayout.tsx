import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { Sparkles, Users, FolderOpen, ClipboardPenLine, MessageSquareQuote, FileUp, BookOpenText, CheckCircle, Scale, Brain, ArrowRight, Share2 } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import DashboardSidebar, { DashboardSidebarItem } from "@/components/DashboardSidebar";
import DashboardHeader from "@/components/DashboardHeader";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/context/TeamContext";
import { useLanguage } from "@/context/LanguageContext";
import { t, tr } from "@/lib/i18n";
import { useState, useMemo } from "react"; 
import { useShareModalStore } from "@/hooks/useShareModalStore"; 
import { ShareProjectModal } from "@/pages/ShareProjectModal";

const LOGOUT_TRANSITION_MS = 420;

const StudentLayout = () => {
  const openShareModal = useShareModalStore((state) => state.openShareModal);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { currentUserName, studentRole, dataLoading } = useTeam();
  const { language } = useLanguage();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const isLeader = studentRole === "Leader";

  const handleLogout = async () => {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, LOGOUT_TRANSITION_MS));

    try {
      await signOut();
    } finally {
      navigate("/login", { replace: true });
    }
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
    if (key === "share-project") {
      console.log("1. Đã click nút Share trên Sidebar!");
      openShareModal();
      return; // CHẶN LẠI, không cho chạy xuống logic chuyển trang/đổi activeKey ở dưới
  }
    // if (dataLoading) return;

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

  // 🌟 Biến đổi mảng tĩnh thành mảng có khả năng phản ứng (Reactive) thông qua useMemo
  const processedSidebarItems = useMemo<DashboardSidebarItem[]>(() => {
    
    const items: DashboardSidebarItem[] = [
      // Workspace
      { key: "overview", label: tr(language, "Tổng quan", "Overview"), icon: <Sparkles className="h-4 w-4" />, section: "workspace" },
      { key: "my-group", label: tr(language, "Nhóm của tôi", "My Group"), icon: <Users className="h-4 w-4" />, section: "workspace" },
      { key: "tasks", label: tr(language, "Task của tôi", "My Tasks"), icon: <FolderOpen className="h-4 w-4" />, section: "workspace" },
      // { key: "work-logs", label: tr(language, "Nhật ký làm việc", "Work Logs"), icon: <ClipboardPenLine className="h-4 w-4" />, section: "workspace" },
      { key: "peer-review", label: tr(language, "Đánh giá chéo", "Peer Review"), icon: <MessageSquareQuote className="h-4 w-4" />, section: "workspace" },
      // { key: "my-contribution", label: tr(language, "Điểm đóng góp", "Contribution"), icon: <CheckCircle className="h-4 w-4" />, section: "workspace" },
      { key: "feedback", label: tr(language, "Phản hồi", "Feedback"), icon: <Scale className="h-4 w-4" />, section: "workspace" },
      // { key: "appeals", label: tr(language, "Giải trình", "Appeals"), icon: <Brain className="h-4 w-4" />, section: "workspace" },

      // Resources
      { key: "materials", label: tr(language, "Tài liệu", "Resources"), icon: <FileUp className="h-4 w-4" />, section: "resources" },

      // Other
      { key: "switch-projects", label: tr(language, "Đổi dự án", "Switch Projects"), icon: <BookOpenText className="h-4 w-4" />, section: "other" },
    ];

    // Đẩy thêm các mục của Leader vào mảng nếu user là Leader
    if (isLeader) {
      items.push(
        // { key: "leader-tasks", label: tr(language, "Quản lý task", "Manage Tasks"), icon: <FolderOpen className="h-4 w-4" />, section: "leader" },
        // { key: "leader-submissions", label: tr(language, "Duyệt submission", "Review Submissions"), icon: <CheckCircle className="h-4 w-4" />, section: "leader" },
        // { key: "leader-evaluations", label: tr(language, "Đánh giá thành viên", "Member Evaluations"), icon: <MessageSquareQuote className="h-4 w-4" />, section: "leader" },
        { key: "leader-progress", label: tr(language, "Báo cáo tiến độ", "Progress Report"), icon: <ArrowRight className="h-4 w-4" />, section: "leader" },
        { key: "share-project", label: tr(language, "Chia sẻ dự án", "Share Project"), icon: <Share2 className="h-4 w-4" />, section: "leader" },

      );
    }

    return items;
  }, [language, isLeader]); // 🌟 Lắng nghe sự thay đổi của language và quyền leader để tính toán lại text hoàn toàn sạch sẽ

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
              title={t(language, "student")}
              subtitle={currentUserName}
              items={processedSidebarItems} // 🌟 Đã đổi sang mảng đã xử lý đa ngôn ngữ mượt mà
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
          <Outlet />
        </DashboardShell>
        
      </div>
      <ShareProjectModal />
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-50 bg-background/70 backdrop-blur-[2px] transition-opacity duration-500 ${
          isLoggingOut ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
};

export default StudentLayout;