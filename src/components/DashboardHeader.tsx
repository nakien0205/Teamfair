import type { ReactNode } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, LogOut, Loader2 } from "lucide-react";
import LanguageSwitcherButton from "@/components/LanguageSwitcherButton";
import { NotificationMailIcon } from "@/components/NotificationMailIcon";
import { useLanguage } from "@/context/LanguageContext";
import { t } from "@/lib/i18n";

type DashboardRole = "student" | "lecturer";

interface Props {
  roleLabel: string;
  onExit: () => void | Promise<void>;
  onHomeClick?: () => void;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  roleValue?: DashboardRole;
  onRoleChange?: (role: DashboardRole) => void;
  showRoleSelect?: boolean;
}

const DashboardHeader = ({ roleLabel, onExit, onHomeClick, leftSlot, rightSlot, roleValue, onRoleChange, showRoleSelect }: Props) => {
  const { language } = useLanguage();
  const [isExiting, setIsExiting] = useState(false);

  const handleExit = async () => {
    setIsExiting(true);
    try {
      await onExit();
    } finally {
      setIsExiting(false);
    }
  };

  return (
    <header className="border-b bg-card/80 supports-[backdrop-filter]:bg-card/60 backdrop-blur">
      <div className="w-full px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* {leftSlot} */}
          {/* <div 
            className={`flex items-center gap-2 transition-opacity ${onHomeClick ? 'cursor-pointer hover:opacity-80' : ''}`}
            onClick={onHomeClick}
          >
            <Users className="h-6 w-6 text-primary" />
            <span className="font-display text-lg font-bold">TEAMFAIR</span>
            <span className="text-muted-foreground text-sm ml-2">/ {roleLabel}</span>
          </div> */}
        </div>
        <div className="flex items-center gap-2">
          {showRoleSelect !== false && roleValue && onRoleChange ? (
            <Select value={roleValue} onValueChange={onRoleChange}>
              <SelectTrigger className="h-9 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">{t(language, "student")}</SelectItem>
                <SelectItem value="lecturer">{t(language, "lecturer")}</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          {rightSlot}
          <NotificationMailIcon />
          <LanguageSwitcherButton />
          <Button variant="ghost" size="sm" onClick={handleExit} disabled={isExiting}>
            {isExiting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <LogOut className="h-4 w-4 mr-1" />}
            {t(language, "dashboardExit")}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
