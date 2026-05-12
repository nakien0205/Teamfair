import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Users, ArrowRight, BarChart3, Brain, CheckCircle } from 'lucide-react';
import LanguageSwitcherButton from '@/components/LanguageSwitcherButton';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/lib/i18n';

const Landing = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();

  return (
    <div className="min-h-screen relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcherButton />
      </div>
      {/* Hero */}
      <header className="gradient-hero text-primary-foreground">
        <nav className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-7 w-7" />
            <span className="font-display text-xl font-bold tracking-tight">TEAMFAIR</span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => navigate('/start')}>
            {t(language, "landingStart")}
          </Button>
        </nav>

        <div className="container mx-auto px-6 py-24 md:py-32 text-center max-w-3xl">
          <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight mb-6">
            {t(language, "landingHeroTitle")}
            <br />
            <span className="opacity-80">{t(language, "landingHeroSubtitle")}</span>
          </h1>
          <p className="text-lg md:text-xl opacity-80 mb-10 max-w-xl mx-auto">
            {t(language, "landingHeroDescription")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" variant="secondary" className="text-base px-8" onClick={() => navigate('/start')}>
              {t(language, "landingGetStarted")} <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Features */}
      <section className="container mx-auto px-6 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: CheckCircle, title: 'Quản lý Task', desc: 'Tạo, giao và theo dõi tiến độ task của từng thành viên trong nhóm.' },
            { icon: BarChart3, title: 'Đóng góp realtime', desc: 'Tự động tính toán phần trăm đóng góp dựa trên task hoàn thành.' },
            { icon: Brain, title: 'AI Phân tích', desc: 'Phân tích sự cân bằng đóng góp và đề xuất cải thiện cho nhóm.' },
          ].map(f => (
            <div key={f.title} className="bg-card rounded-xl p-8 shadow-card hover:shadow-elevated transition-shadow duration-300">
              <div className="gradient-primary w-12 h-12 rounded-lg flex items-center justify-center mb-5">
                <f.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © 2026 TeamFair — Interactive MVP Demo
      </footer>
    </div>
  );
};

export default Landing;
