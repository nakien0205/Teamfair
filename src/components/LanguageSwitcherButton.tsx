import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";

const LanguageSwitcherButton = ({ className }: { className?: string }) => {
  const { language, toggleLanguage } = useLanguage();

  const label = language === "vi" ? "EN" : "VI";

  return (
    <Button variant="outline" size="sm" className={className} onClick={toggleLanguage}>
      {label}
    </Button>
  );
};

export default LanguageSwitcherButton;

