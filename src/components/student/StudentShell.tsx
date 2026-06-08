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
import { t } from "@/lib/i18n";

type StudentNavKey =
  | "overview"
  | "my-group"
  | "my-tasks"
  | "work-logs"
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
  const { profile, signOut } = useAuth();
  const { groups, currentGroupIndex, currentUserName, studentRole } = useTeam();
  const { unreadCount } = useNotifications();

  const group = groups[currentGroupIndex] || groups[0];
  const sidebarItems: DashboardSidebarItem[] = [
    { key: "overview", label: "Tổng quan", icon: <Sparkles className="h-4 w-4" />, section: "student" },
    { key: "my-group", label: "Nhóm của tôi", icon: <Users className="h-4 w-4" />, section: "student" },
    { key: "my-tasks", label: "Task của tôi", icon: <FolderOpen className="h-4 w-4" />, section: "student" },
    { key: "work-logs", label: "Work log", icon: <ClipboardPenLine className="h-4 w-4" />, section: "student" },
    { key: "peer-review", label: "Đánh giá chéo", icon: <Star className="h-4 w-4" />, section: "personal" },
    { key: "contribution", label: "Điểm đóng góp", icon: <Sparkles className="h-4 w-4" />, section: "personal" },
    { key: "feedback", label: "Feedback", icon: <MessageSquareQuote className="h-4 w-4" />, section: "personal" },
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
    if (key === "my-tasks") return navigate("/student/my-tasks");
    if (key === "work-logs") return navigate("/student/work-logs");
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
            void (async () => {
              await signOut();
              navigate("/login", { replace: true });
            })();
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
