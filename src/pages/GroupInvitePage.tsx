import { GroupInviteManager } from "./GroupInviteManager";
import { useTeam } from "@/context/TeamContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

export default function GroupInvitePage() {
  // Tránh lỗi TypeScript bắt bẻ property bằng cách tạm thời ép kiểu context
  const teamContext = useTeam();
  const { user } = useAuth();
  const { language } = useLanguage();

  const activeGroup = teamContext.groups && typeof teamContext.currentGroupIndex === "number"
    ? teamContext.groups[teamContext.currentGroupIndex] || null
    : null;

  if (!user) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground animate-pulse">
        Đang tải thông tin tài khoản...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <GroupInviteManager 
        selectedGroup={activeGroup} 
        user={user} 
        language={language} 
      />
    </div>
  );
}