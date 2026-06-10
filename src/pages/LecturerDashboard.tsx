import { useState, useEffect } from 'react';
import { useTeam } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Brain, Save, ArrowRight, GraduationCap, Layers3, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ContributionAnalytics from '@/components/ContributionAnalytics';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { tr } from '@/lib/i18n';
import { LecturerDashboardSkeleton } from '@/components/skeletons';

const LecturerDashboard = () => {
  const { groups, currentGroupIndex, setCurrentGroupIndex, updateLecturerScore, currentUserName, dataLoading } = useTeam();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile, loading: authLoading, signOut } = useAuth();
  const { language } = useLanguage();

  const [editedScores, setEditedScores] = useState<Record<string, number>>({});
  const [unsaved, setUnsaved] = useState<Set<string>>(new Set());
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (authLoading || !profile) return;
    if (profile.role === "student") {
      navigate("/student/dashboard", { replace: true });
    }
  }, [profile, authLoading, navigate]);

  if (authLoading || dataLoading) {
    return <LecturerDashboardSkeleton />;
  }

  const group = groups[currentGroupIndex];
  if (!group) {
    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-white shadow-card">
          <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
            <div className="p-6 md:p-8">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">{tr(language, "Lecturer dashboard", "Lecturer Dashboard")}</span>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">
                  {tr(language, "Quản lý lớp, nhóm và điểm", "Manage classes, groups, and scores")}
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {tr(language, "Chưa có project nào để xem", "No project to show yet")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/80 md:text-base">
                {tr(
                  language,
                  "Hãy sang trang quản lý nhóm để tạo lớp, môn học hoặc project, sau đó mời người dùng bằng email. Khi đã có nhóm, dashboard sẽ tự hiển thị nhóm đang quản lý.",
                  "Go to the group management page to create a class, course, or project, then invite users by email. Once you have a group, the dashboard will show the one you are managing.",
                )}
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Button className="bg-white text-slate-950 hover:bg-slate-100" onClick={() => navigate("/lecturer/groups")}>
                  {tr(language, "Mở trang quản lý nhóm", "Open group management")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                  onClick={() => navigate("/lecturer/groups")}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {tr(language, "Tạo / import nhóm", "Create / import groups")}
                </Button>
              </div>
            </div>
            <div className="grid gap-3 bg-white/5 p-6 md:p-8 lg:border-l lg:border-white/10">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/10 p-2 text-white">
                    <GraduationCap className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{tr(language, "Lớp / môn / project", "Class / course / project")}</div>
                    <div className="text-xs text-slate-200/70">{tr(language, "Tạo mới trong trang quản lý nhóm", "Create them from group management")}</div>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-white/10 p-2 text-white">
                    <Layers3 className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{tr(language, "Danh sách nhóm", "Group list")}</div>
                    <div className="text-xs text-slate-200/70">{tr(language, "Chọn nhóm để chấm điểm và quản lý", "Pick a group to grade and manage")}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const baseScore = 10;

  const handleScoreChange = (name: string, val: string) => {
    const n = Math.min(10, Math.max(0, Number(val)));
    setEditedScores(p => ({ ...p, [name]: n }));
    setUnsaved(p => new Set(p).add(name));
  };

  const saveScore = (name: string) => {
    const score = editedScores[name] ?? 0;
    updateLecturerScore(name, score, currentGroupIndex);
    setUnsaved(p => { const s = new Set(p); s.delete(name); return s; });
    toast({ title: tr(language, 'Đã lưu điểm', 'Saved score'), description: tr(language, `${name}: ${score} điểm`, `${name}: ${score} points`) });
  };

  const runAI = () => {
    setAiLoading(true);
    setTimeout(() => {
      const lines: string[] = [];
      const m = group.members;
      const maxC = Math.max(...m.map(x => x.contributionPercent));
      const completedCount = group.tasks.filter(tk => tk.approved).length;
      const pending = group.tasks.filter(tk => tk.status === 'Done' && !tk.approved).length;

      if (maxC > 60) {
        lines.push(tr(language, '⚠️ Một thành viên chiếm hơn 60% đóng góp — mất cân bằng nghiêm trọng.', '⚠️ One member contributes more than 60% — serious imbalance.'));
      }
      m.forEach(x => {
        if (x.contributionPercent < 15 && x.contributionPercent >= 0 && m.length > 1) {
          lines.push(tr(language, `⚠️ ${x.name} đóng góp rất thấp (${x.contributionPercent}%).`, `⚠️ ${x.name} has very low contribution (${x.contributionPercent}%).`));
        }
      });
      if (completedCount === 0 && group.tasks.length > 0) {
        lines.push(tr(language, '🔴 Chưa có task nào được hoàn thành — nhóm cần đẩy nhanh tiến độ.', '🔴 No tasks have been completed — the group should move faster.'));
      }
      if (pending > 0) {
        lines.push(tr(language, `📋 ${pending} task chờ Leader duyệt.`, `📋 ${pending} Done tasks waiting for approval.`));
      }
      if (group.tasks.length === 0) {
        lines.push(tr(language, '📭 Nhóm chưa có task nào — cần lên kế hoạch.', '📭 The group has no tasks — needs planning.'));
      }
      if (lines.length === 0) {
        lines.push(tr(language, '✅ Nhóm hoạt động cân bằng và hiệu quả.', '✅ Balanced and effective group activity.'));
      }
      setAiResult(lines.join('\n'));
      setAiLoading(false);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-white shadow-card">
        <div className="grid gap-0 lg:grid-cols-[1.35fr_0.65fr]">
          <div className="p-6 md:p-8">
            <div className="mb-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">{tr(language, "Trang quản lí của Giảng Viên", "Lecturer Dashboard")}</span>
              <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">{tr(language, "Quản lý lớp, nhóm và điểm", "Class, Group, and Grading Management")}</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              {tr(language, "Điều hướng nhanh sang khu vực quản lý lớp, nhóm và điểm", "Quick navigation to class, group, and grading management")} 
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/80 md:text-base">
              {tr(language, "Màn dashboard này tập trung vào theo dõi nhóm hiện tại. Các thao tác tạo lớp, import danh sách nhóm và chấm điểm thành viên nằm ở trang quản lý riêng để dễ thao tác hơn.", "This dashboard focuses on monitoring the current group. Actions such as creating classes, importing group lists, and grading members are located on a separate management page for easier operation.")}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button className="bg-white text-slate-950 hover:bg-slate-100" onClick={() => navigate('/lecturer/groups')}>
                {tr(language, "Mở trang quản lý nhóm", "Open Group Management Page")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                onClick={() => navigate('/lecturer/groups')}
              >
                <Upload className="mr-2 h-4 w-4" />
                {tr(language, "Tạo / import nhóm", "Create / Import Groups")}
              </Button>
            </div>
          </div>
          <div className="grid gap-3 bg-white/5 p-6 md:p-8 lg:border-l lg:border-white/10">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/10 p-2 text-white">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Lớp / môn / project</div>
                  <div className="text-xs text-slate-200/70">Tạo mới trong trang quản lý nhóm</div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-white/10 p-2 text-white">
                  <Layers3 className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Nhập danh sách nhóm</div>
                  <div className="text-xs text-slate-200/70">Paste nhiều dòng để tạo hàng loạt</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex gap-3 flex-wrap">
        {groups.map((g, i) => (
          <button
            key={g.id}
            onClick={() => { setCurrentGroupIndex(i); setAiResult(null); setUnsaved(new Set()); setEditedScores({}); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${
              i === currentGroupIndex
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border hover:border-primary'
            }`}
          >
            {g.name}
          </button>
        ))}
      </div>

      <section className="bg-card rounded-xl shadow-card border border-border overflow-hidden">
        <div className="p-6 border-b border-border">
          <h2 className="font-display text-lg font-semibold">{tr(language, 'Bảng thành viên', 'Members table')} — {group.name}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="text-left px-4 py-3 font-medium">{tr(language, 'Thành viên', 'Member')}</th>
                <th className="text-left px-4 py-3 font-medium">{tr(language, 'Vai trò', 'Role')}</th>
                <th className="text-center px-4 py-3 font-medium">{tr(language, 'Task xong', 'Tasks done')}</th>
                <th className="text-center px-4 py-3 font-medium">{tr(language, 'Đóng góp', 'Contribution')}</th>
                <th className="text-center px-4 py-3 font-medium">{tr(language, 'Điểm đề xuất', 'Proposed score')}</th>
                <th className="text-center px-4 py-3 font-medium">{tr(language, 'Điểm GV', 'Lecturer score')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {group.members.map(m => {
                const suggested = (baseScore * m.contributionPercent / 100).toFixed(1);
                const isUnsaved = unsaved.has(m.name);
                return (
                  <tr key={m.name} className={`border-b border-border last:border-0 transition-colors ${isUnsaved ? 'bg-warning/10' : ''}`}>
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{m.role}</td>
                    <td className="px-4 py-3 text-center">{m.completedTasks}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-center">
                        <Progress value={m.contributionPercent} className="h-2 w-16" />
                        <span className="text-xs w-8 text-right">{m.contributionPercent}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">{suggested}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-center">
                        <Input
                          type="number"
                          min={0} max={10} step={0.5}
                          className="w-20 h-8 text-center text-sm"
                          value={editedScores[m.name] ?? m.lecturerScore ?? ''}
                          onChange={e => handleScoreChange(m.name, e.target.value)}
                          placeholder="—"
                        />
                        {isUnsaved && <span className="text-xs text-warning whitespace-nowrap">{tr(language, 'Chưa lưu', 'Not saved')}</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant="ghost" onClick={() => saveScore(m.name)} disabled={!isUnsaved}>
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid lg:grid-cols-2 gap-6">
        <section className="bg-card rounded-xl p-6 shadow-card border border-border">
          <h2 className="font-display text-lg font-semibold mb-4">{tr(language, 'Phân tích đóng góp', 'Contribution analytics')} — {group.name}</h2>
          <ContributionAnalytics
            members={group.members}
            showFreeriderWarning
          />
        </section>

        <section className="bg-card rounded-xl p-6 shadow-card border border-border">
          <h2 className="font-display text-lg font-semibold mb-4">{tr(language, 'AI Phân tích', 'AI Analysis')}</h2>
          <Button onClick={runAI} disabled={aiLoading} className="mb-4">
            <Brain className="h-4 w-4 mr-1" />
            {aiLoading ? tr(language, 'Đang phân tích...', 'Analyzing...') : tr(language, 'AI Phân tích nhóm', 'AI Group Analysis')}
          </Button>
          {aiResult && (
            <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-line leading-relaxed animate-in fade-in duration-300">
              {aiResult}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default LecturerDashboard;
