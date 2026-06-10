import { tr } from "@/lib/i18n";
import { useLanguage } from "@/context/LanguageContext";

const StudentDocuments = () => {
  const { language } = useLanguage();
  return (
    <div className="container mx-auto px-6 py-6 max-w-6xl space-y-6">
      <h1 className="text-2xl font-semibold">{tr(language, "Tài liệu", "Documents")}</h1>
      <p className="text-muted-foreground">{tr(language, "Tính năng quản lý tài liệu đang được phát triển.", "The document management feature is currently under development.")}</p>
    </div>
  );
};
export default StudentDocuments;
