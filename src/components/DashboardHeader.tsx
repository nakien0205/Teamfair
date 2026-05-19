import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, LogOut } from "lucide-react";
import LanguageSwitcherButton from "@/components/LanguageSwitcherButton";
import { useLanguage } from "@/context/LanguageContext";
import { t } from "@/lib/i18n";

type DashboardRole = "student" | "lecturer";

interface Props {
  roleLabel: string;
  onExit: () => void;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
  roleValue?: DashboardRole;
  onRoleChange?: (role: DashboardRole) => void;
  showRoleSelect?: boolean;
}

const DashboardHeader = ({ roleLabel, onExit, leftSlot, rightSlot, roleValue, onRoleChange, showRoleSelect }: Props) => {
  const { language } = useLanguage();

  return (
    <header className="border-b bg-card/80 supports-[backdrop-filter]:bg-card/60 backdrop-blur">
      <div className="w-full px-4 md:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {leftSlot}
          <Users className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-bold">TEAMFAIR</span>
          <span className="text-muted-foreground text-sm ml-2">/ {roleLabel}</span>
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
          <LanguageSwitcherButton />
          <Button variant="ghost" size="sm" onClick={onExit}>
            <LogOut className="h-4 w-4 mr-1" /> {t(language, "dashboardExit")}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
