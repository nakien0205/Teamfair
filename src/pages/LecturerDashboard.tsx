import { useState, useEffect } from 'react';
import { useTeam } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Brain, Clock, Save, LayoutDashboard, AlertTriangle, FileText, Activity, Download, ClipboardList, Star, Folder, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ContributionAnalytics from '@/components/ContributionAnalytics';
import DashboardHeader from '@/components/DashboardHeader';
import DashboardShell from '@/components/DashboardShell';
import DashboardSidebar from '@/components/DashboardSidebar';
import MaterialsSection from '@/components/MaterialsSection';
import LecturerReports from '@/components/LecturerReports';
import RubricManager from '@/components/RubricManager';
import ExportReport from '@/components/ExportReport';
import { SidebarTrigger } from '@/components/ui/sidebar';
import LecturerStudentEvaluationPanel from '@/components/feature-groups/LecturerStudentEvaluationPanel';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { t, tr } from '@/lib/i18n';
import { SettingsModal } from '@/components/SettingsModal';

const LecturerDashboard = () => {
  const { groups, currentGroupIndex, setCurrentGroupIndex, updateLecturerScore, currentUserName } = useTeam();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile, loading: authLoading, signOut } = useAuth();
  const { language } = useLanguage();

  const [editedScores, setEditedScores] = useState<Record<string, number>>({});
  const [unsaved, setUnsaved] = useState<Set<string>>(new Set());
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('overview');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (authLoading || !profile) return;
    if (profile.role === "student") {
      navigate("/dashboard-student", { replace: true });
    }
  }, [profile, authLoading, navigate]);

  const group = groups[currentGroupIndex];
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
    <DashboardShell
      sidebar={
        <DashboardSidebar
          title={tr(language, "Giảng viên", "Lecturer")}
          subtitle={currentUserName}
          items={[
            { key: 'overview', label: tr(language, 'Tổng quan', 'Overview'), icon: <LayoutDashboard /> },
            { key: 'reports', label: tr(language, 'Báo cáo', 'Reports'), icon: <AlertTriangle /> },
            { key: 'rubric', label: tr(language, 'Thang chấm điểm', 'Rubric'), icon: <ClipboardList /> },
            { key: 'studentEvaluation', label: t(language, 'lecturerStudentEvaluationTitle'), icon: <Star className="h-4 w-4 text-primary" /> },
            { key: 'export', label: tr(language, 'Xuất báo cáo', 'Export report'), icon: <Download /> },
            { key: 'materials', label: tr(language, 'Tài liệu', 'Materials'), icon: <FileText /> },
            { key: 'activity', label: tr(language, 'Hoạt động', 'Activity'), icon: <Activity /> },
            { key: 'settings', label: tr(language, 'Cấu hình', 'Settings'), icon: <Settings className="h-4 w-4" /> },
            { key: 'switch-projects', label: tr(language, 'Đổi dự án', 'Switch Projects'), icon: <Folder className="h-4 w-4" /> },
          ]}
          activeKey={activeSection}
          onSelect={(key) => {
            if (key === 'switch-projects') {
              navigate('/projects');
            } else if (key === 'settings') {
              setIsSettingsOpen(true);
            } else {
              setActiveSection(key);
            }
          }}
        />
      }
      header={
        <DashboardHeader
          roleLabel={t(language, 'lecturer')}
          onExit={() => {
            void signOut();
            navigate("/login");
          }}
          leftSlot={<SidebarTrigger />}
          showRoleSelect={false}
        />
      }
    >
      <div className="container mx-auto px-6 py-6 max-w-6xl space-y-6">
        {activeSection === 'overview' ? (
          <div className="space-y-6">
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
        ) : null}

        {activeSection === 'reports' ? (
          <div className="space-y-6">
            <LecturerReports />
          </div>
        ) : null}

        {activeSection === 'rubric' ? (
          <div className="space-y-6">
            <RubricManager />
          </div>
        ) : null}

        {activeSection === 'studentEvaluation' ? (
          <div className="space-y-6">
            <LecturerStudentEvaluationPanel />
          </div>
        ) : null}

        {activeSection === 'export' ? (
          <div className="space-y-6">
            <ExportReport />
          </div>
        ) : null}

        {activeSection === 'materials' ? (
          <div className="space-y-6">
            <MaterialsSection role="lecturer" uploaderName="Lecturer" />
          </div>
        ) : null}

        {activeSection === 'activity' ? (
          <div className="space-y-6">
            <section className="bg-card rounded-xl p-6 shadow-card border border-border">
              <h2 className="font-display text-lg font-semibold mb-4">
                <Clock className="h-5 w-5 inline mr-1" />
                {tr(language, 'Nhật ký hoạt động', 'Activity log')}
              </h2>
              <div className="space-y-2 max-h-[520px] overflow-y-auto">
                {group.activityLog.map(log => (
                  <div key={log.timestamp.getTime()} className="flex gap-3 items-start text-sm py-2 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap min-w-[4.5rem]">
                      {log.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span>{log.description}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
        <SettingsModal open={isSettingsOpen} onOpenChange={setIsSettingsOpen} />
      </div>
    </DashboardShell>
  );
};

export default LecturerDashboard;
