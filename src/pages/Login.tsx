import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, Loader2 } from 'lucide-react';
import LanguageSwitcherButton from '@/components/LanguageSwitcherButton';
import { useLanguage } from '@/context/LanguageContext';
import { t } from '@/lib/i18n';

const Login = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const role = params.get('role') || 'student';
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const redirect = role === 'lecturer' ? '/dashboard-lecturer' : '/dashboard-student';

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate(redirect);
    }, 1000);
  };

  const handleDemo = (demoRole: 'student' | 'lecturer') => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate(demoRole === 'lecturer' ? '/dashboard-lecturer' : '/dashboard-student');
    }, 500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative">
      <div className="absolute top-4 right-4">
        <LanguageSwitcherButton />
      </div>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Users className="h-7 w-7 text-primary" />
            <span className="font-display text-2xl font-bold">TEAMFAIR</span>
          </div>
          <h1 className="font-display text-xl font-bold mb-1">{t(language, "loginTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {t(language, "loginRoleLabel")}: {role === 'lecturer' ? t(language, "lecturer") : t(language, "student")}
          </p>
        </div>

        <form onSubmit={handleLogin} className="bg-card rounded-xl p-6 shadow-card space-y-4 border border-border">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="email@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Đăng nhập
          </Button>
        </form>

        <div className="mt-6 space-y-3">
          <p className="text-center text-sm text-muted-foreground">{language === "vi" ? "Hoặc trải nghiệm demo" : "Or try the demo"}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" onClick={() => handleDemo('student')} disabled={loading}>
              {t(language, "demoStudent")}
            </Button>
            <Button variant="outline" onClick={() => handleDemo('lecturer')} disabled={loading}>
              {t(language, "demoLecturer")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
