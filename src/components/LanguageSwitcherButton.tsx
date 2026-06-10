import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

const LanguageSwitcherButton = ({ className }: { className?: string }) => {
  const { language, toggleLanguage } = useLanguage();

  const label = language === "vi" ? "EN" : "VI";

  return (
    <Button variant="outline" size="sm" className={`bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:text-slate-900 ${className || ''}`} onClick={toggleLanguage}>
      {label}
    </Button>
  );
};

export default LanguageSwitcherButton;

