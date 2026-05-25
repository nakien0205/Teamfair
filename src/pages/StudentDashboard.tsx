import { useState, useEffect } from 'react';
import { useTeam, Task, MemberStat } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, CheckCircle, Play, Brain, ArrowLeftRight, Clock, Star, Flag, LayoutGrid, CalendarDays, Scale, FileText, Activity, Sparkles, Folder } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ContributionAnalytics from '@/components/ContributionAnalytics';
import DashboardHeader from '@/components/DashboardHeader';
import DashboardShell from '@/components/DashboardShell';
import DashboardSidebar from '@/components/DashboardSidebar';
import MaterialsSection from '@/components/MaterialsSection';
import StudentReportModal from '@/components/StudentReportModal';
import KanbanBoard from '@/components/KanbanBoard';
import ProjectCalendar from '@/components/ProjectCalendar';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { isDemoSession } from '@/lib/demoSession';
import { t, tr } from '@/lib/i18n';
import StudentAgentSidebar, { type LockedSection } from '@/components/feature-groups/StudentAgentSidebar';
import VerifiedBadgesSection from '@/components/feature-groups/VerifiedBadgesSection';
import { useNotifications } from '@/context/NotificationContext';
import { Checkbox } from '@/components/ui/checkbox';

const CURRENT_USER_MEMBER = 'Trần Thị B';

interface PeerEvaluation {
  from: string;
  to: string;
  id: string;
  rating: number;
  comment: string;
  timestamp: Date;
}

