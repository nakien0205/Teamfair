import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { tr } from '@/lib/i18n';
import { useLanguage } from '@/context/LanguageContext';

const LecturerGroupsPage = () => {
  const { language } = useLanguage();

  return (
    <div className="space-y-6">
      <Card className="bg-card shadow-card border-border">
        <CardHeader>
          <CardTitle>{tr(language, 'Quản lý nhóm sinh viên', 'Manage Student Groups')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            {tr(language, 'Tính năng đang được phát triển.', 'Feature under development.')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LecturerGroupsPage;
