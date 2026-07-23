import { useMemo, useState, useEffect } from 'react';
import { useTeam } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ArrowRight, Brain, CheckCircle, Clock, GraduationCap, Layers3, Plus, Save, Trash2, Upload } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ContributionAnalytics from '@/components/ContributionAnalytics';
import { useLanguage } from '@/context/LanguageContext';
import { useAuth } from '@/context/AuthContext';
import { tr } from '@/lib/i18n';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { getAccessibleProjectEntries } from '@/lib/projectAccess';
import { LecturerDashboardSkeleton } from '@/components/skeletons';
import { checkUserGoogleCalendarPermission, requestGoogleCalendarPermission } from '@/lib/googleCalendarConnection';
import { GOOGLE_CALENDAR_UI_ENABLED } from '@/lib/featureFlags';

const LecturerDashboard = () => {
  const { groups, currentGroupIndex, setCurrentGroupIndex, updateLecturerScore, addTask, deleteTask, approveTask, dataLoading } = useTeam();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const { language } = useLanguage();

  const [editedScores, setEditedScores] = useState<Record<string, number>>({});
  const [unsaved, setUnsaved] = useState<Set<string>>(new Set());
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [newTask, setNewTask] = useState({
    name: '',
    description: '',
    assignedTo: '',
    assigneeId: '',
    deadline: '',
    priority: '' as '' | 'Low' | 'Medium' | 'High',
    contributionPercent: 10
  });
  const [assigneeHasCalendar, setAssigneeHasCalendar] = useState<boolean | null>(null);
  const [checkingCalendar, setCheckingCalendar] = useState(false);
  const [sendingCalendarReq, setSendingCalendarReq] = useState(false);

  useEffect(() => {
    if (authLoading || !profile) return;
    if (profile.role === "student") {
      navigate("/student/dashboard", { replace: true });
    }
  }, [profile, authLoading, navigate]);

  const handleCreateTask = async () => {
    if (!newTask.name || !newTask.assignedTo) {
      toast({
        title: tr(language, 'Lỗi', 'Error'),
        description: tr(language, 'Vui lòng điền tên task và người thực hiện', 'Please enter task name and assignee'),
        variant: 'destructive'
      });
      return;
    }
    try {
      const submittedPriority = newTask.priority || undefined;
      const submittedAssigneeId = newTask.assigneeId || undefined;
      await addTask({ ...newTask, assigneeId: submittedAssigneeId, priority: submittedPriority });
      setNewTask({
        name: '',
        description: '',
        assignedTo: '',
        assigneeId: '',
        deadline: '',
        priority: '',
        contributionPercent: 10
      });
      setModalOpen(false);
      toast({
        title: tr(language, 'Task đã tạo', 'Task created'),
        description: tr(language, `"${newTask.name}" đã được tạo thành công`, `"${newTask.name}" created successfully`)
      });
    } catch (err) {
      console.error("Task creation failed:", err);
      toast({
        title: tr(language, 'Lỗi', 'Error'),
        description: tr(language, 'Tạo task thất bại', 'Failed to create task'),
        variant: 'destructive'
      });
    }
  };

  const handleDeleteTask = (taskId: string, name: string) => {
    deleteTask(taskId);
    toast({
      title: tr(language, 'Đã xóa', 'Deleted'),
      description: tr(language, `Task "${name}" đã bị xóa`, `Task "${name}" has been deleted`)
    });
  };

  const handleApproveTask = (taskId: string, name: string) => {
    approveTask(taskId);
    toast({
      title: tr(language, 'Đã duyệt', 'Approved'),
      description: tr(language, `Task "${name}" đã được duyệt thành công`, `Task "${name}" approved successfully`)
    });
  };

  const accessibleEntries = useMemo(
    () => getAccessibleProjectEntries(groups, user?.id, profile?.role, !user?.id),
    [groups, profile?.role, user?.id],
  );
  const activeEntry = accessibleEntries.find((entry) => entry.index === currentGroupIndex) ?? accessibleEntries[0];

  useEffect(() => {
    if (activeEntry && activeEntry.index !== currentGroupIndex) {
      setCurrentGroupIndex(activeEntry.index);
    }
  }, [activeEntry, currentGroupIndex, setCurrentGroupIndex]);

  const group = activeEntry?.group;
  const groupIndex = activeEntry?.index ?? currentGroupIndex;

  if (authLoading || dataLoading) {
    return <LecturerDashboardSkeleton />;
  }

  if (!group) {
    return (
      <div className="space-y-6">
        <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 text-white shadow-card">
          <div className={profile?.role === "lecturer" ? "grid gap-0 grid-cols-1" : "grid gap-0 lg:grid-cols-[1.35fr_0.65fr]"}>
            <div className="p-6 md:p-8">
              <div className="mb-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">{tr(language, "Lecturer dashboard", "Lecturer Dashboard")}</span>
                <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-medium text-emerald-200">
                  {tr(language, "Quản lý lớp, nhóm và điểm", "Manage classes, groups, and scores")}
                </span>
              </div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
                {profile?.role === "lecturer"
                  ? tr(language, "Bạn chưa được gán project nào", "No assigned projects yet")
                  : tr(language, "Chưa có project nào để xem", "No project to show yet")}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200/80 md:text-base">
                {profile?.role === "lecturer"
                  ? tr(
                      language,
                      "Bạn chưa được gán quản lý dự án nào. Vui lòng liên hệ Admin để được cấp quyền.",
                      "You are not assigned to manage any project yet. Please contact the Admin to get access."
                    )
                  : tr(
                      language,
                      "Hãy sang trang quản lý nhóm để tạo lớp, môn học hoặc project, sau đó mời người dùng bằng email. Khi đã có nhóm, dashboard sẽ tự hiển thị nhóm đang quản lý.",
                      "Go to the group management page to create a class, course, or project, then invite users by email. Once you have a group, the dashboard will show the one you are managing.",
                    )}
              </p>
              {profile?.role !== "lecturer" && (
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
              )}
            </div>
            {profile?.role !== "lecturer" && (
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
            )}
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
    updateLecturerScore(name, score, groupIndex);
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
                  <tr key={m.id || m.name} className={`border-b border-border last:border-0 transition-colors ${isUnsaved ? 'bg-warning/10' : ''}`}>
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

      {/* Group Task Management Section */}
      <section className="bg-card rounded-xl shadow-card border border-border overflow-hidden p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <h2 className="font-display text-lg font-semibold">{tr(language, 'Quản lý task nhóm', 'Group tasks management')}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{tr(language, 'Xem và quản lý tất cả nhiệm vụ của nhóm', 'View and manage all tasks for this group')}</p>
          </div>
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
                  <Label>{tr(language, 'Mô tả', 'Description')}</Label>
                  <Textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder="Nhập mô tả" />
                </div>
                <div className="space-y-1">
                  <Label>{tr(language, 'Giao cho', 'Assign to')}</Label>
                  <Select
                    value={newTask.assigneeId || newTask.assignedTo}
                    onValueChange={async v => {
                      const member = group.members.find(m => (m.id || m.name) === v);
                      const memberId = member?.id || '';
                      setNewTask(p => ({ ...p, assignedTo: member?.name || v, assigneeId: memberId }));
                      if (GOOGLE_CALENDAR_UI_ENABLED && memberId) {
                        setCheckingCalendar(true);
                        const hasPerm = await checkUserGoogleCalendarPermission(memberId);
                        setAssigneeHasCalendar(hasPerm);
                        setCheckingCalendar(false);
                      } else {
                        setAssigneeHasCalendar(null);
                        setCheckingCalendar(false);
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder={tr(language, 'Chọn thành viên', 'Pick a member')} /></SelectTrigger>
                    <SelectContent>
                      {group.members.map(m => <SelectItem key={m.id || m.name} value={m.id || m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {GOOGLE_CALENDAR_UI_ENABLED && newTask.assigneeId && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                    {checkingCalendar ? (
                      <p className="text-slate-500 italic">{tr(language, "Đang kiểm tra quyền Google Calendar...", "Checking Google Calendar permission...")}</p>
                    ) : assigneeHasCalendar === true ? (
                      <div className="flex items-center gap-1.5 text-emerald-700 font-medium">
                        <CheckCircle className="h-4 w-4" />
                        <span>{tr(language, "Thành viên đã cấp quyền ghi Google Calendar. Hạn chót sẽ tự động đồng bộ.", "Member has granted Google Calendar write permission. Deadline will sync automatically.")}</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-slate-600">
                          {tr(language, "Thành viên chưa kết nối Google Calendar. Gửi yêu cầu để họ kết nối và nhận đồng bộ hạn chót.", "Member has not connected Google Calendar. Send a request asking them to authorize.")}
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={sendingCalendarReq}
                          className="w-full text-xs font-semibold border-indigo-200 text-indigo-700 hover:bg-indigo-50"
                          onClick={async () => {
                            setSendingCalendarReq(true);
                            const res = await requestGoogleCalendarPermission(newTask.assigneeId, group?.name || '', profile?.full_name || 'Giảng viên');
                            setSendingCalendarReq(false);
                            if (res.success) {
                              toast({
                                title: tr(language, "Đã gửi yêu cầu", "Request Sent"),
                                description: tr(language, "Email yêu cầu quyền Google Calendar đã được gửi đến thành viên.", "Google Calendar write permission request email sent to member.")
                              });
                            } else {
                              toast({
                                title: tr(language, "Lỗi", "Error"),
                                description: res.message,
                                variant: "destructive"
                              });
                            }
                          }}
                        >
                          {sendingCalendarReq ? tr(language, "Đang gửi...", "Sending...") : tr(language, "Gửi yêu cầu quyền Google Calendar", "Request Google Calendar Write Permission")}
                        </Button>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{tr(language, 'Deadline', 'Deadline')}</Label>
                    <Input type="date" value={newTask.deadline} onChange={e => setNewTask(p => ({ ...p, deadline: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{tr(language, 'Ưu tiên', 'Priority')}</Label>
                    <Select value={newTask.priority} onValueChange={(v: 'Low' | 'Medium' | 'High') => setNewTask(p => ({ ...p, priority: v }))}>
                      <SelectTrigger><SelectValue placeholder={tr(language, 'Chọn mức độ ưu tiên', 'Choose Priority')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">{tr(language, 'Thấp', 'Low')}</SelectItem>
                        <SelectItem value="Medium">{tr(language, 'Trung bình', 'Medium')}</SelectItem>
                        <SelectItem value="High">{tr(language, 'Cao', 'High')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{tr(language, 'Đóng góp (%)', 'Contribution (%)')}</Label>
                  <Input type="number" min={1} max={100} value={newTask.contributionPercent} onChange={e => setNewTask(p => ({ ...p, contributionPercent: Number(e.target.value) }))} />
                </div>
                <Button className="w-full" onClick={handleCreateTask}>{tr(language, 'Tạo Task', 'Create task')}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {(!group.tasks || group.tasks.length === 0) ? (
          <p className="text-muted-foreground text-sm text-center py-8">{tr(language, 'Chưa có task nào', 'No tasks yet')}</p>
        ) : (
          <div className="space-y-3">
            {group.tasks.map(t => {
              const statusLabel = t.status === 'Done' ? (t.approved ? tr(language, 'Đã duyệt', 'Approved') : tr(language, 'Chờ duyệt', 'Waiting review')) : (t.status === 'In Progress' ? tr(language, 'Đang làm', 'In Progress') : tr(language, 'Chưa làm', 'Todo'));
              const isApproved = t.approved;
              const isWaitingReview = t.status === 'Done' && !t.approved;

              const statusBadgeColor = isApproved
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : (isWaitingReview ? 'border-amber-200 bg-amber-50 text-amber-700' : (t.status === 'In Progress' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-slate-200 bg-slate-100 text-slate-700'));

              const priorityColor = t.priority === 'High'
                ? 'border-rose-200 bg-rose-50 text-rose-700'
                : (t.priority === 'Medium' ? 'border-orange-200 bg-orange-50 text-orange-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700');

              return (
                <div key={t.id} className="border border-border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-muted/30 transition-colors bg-card">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{t.name}</p>
                      {t.priority && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${priorityColor}`}>
                          {t.priority === 'High' ? tr(language, 'Cao', 'High') : (t.priority === 'Medium' ? tr(language, 'Trung bình', 'Medium') : tr(language, 'Thấp', 'Low'))}
                        </span>
                      )}
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <span className="font-medium text-foreground">{t.assignedTo}</span>
                      <span>·</span>
                      <span>{tr(language, 'Đóng góp', 'Contribution')}: {t.contributionPercent}%</span>
                      {t.deadline && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {t.deadline}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${statusBadgeColor}`}>
                      {statusLabel}
                    </span>
                    {isWaitingReview && (
                      <Button size="sm" variant="outline" className="h-8 border-emerald-300 hover:bg-emerald-50 text-emerald-700 gap-1" onClick={() => handleApproveTask(t.id, t.name)}>
                        <CheckCircle className="h-3.5 w-3.5" />
                        {tr(language, 'Duyệt', 'Approve')}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => handleDeleteTask(t.id, t.name)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default LecturerDashboard;