const StudentDashboard = () => {
  const { tasks, members, activityLog, addTask, deleteTask, updateTaskStatus, approveTask, studentRole, setStudentRole, currentUserName } = useTeam();
  const { toast } = useToast();
  const { sendNotification } = useNotifications();
  const navigate = useNavigate();
  const { profile, loading: authLoading, signOut } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', assignedTo: '', contributionPercent: 10, deadline: '' });
  const [notifyTeam, setNotifyTeam] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [peerEvaluations, setPeerEvaluations] = useState<PeerEvaluation[]>([]);
  const { language } = useLanguage();

  const [evalTarget, setEvalTarget] = useState('');
  const [evalRating, setEvalRating] = useState(0);
  const [evalComment, setEvalComment] = useState('');
  const [reportOpen, setReportOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<MemberStat | null>(null);
  const [activeSection, setActiveSection] = useState('work');
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [lockedSection, setLockedSection] = useState<LockedSection>(null);
  const anonymousFrom = t(language, 'anonymousFrom');

  useEffect(() => {
    if (isDemoSession()) return;
    if (authLoading || !profile) return;
    if (profile.role === "lecturer" || profile.role === "admin") {
      navigate("/dashboard-lecturer", { replace: true });
    }
  }, [profile, authLoading, navigate]);

  const isLeader = studentRole === 'Leader';
  const visibleTasks = isLeader ? tasks : tasks.filter(t => t.assignedTo === currentUserName);
  const kanbanUser = isLeader ? (members[0]?.name || currentUserName) : currentUserName;

  const handleSubmitEval = () => {
    if (!evalTarget || evalRating === 0) {
      toast({ title: tr(language, 'Lỗi', 'Error'), description: tr(language, 'Vui lòng chọn thành viên và đánh giá sao', 'Please pick a member and choose a star rating'), variant: 'destructive' });
      return;
    }
    const evalId = Date.now().toString();
    const now = new Date();
    setPeerEvaluations(prev => [...prev, { from: 'Anonymous', to: evalTarget, id: evalId, rating: evalRating, comment: evalComment, timestamp: now }]);
    toast({ title: tr(language, 'Đã gửi đánh giá', 'Evaluation sent'), description: tr(language, `Đánh giá ${evalTarget}: ${evalRating} sao`, `Evaluation for ${evalTarget}: ${evalRating} stars`) });
    setEvalTarget('');
    setEvalRating(0);
    setEvalComment('');
  };

  const getAverageRatings = () => {
    const map: Record<string, { total: number; count: number }> = {};
    peerEvaluations.forEach(e => {
      if (!map[e.to]) map[e.to] = { total: 0, count: 0 };
      map[e.to].total += e.rating;
      map[e.to].count += 1;
    });
    return Object.entries(map).map(([name, { total, count }]) => ({ name, avg: total / count, count }));
  };

  const handleCreateTask = () => {
    if (!newTask.name || !newTask.assignedTo) return;
    addTask(newTask);
    if (notifyTeam) {
      members
        .filter(m => m.name !== currentUserName)
        .forEach(member => {
          void sendNotification(
            member.id || member.name,
            currentUserName,
            tr(
              language,
              `Đã giao task mới: "${newTask.name}"`,
              `Assigned a new task: "${newTask.name}"`
            )
          );
        });
    }
    setNewTask({ name: '', assignedTo: '', contributionPercent: 10, deadline: '' });
    setNotifyTeam(false);
    setModalOpen(false);
    toast({ title: tr(language, 'Task đã tạo', 'Task created'), description: tr(language, `"${newTask.name}" giao cho ${newTask.assignedTo}`, `"${newTask.name}" assigned to ${newTask.assignedTo}`) });
  };

  const handleDelete = (t: Task) => {
    deleteTask(t.id);
    toast({ title: tr(language, 'Đã xóa', 'Deleted'), description: tr(language, `Task "${t.name}" đã bị xóa`, `Task "${t.name}" has been deleted`) });
  };

  const handleStatusChange = (t: Task, status: Task['status']) => {
    updateTaskStatus(t.id, status, isLeader ? 'Leader' : currentUserName);
    toast({
      title: tr(language, 'Cập nhật', 'Updated'),
      description: tr(language, `"${t.name}" → ${status}`, `"${t.name}" → ${status}`),
    });
  };

  const handleApprove = (t: Task) => {
    approveTask(t.id);
    toast({ title: tr(language, 'Đã duyệt', 'Approved'), description: tr(language, `Task "${t.name}" đã được approve`, `Task "${t.name}" has been approved`) });
  };

  const getContributionExtremes = () => {
    let maxContrib = -Infinity;
    let minContrib = Infinity;
    for (const m of members) {
      if (m.contributionPercent > maxContrib) maxContrib = m.contributionPercent;
      if (m.contributionPercent < minContrib) minContrib = m.contributionPercent;
    }
    return { maxContrib, minContrib };
  };

  const countPendingApprovals = () => {
    let pendingApprovalCount = 0;
    for (const tk of tasks) {
      if (tk.status === 'Done' && !tk.approved) pendingApprovalCount += 1;
    }
    return pendingApprovalCount;
  };

  const getNoTasksMembers = () => {
    const noTasksMembers: string[] = [];
    for (const m of members) {
      let hasTask = false;
      for (const tk of tasks) {
        if (tk.assignedTo === m.name) {
          hasTask = true;
          break;
        }
      }
      if (!hasTask) noTasksMembers.push(m.name);
    }
    return noTasksMembers;
  };

  const getLowContributionLines = () => {
    const lines: string[] = [];
    for (const m of members) {
      if (m.contributionPercent < 20 && m.contributionPercent > 0) {
        lines.push(`⚠️ ${m.name} chỉ đóng góp ${m.contributionPercent}% — cần tham gia nhiều hơn.`);
      }
    }
    return lines;
  };

  const buildAiLines = () => {
    const lines: string[] = [];
    const { maxContrib, minContrib } = getContributionExtremes();

    if (maxContrib - minContrib > 40) {
      lines.push('⚠️ Mất cân bằng đóng góp nghiêm trọng! Một thành viên đóng góp quá nhiều so với người khác.');
    }

    lines.push(...getLowContributionLines());

    const pendingApprovalCount = countPendingApprovals();
    if (pendingApprovalCount > 0) {
      lines.push(`📋 Có ${pendingApprovalCount} task chờ duyệt — Leader nên review sớm.`);
    }

    const noTasksMembers = getNoTasksMembers();
    if (noTasksMembers.length > 0) {
      lines.push(`🔍 ${noTasksMembers.join(', ')} chưa được giao task nào.`);
    }

    if (lines.length === 0) {
      lines.push('✅ Nhóm hoạt động tốt! Đóng góp khá cân bằng giữa các thành viên.');
    }

    return lines;
  };

  const runAI = () => {
    setAiLoading(true);
    setTimeout(() => {
      const lines = buildAiLines();
      setAiResult(lines.join('\n'));
      setAiLoading(false);
    }, 1000);
  };

  const statusColor = (s: string) => {
    if (s === 'Done') return 'bg-success text-success-foreground';
    if (s === 'In Progress') return 'bg-accent text-accent-foreground';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <DashboardShell
      sidebar={
        <DashboardSidebar
          title={tr(language, "Sinh viên", "Student")}
          subtitle={isDemoSession() ? tr(language, "Student workspace", "Student workspace") : currentUserName}
          items={[
            { key: 'work', label: tr(language, 'Công việc', 'Work'), icon: <LayoutGrid /> },
            { key: 'calendar', label: tr(language, 'Lịch', 'Calendar'), icon: <CalendarDays /> },
            { key: 'fairness', label: tr(language, 'Đánh giá', 'Evaluation'), icon: <Scale /> },
            { key: 'materials', label: tr(language, 'Tài liệu', 'Materials'), icon: <FileText /> },
            { key: 'verifiedBadges', label: t(language, 'verifiedBadgesTitle'), icon: <CheckCircle className="h-4 w-4 text-primary" /> },
            { key: 'activity', label: tr(language, 'Hoạt động', 'Activity'), icon: <Activity /> },
            { key: 'switch-projects', label: tr(language, 'Đổi dự án', 'Switch Projects'), icon: <Folder className="h-4 w-4" /> },
          ]}
          activeKey={activeSection}
          onSelect={(key) => {
            if (key === 'switch-projects') {
              navigate('/projects');
            } else {
              setActiveSection(key);
            }
          }}
          roleValue="student"
          onRoleChange={r => navigate(r === 'student' ? '/dashboard-student' : '/dashboard-lecturer')}
        />
      }
      header={
        <DashboardHeader
          roleLabel={t(language, 'student')}
          onExit={() => {
            void signOut();
            navigate("/login");
          }}
          leftSlot={<SidebarTrigger />}
          rightSlot={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAiSidebarOpen(true)}
              aria-label={tr(language, 'Mở trợ lý AI workspace', 'Open workspace AI assistant')}
              className="gap-1.5"
            >
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline text-xs">AI</span>
            </Button>
          }
          showRoleSelect={false}
        />
      }
    >
      <div className="container mx-auto px-6 py-6 max-w-6xl space-y-6">
        {isDemoSession() && (
          <div className="bg-card rounded-xl p-4 shadow-card border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">{tr(language, 'Vai trò hiện tại', 'Current role')}</p>
              <p className="font-display font-semibold text-lg">{studentRole}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              const next = isLeader ? 'Member' : 'Leader';
              setStudentRole(next);
              toast({ title: tr(language, 'Đã chuyển vai trò', 'Role changed'), description: tr(language, `Bạn giờ là ${next}`, `You are now ${next}`) });
            }}>
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              {tr(language, `Chuyển sang ${isLeader ? 'Member' : 'Leader'} (Demo)`, `Switch to ${isLeader ? 'Member' : 'Leader'} (Demo)`) }
            </Button>
          </div>
        )}

        {activeSection === 'work' ? (
          <div className="space-y-6">
            <KanbanBoard isLeader={isLeader} currentUser={kanbanUser} locked={lockedSection === 'work'} />

            <section className="bg-card rounded-xl p-6 shadow-card border border-border">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-lg font-semibold">{tr(language, 'Danh sách Task', 'Task list')}</h2>
                {isLeader && (
                  <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {tr(language, 'Tạo Task', 'Create Task')}</Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>{tr(language, 'Tạo Task mới', 'Create a new task')}</DialogTitle></DialogHeader>
                      <div className="space-y-4 pt-2">
                        <div className="space-y-1">
                          <Label>{tr(language, 'Tên task', 'Task name')}</Label>
                          <Input value={newTask.name} onChange={e => setNewTask(p => ({ ...p, name: e.target.value }))} placeholder="Nhập tên task" />
                        </div>
                        <div className="space-y-1">
                          <Label>{tr(language, 'Giao cho', 'Assign to')}</Label>
                          <Select value={newTask.assignedTo} onValueChange={v => setNewTask(p => ({ ...p, assignedTo: v }))}>
                            <SelectTrigger><SelectValue placeholder={tr(language, 'Chọn thành viên', 'Pick a member')} /></SelectTrigger>
                            <SelectContent>
                              {members.map(m => <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>{tr(language, 'Đóng góp (%)', 'Contribution (%)')}</Label>
                          <Input type="number" min={1} max={100} value={newTask.contributionPercent} onChange={e => setNewTask(p => ({ ...p, contributionPercent: Number(e.target.value) }))} />
                        </div>
                        <div className="space-y-1">
                          <Label>{tr(language, 'Deadline', 'Deadline')}</Label>
                          <Input type="date" value={newTask.deadline} onChange={e => setNewTask(p => ({ ...p, deadline: e.target.value }))} />
                        </div>
                        <div className="flex items-center space-x-2 py-2">
                          <Checkbox
                            id="notifyTeam"
                            checked={notifyTeam}
                            onCheckedChange={(checked) => setNotifyTeam(!!checked)}
                          />
                          <Label htmlFor="notifyTeam" className="text-xs sm:text-sm font-medium leading-none cursor-pointer">
                            {tr(language, "Thông báo cho thành viên nhóm", "Notify team members")}
                          </Label>
                        </div>
                        <Button className="w-full" onClick={handleCreateTask}>{tr(language, 'Tạo Task', 'Create task')}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>

              {visibleTasks.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">{tr(language, 'Chưa có task nào', 'No tasks yet')}</p>
              ) : (
                <div className="space-y-3">
                  {visibleTasks.map(t => (
                    <div key={t.id} className="border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {t.assignedTo} · {t.contributionPercent}% · {t.deadline}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor(t.status)}`}>
                          {t.status}
                        </span>
                        {t.approved && <span className="text-xs px-2.5 py-1 rounded-full bg-success text-success-foreground font-medium">Approved</span>}

                        {!isLeader && t.status === 'Todo' && (
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(t, 'In Progress')}>
                            <Play className="h-3 w-3 mr-1" /> {tr(language, 'Bắt đầu', 'Start')}
                          </Button>
                        )}
                        {!isLeader && t.status === 'In Progress' && (
                          <Button size="sm" variant="outline" onClick={() => handleStatusChange(t, 'Done')}>
                            <CheckCircle className="h-3 w-3 mr-1" /> {tr(language, 'Hoàn thành', 'Mark Done')}
                          </Button>
                        )}

                        {isLeader && t.status === 'Done' && !t.approved && (
                          <Button size="sm" onClick={() => handleApprove(t)}>
                            <CheckCircle className="h-3 w-3 mr-1" /> {tr(language, 'Duyệt', 'Approve')}
                          </Button>
                        )}
                        {isLeader && (
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(t)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {activeSection === 'calendar' ? (
          <div className="space-y-6">
            <ProjectCalendar isLeader={isLeader} locked={lockedSection === 'calendar'} />
          </div>
        ) : null}

        {activeSection === 'fairness' ? (
          <div className="space-y-6">
            <div className="grid lg:grid-cols-2 gap-6">
              <section className="bg-card rounded-xl p-6 shadow-card border border-border">
                <h2 className="font-display text-lg font-semibold mb-4">{tr(language, 'Đóng góp thành viên', 'Member contributions')}</h2>
                <ContributionAnalytics
                  members={members}
                  showScoreCard
                  currentUserName={currentUserName}
                />
              </section>

              <section className="bg-card rounded-xl p-6 shadow-card border border-border">
                <h2 className="font-display text-lg font-semibold mb-4">{tr(language, 'AI Phân tích nhóm', 'AI Group Analysis')}</h2>
                <Button onClick={runAI} disabled={aiLoading} className="mb-4">
                  <Brain className="h-4 w-4 mr-1" />
                  {aiLoading ? tr(language, 'Đang phân tích...', 'Analyzing...') : tr(language, 'AI Phân tích nhóm', 'AI Group Analysis')}
                </Button>
                {aiResult && (
                  <div className="bg-muted rounded-lg p-4 text-sm whitespace-pre-line leading-relaxed animate-in fade-in duration-300">
                    {aiResult}
                  </div>
                )}

                <div className="mt-6 pt-4 border-t border-border">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
                    <Flag className="h-4 w-4 text-destructive" /> {tr(language, 'Báo cáo thành viên', 'Report a member')}
                  </h3>
                  <div className="space-y-2">
                    {members.filter(m => m.name !== currentUserName).map(m => (
                      <div key={m.name} className="flex items-center justify-between p-2 rounded-lg border border-border">
                        <div>
                          <span className="text-sm font-medium">{m.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">{tr(language, 'Đóng góp', 'Contribution')}: {m.contributionPercent}%</span>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => { setReportTarget(m); setReportOpen(true); }}>
                          <Flag className="h-3 w-3 mr-1" /> {tr(language, 'Báo cáo', 'Report')}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>



            <section className="bg-card rounded-xl p-6 shadow-card border border-border">
              <h2 className="font-display text-lg font-semibold mb-4">
                <Star className="h-5 w-5 inline mr-1 text-primary" />
                {t(language, 'anonymousEvaluation')}
              </h2>

              <div className="grid sm:grid-cols-2 gap-4 mb-6">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label>{tr(language, 'Chọn thành viên', 'Pick a member')}</Label>
                    <Select value={evalTarget} onValueChange={setEvalTarget}>
                      <SelectTrigger><SelectValue placeholder={tr(language, 'Chọn thành viên', 'Pick a member')} /></SelectTrigger>
                      <SelectContent>
                        {members.filter(m => m.name !== currentUserName).map(m => (
                          <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>{tr(language, 'Đánh giá sao', 'Star rating')}</Label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button key={s} type="button" onClick={() => setEvalRating(s)} className="p-0.5 transition-transform hover:scale-110">
                          <Star className={`h-6 w-6 transition-colors ${s <= evalRating ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{tr(language, 'Nhận xét', 'Comment')}</Label>
                  <Textarea value={evalComment} onChange={e => setEvalComment(e.target.value)} placeholder={tr(language, 'Nhận xét về thành viên...', 'Comment about the member...')} className="h-[88px]" />
                </div>
              </div>
              <Button onClick={handleSubmitEval} size="sm">{t(language, 'sendEvaluation')}</Button>

              {peerEvaluations.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-2">{tr(language, 'Lịch sử đánh giá', 'Evaluation history')}</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">{tr(language, 'Từ', 'From')}</th>
                          <th className="text-left px-3 py-2 font-medium">{tr(language, 'Đến', 'To')}</th>
                          <th className="text-center px-3 py-2 font-medium">{tr(language, 'Sao', 'Stars')}</th>
                          <th className="text-left px-3 py-2 font-medium">{tr(language, 'Nhận xét', 'Comment')}</th>
                          <th className="text-left px-3 py-2 font-medium">{tr(language, 'Thời gian', 'Time')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {peerEvaluations.map(ev => (
                          <tr key={ev.id} className="border-b border-border last:border-0">
                            <td className="px-3 py-2">{anonymousFrom}</td>
                            <td className="px-3 py-2">{ev.to}</td>
                            <td className="px-3 py-2 text-center">
                              <div className="flex justify-center gap-0.5">
                                {[1, 2, 3, 4, 5].map(s => (
                                  <Star key={s} className={`h-3.5 w-3.5 ${s <= ev.rating ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{ev.comment || '—'}</td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">{ev.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {getAverageRatings().length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-semibold mb-2">{tr(language, 'Điểm trung bình', 'Average score')}</h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {getAverageRatings().map(({ name, avg, count }) => (
                      <div key={name} className="flex items-center justify-between bg-muted rounded-lg px-4 py-3">
                        <span className="font-medium text-sm">{name}</span>
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={`h-3.5 w-3.5 ${s <= Math.round(avg) ? 'fill-primary text-primary' : 'text-muted-foreground'}`} />
                            ))}
                          </div>
                          <span className="text-sm font-semibold">{avg.toFixed(1)}</span>
                          <span className="text-xs text-muted-foreground">({count})</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : null}

        {activeSection === 'materials' ? (
          <div className="space-y-6">
            <MaterialsSection role="student" uploaderName={currentUserName || CURRENT_USER_MEMBER} />
          </div>
        ) : null}

        {activeSection === 'verifiedBadges' ? (
          <div className="space-y-6">
            <VerifiedBadgesSection currentUserName={currentUserName} />
          </div>
        ) : null}

        {activeSection === 'activity' ? (
          <div className="space-y-6">
            <section className="bg-card rounded-xl p-6 shadow-card border border-border">
              <h2 className="font-display text-lg font-semibold mb-4">
                <Clock className="h-5 w-5 inline mr-1" />
                Nhật ký hoạt động
              </h2>
              <div className="space-y-2 max-h-[480px] overflow-y-auto">
                {activityLog.map(log => (
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

        <StudentAgentSidebar open={aiSidebarOpen} onOpenChange={setAiSidebarOpen} onLockedSectionChange={setLockedSection} />

        <StudentReportModal
          open={reportOpen}
          onOpenChange={setReportOpen}
          targetMember={reportTarget}
          currentUser={currentUserName}
        />
      </div>
    </DashboardShell>
  );
};

export default StudentDashboard;
