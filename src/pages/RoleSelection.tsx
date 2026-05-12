import { useNavigate } from 'react-router-dom';
import { GraduationCap, BookOpen, Users } from 'lucide-react';
import LanguageSwitcherButton from '@/components/LanguageSwitcherButton';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/lib/i18n';

const RoleSelection = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcherButton />
      </div>
      <div className="w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Users className="h-7 w-7 text-primary" />
            <span className="font-display text-2xl font-bold">TEAMFAIR</span>
          </div>
          <h1 className="font-display text-2xl font-bold mb-2">{t(language, "roleSelectionTitle")}</h1>
          <p className="text-muted-foreground">{t(language, "roleSelectionSubtitle")}</p>
        </div>

        <div className="grid gap-4">
          <button
            onClick={() => navigate('/login?role=student')}
            className="bg-card rounded-xl p-6 shadow-card hover:shadow-elevated transition-all duration-300 text-left group border border-border hover:border-primary"
          >
            <div className="flex items-start gap-4">
              <div className="gradient-primary w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <GraduationCap className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-lg mb-1">{t(language, "studentCardTitle")}</h3>
                <p className="text-muted-foreground text-sm">{t(language, "studentCardDesc")}</p>
              </div>
            </div>
          </button>

          <button
            onClick={() => navigate('/login?role=lecturer')}
            className="bg-card rounded-xl p-6 shadow-card hover:shadow-elevated transition-all duration-300 text-left group border border-border hover:border-primary"
          >
            <div className="flex items-start gap-4">
              <div className="bg-secondary w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <h3 className="font-display font-semibold text-lg mb-1">{t(language, "lecturerCardTitle")}</h3>
                <p className="text-muted-foreground text-sm">{t(language, "lecturerCardDesc")}</p>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default RoleSelection;
