import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  BellRing,
  BookOpenText,
  ClipboardPenLine,
  FolderOpen,
  MessageSquareQuote,
  ShieldAlert,
  Sparkles,
  Star,
  Users,
} from "lucide-react";
import DashboardHeader from "@/components/DashboardHeader";
import DashboardShell from "@/components/DashboardShell";
import DashboardSidebar, { type DashboardSidebarItem } from "@/components/DashboardSidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications } from "@/context/NotificationContext";
import { useTeam } from "@/context/TeamContext";
import { t, tr } from "@/lib/i18n";

type StudentNavKey =
  | "overview"
  | "my-group"
  | "my-tasks"
  | "calendar"
  // | "work-logs"
  | "peer-review"
  | "contribution"
  | "feedback"
  | "appeals"
  | "team-management"
  | "projects";

interface Props {
  activeKey: StudentNavKey;
  children: ReactNode;
}

const StudentShell = ({ activeKey, children }: Props) => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { profile } = useAuth();
  const { groups, currentGroupIndex, currentUserName, studentRole } = useTeam();
  const { unreadCount } = useNotifications();

  const group = groups[currentGroupIndex] || groups[0];
  const sidebarItems: DashboardSidebarItem[] = [
    { key: "overview", label: tr(language, "Tổng quan", "Overview"), icon: <Sparkles className="h-4 w-4" />, section: "student" },    { key: "my-group", label: "Nhóm của tôi", icon: <Users className="h-4 w-4" />, section: "student" },
    { key: "calendar", label: tr(language, "Lịch dự án", "Project Calendar"), icon: <BellRing className="h-4 w-4" />, section: "student" },
    { key: "my-group", label: tr(language, "Nhóm của tôi", "My Group"), icon: <Users className="h-4 w-4" />, section: "student" },
    { key: "my-tasks", label: tr(language, "Task của tôi", "My Tasks"), icon: <FolderOpen className="h-4 w-4" />, section: "student" },
    // { key: "work-logs", label: tr(language, "Nhật ký làm việc", "Work Logs"), icon: <ClipboardPenLine className="h-4 w-4" />, section: "student" },
    { key: "peer-review", label: tr(language, "Đánh giá chéo", "Peer Review"), icon: <Star className="h-4 w-4" />, section: "personal" },
    { key: "contribution", label: tr(language, "Điểm đóng góp", "Contribution"), icon: <Sparkles className="h-4 w-4" />, section: "personal" },
    { key: "feedback", label: tr(language, "Phản hồi", "Feedback"), icon: <MessageSquareQuote className="h-4 w-4" />, section: "personal" },
    { key: "appeals", label: "Giải trình", icon: <ShieldAlert className="h-4 w-4" />, section: "personal" },
  ];

  if (studentRole === "Leader") {
    sidebarItems.push({
      key: "team-management",
      label: "Quản lý nhóm",
      icon: <Users className="h-4 w-4" />,
      section: "leader",
    });
  }

  sidebarItems.push({
    key: "projects",
    label: "Đổi dự án",
    icon: <BookOpenText className="h-4 w-4" />,
    section: "project",
  });

  const handleSelect = (key: string) => {
    if (key === "overview") return navigate("/student/dashboard");
    if (key === "my-group") return navigate("/student/my-group");
    if (key === "calendar") return navigate("/student/calendar");
    if (key === "my-tasks") return navigate("/student/my-tasks");
    // if (key === "work-logs") return navigate("/student/work-logs");
    if (key === "peer-review") return navigate("/student/peer-review");
    if (key === "contribution") return navigate("/student/my-contribution");
    if (key === "feedback") return navigate("/student/feedback");
    if (key === "appeals") return navigate("/student/appeals");
    if (key === "team-management") return navigate("/student/workspace");
    if (key === "projects") return navigate("/projects");
  };

  return (
    <DashboardShell
      sidebar={
        <DashboardSidebar
          title={t(language, "student")}
          subtitle={profile?.full_name || currentUserName}
          items={sidebarItems}
          activeKey={activeKey}
          onSelect={handleSelect}
        />
      }
      header={
        <DashboardHeader
          roleLabel={t(language, "student")}
          onExit={() => {
            navigate("/projects");
          }}
          leftSlot={<SidebarTrigger />}
          rightSlot={
            <div className="hidden items-center gap-2 lg:flex">
              
              {group?.name ? (
                <Badge variant="outline" className="border-border/70 bg-background/80 text-muted-foreground">
                  {group.name}
                </Badge>
              ) : null}
              {unreadCount > 0 ? (
                <Badge className="border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                  <BellRing className="mr-1 h-3 w-3" />
                  {unreadCount} chưa đọc
                </Badge>
                
              ) : null}
            </div>
          }
          showRoleSelect={false}
        />
      }
    >
      {children}
    </DashboardShell>
  );
};

export default StudentShell;
