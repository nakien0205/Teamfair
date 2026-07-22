import { useState } from 'react';
import { useTeam, Task } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, GripVertical, Clock, User, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { tr } from '@/lib/i18n';
import { STUDENT_TASK_PROGRESS_MESSAGES, canStudentStartTask } from '@/lib/studentTaskProgress';
import { useAuth } from '@/context/AuthContext';
import { Checkbox } from '@/components/ui/checkbox';
import { useNotifications } from '@/context/NotificationContext';
import { useEntitlements } from '@/context/EntitlementContext';
import { hasProGroupFeatures } from '@/lib/billing';
import { supabase } from '@/lib/supabaseClient';
import { checkUserGoogleCalendarPermission, requestGoogleCalendarPermission } from '@/lib/googleCalendarConnection';

const COLUMNS: Task['status'][] = ['Todo', 'In Progress', 'Done'];
const COLUMN_COLORS: Record<string, string> = {
  'Todo': 'border-t-muted-foreground',
  'In Progress': 'border-t-accent',
  'Done': 'border-t-success',
};
const PRIORITY_COLORS: Record<string, string> = {
  'Low': 'bg-muted text-muted-foreground',
  'Medium': 'bg-accent/20 text-accent-foreground',
  'High': 'bg-destructive/20 text-destructive',
};

interface Props {
  isLeader: boolean;
  currentUser: string;
  locked?: boolean;
  onApproveClick?: (t: Task) => void;
}

const KanbanBoard = ({ isLeader, currentUser, locked, onApproveClick }: Props) => {
  const {
    groups,
    currentGroupIndex,
    tasks,
    members,
    addTask,
    updateTaskStatus,
    deleteTask,
    currentUserName,
  } = useTeam();
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { sendNotification } = useNotifications();
  const { plan } = useEntitlements();
  const canUsePriority = hasProGroupFeatures(plan);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', description: '', assignedTo: '', assigneeId: '', deadline: '', priority: '' as '' | 'Low' | 'Medium' | 'High', contributionPercent: 10 });
  const [notifyTeam, setNotifyTeam] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [assigneeHasCalendar, setAssigneeHasCalendar] = useState<boolean | null>(null);
  const [checkingCalendar, setCheckingCalendar] = useState(false);
  const [sendingCalendarReq, setSendingCalendarReq] = useState(false);
  const currentGroup = groups[currentGroupIndex];

  const getStatusLabel = (status: Task["status"]): string => {
    if (language === "vi") {
      if (status === "Todo") return "Chưa làm";
      if (status === "In Progress") return "Đang làm";
      return "Hoàn thành";
    }
    if (status === "Todo") return "Todo";
    if (status === "In Progress") return "In Progress";
    return "Done";
  };

  const getPriorityLabel = (priority: string): string => {
    if (language === "vi") {
      if (priority === "Low") return "Thấp";
      if (priority === "Medium") return "Trung bình";
      if (priority === "High") return "Cao";
    }
    return priority;
  };

  const handleCreate = async () => {
    if (!newTask.name || !newTask.assignedTo) {
      toast({ title: tr(language, 'Lỗi', 'Error'), description: tr(language, 'Vui lòng điền đầy đủ', 'Please fill in all required fields'), variant: 'destructive' });
      return;
    }
    try {
      const submittedPriority = newTask.priority || undefined;
      const submittedAssigneeId = newTask.assigneeId || undefined;
      await addTask({ ...newTask, assigneeId: submittedAssigneeId, priority: submittedPriority });
      if (notifyTeam) {
        members
          .filter(m => m.id ? m.id !== user?.id : m.name !== currentUserName)
          .forEach(member => {
            const recipientId = member.id || member.name;
            void sendNotification(
              recipientId,
              currentUserName,
              tr(
                language,
                `Đã giao task mới: "${newTask.name}"`,
                `Assigned a new task: "${newTask.name}"`
              ),
              groups[currentGroupIndex]?.id
            );
          });
      }
      if (sendEmail && newTask.assignedTo) {
        const assignedMember = members.find(m => m.id === submittedAssigneeId)
          ?? members.find(m => m.name === newTask.assignedTo);
        if (assignedMember?.id) {
          void supabase.functions.invoke('send-task-email', {
            body: {
              assigneeId: assignedMember.id,
              taskName: newTask.name,
              taskDescription: newTask.description,
              deadline: newTask.deadline,
              priority: submittedPriority,
              groupName: currentGroup?.name || '',
            },
          });
        }
      }
      setNewTask({ name: '', description: '', assignedTo: '', assigneeId: '', deadline: '', priority: '', contributionPercent: 10 });
      setNotifyTeam(false);
      setSendEmail(false);
      setCreateOpen(false);
      toast({ title: tr(language, 'Task đã tạo', 'Task created'), description: `"${newTask.name}" ${tr(language, 'đã được thêm', 'has been added')}` });
    } catch (err) {
      console.error("Task creation failed:", err);
      toast({ title: tr(language, 'Lỗi', 'Error'), description: tr(language, 'Tạo task thất bại', 'Failed to create task'), variant: 'destructive' });
    }
  };

  const handleDrop = (status: Task['status']) => {
    if (draggedTask) {
      const task = tasks.find(t => t.id === draggedTask);
      if (task && task.status !== status) {
        if (!isLeader && task.assignedTo !== currentUser) {
          toast({
            title: tr(language, 'Không thể cập nhật task', 'Cannot update task'),
            description: STUDENT_TASK_PROGRESS_MESSAGES.unauthorized,
            variant: 'destructive',
          });
          setDraggedTask(null);
          return;
        }

        if (!isLeader && task.assignedTo === currentUser && status !== 'In Progress') {
          toast({
            title: tr(language, 'Không thể cập nhật task', 'Cannot update task'),
            description: STUDENT_TASK_PROGRESS_MESSAGES.invalidTransition,
            variant: 'destructive',
          });
          setDraggedTask(null);
          return;
        }

        if (!isLeader && task.assignedTo === currentUser) {
          const validation = canStudentStartTask(task, true);
          if (!validation.ok) {
            toast({
              title: tr(language, 'Không thể cập nhật task', 'Cannot update task'),
              description: validation.message,
              variant: 'destructive',
            });
            setDraggedTask(null);
            return;
          }
        }

        if (!isLeader && task.assignedTo !== currentUser) {
          toast({
            title: tr(language, 'Quyền truy cập bị từ chối', 'Access Denied'),
            description: tr(language, 'Bạn chỉ có thể di chuyển nhiệm vụ của chính mình', 'You can only move your own tasks'),
            variant: 'destructive',
          });
          setDraggedTask(null);
          return;
        }
        updateTaskStatus(draggedTask, status, currentUser);
        toast({ title: tr(language, 'Cập nhật', 'Updated'), description: `"${task.name}" → ${getStatusLabel(status)}` });
      }
      setDraggedTask(null);
    }
  };


  const visibleTasks = tasks;

  return (
    <section className="bg-card rounded-xl p-6 shadow-card border border-border relative">
      {locked && (
        <div className="absolute inset-0 z-10 rounded-xl bg-background/60 backdrop-blur-[2px] flex items-center justify-center pointer-events-auto">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/90 px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg animate-pulse">
            {tr(language, 'AI đang làm việc…', 'AI working…')}
          </span>
        </div>
      )}
      <div className={locked ? 'pointer-events-none opacity-60' : ''}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-lg font-semibold">{tr(language, 'Bảng Task (Kanban)', 'Task Board (Kanban)')}</h2>
        {isLeader ? (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> {tr(language, 'Tạo Task', 'Create Task')}</Button>
            </DialogTrigger>
            <DialogContent className="rounded-[22px] border border-white/60 bg-white/90 shadow-[0_20px_50px_rgba(15,23,42,0.15)] backdrop-blur-xl max-w-md">
              <DialogHeader>
                <DialogTitle className="font-display text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Plus className="h-5 w-5 text-indigo-600 animate-pulse" />
                  {tr(language, 'Tạo Nhiệm Vụ Mới', 'Create New Task')}
                </DialogTitle>
                <DialogDescription>
                  {tr(language, 'Giao việc cho thành viên nhóm và thiết lập các thông tin chi tiết.', 'Assign work to team members and set details.')}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2 text-slate-700 text-sm">
                <div className="space-y-1.5">
                  <Label className="font-medium">{tr(language, 'Tên task', 'Task Title')} <span className="text-red-500">*</span></Label>
                  <Input
                    value={newTask.name}
                    onChange={e => setNewTask(p => ({ ...p, name: e.target.value }))}
                    placeholder={tr(language, 'Nhập tên task', 'Task title')}
                    className="rounded-xl border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-medium">{tr(language, 'Mô tả', 'Description')}</Label>
                  <Textarea
                    value={newTask.description}
                    onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))}
                    placeholder={tr(language, 'Nhập mô tả chi tiết nhiệm vụ...', 'Description')}
                    className="h-20 rounded-xl border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-medium">{tr(language, 'Giao cho', 'Assign To')} <span className="text-red-500">*</span></Label>
                  <Select
                    value={newTask.assigneeId || newTask.assignedTo}
                    onValueChange={async v => {
                      const member = members.find(m => (m.id || m.name) === v);
                      const memberId = member?.id || '';
                      setNewTask(p => ({ ...p, assignedTo: member?.name || v, assigneeId: memberId }));
                      if (memberId) {
                        setCheckingCalendar(true);
                        const hasPerm = await checkUserGoogleCalendarPermission(memberId);
                        setAssigneeHasCalendar(hasPerm);
                        setCheckingCalendar(false);
                      } else {
                        setAssigneeHasCalendar(null);
                      }
                    }}
                  >
                    <SelectTrigger className="rounded-xl border-slate-200 focus:border-indigo-400 focus:ring-indigo-400">
                      <SelectValue placeholder={tr(language, 'Chọn thành viên', 'Select member')} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {members.map(m => <SelectItem key={m.id || m.name} value={m.id || m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {newTask.assigneeId && (
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
                            const res = await requestGoogleCalendarPermission(newTask.assigneeId, currentGroup?.name || '', currentUserName);
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
                  <div className="space-y-1.5">
                    <Label className="font-medium">{tr(language, 'Deadline', 'Deadline')}</Label>
                    <Input
                      type="date"
                      value={newTask.deadline}
                      onChange={e => setNewTask(p => ({ ...p, deadline: e.target.value }))}
                      className="rounded-xl border-slate-200 focus:border-indigo-400 focus:ring-indigo-400"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-medium">{tr(language, 'Ưu tiên', 'Priority')}</Label>
                    <Select value={newTask.priority} onValueChange={(v: 'Low' | 'Medium' | 'High') => setNewTask(p => ({ ...p, priority: v }))} disabled={!canUsePriority}>
                      <SelectTrigger className="rounded-xl border-slate-200 focus:border-indigo-400 focus:ring-indigo-400">
                        <SelectValue placeholder={tr(language, 'Chọn mức độ ưu tiên', 'Choose Priority')} />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="Low">{tr(language, 'Thấp', 'Low')}</SelectItem>
                        <SelectItem value="Medium">{tr(language, 'Trung bình', 'Medium')}</SelectItem>
                        <SelectItem value="High">{tr(language, 'Cao', 'High')}</SelectItem>
                      </SelectContent>
                    </Select>
                    {!canUsePriority && <p className="text-xs text-amber-700">Pro Group mở khóa độ ưu tiên task.</p>}
                  </div>
                </div>
                <div className="flex items-center space-x-2 py-2 border-t border-slate-100 mt-2">
                  <Checkbox
                    id="notifyTeamKanban"
                    checked={notifyTeam}
                    onCheckedChange={(checked) => setNotifyTeam(!!checked)}
                    className="rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Label htmlFor="notifyTeamKanban" className="text-xs font-semibold leading-none cursor-pointer text-slate-500">
                    {tr(language, "Thông báo cho thành viên nhóm", "Notify team members")}
                  </Label>
                </div>
                <div className="flex items-center space-x-2 py-1">
                  <Checkbox
                    id="sendEmailKanban"
                    checked={sendEmail}
                    onCheckedChange={(checked) => setSendEmail(!!checked)}
                    className="rounded-full border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <Label htmlFor="sendEmailKanban" className="text-xs font-semibold leading-none cursor-pointer text-slate-500">
                    {tr(language, "Gửi email", "Send email")}
                  </Label>
                </div>
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <Button className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium" onClick={handleCreate}>
                    {tr(language, 'Tạo Task', 'Create Task')}
                  </Button>
                  <Button variant="outline" className="flex-1 rounded-xl border-slate-200" onClick={() => setCreateOpen(false)}>
                    {tr(language, 'Hủy', 'Cancel')}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="opacity-50 cursor-not-allowed"
            disabled
            title={tr(language, 'Chỉ Trưởng nhóm mới có quyền tạo task', 'Only the Project Leader can create tasks')}
          >
            <Plus className="h-4 w-4 mr-1" /> {tr(language, 'Tạo Task', 'Create Task')}
          </Button>
        )}
      </div>



      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <div
            key={col}
            className={`rounded-lg border border-border bg-muted/30 p-3 min-h-[200px] border-t-4 ${COLUMN_COLORS[col]}`}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(col)}
          >
            <h3 className="text-sm font-semibold mb-3 flex items-center justify-between">
              {getStatusLabel(col)}
              <span className="text-xs bg-muted rounded-full px-2 py-0.5">{visibleTasks.filter(t => t.status === col).length}</span>
            </h3>
            <div className="space-y-2">
              {visibleTasks.filter(t => t.status === col).map(t => (
                <div
                  key={t.id}
                  draggable={isLeader || t.assignedTo === currentUser}
                  onDragStart={() => setDraggedTask(t.id)}
                  className={`bg-card rounded-lg border border-border p-3 hover:shadow-md transition-shadow block w-full text-left ${(isLeader || t.assignedTo === currentUser) ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-80'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm break-all whitespace-normal">{t.name}</p>
                      {t.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>}
                    </div>
                    <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-xs flex items-center gap-1 text-muted-foreground">
                      <User className="h-3 w-3" /> {t.assignedTo.split(' ').at(-1) ?? ''}
                    </span>
                    {t.deadline && (
                      <span className="text-xs flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-3 w-3" /> {t.deadline}
                      </span>
                    )}
                    {canUsePriority && t.priority && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[t.priority]}`}>{getPriorityLabel(t.priority)}</span>
                    )}
                  </div>
                  {isLeader && t.status === 'Done' && !t.approved && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <Button
                        size="sm"
                        className="h-6 text-xs px-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (onApproveClick) onApproveClick(t);
                        }}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" /> {tr(language, 'Duyệt', 'Approve')}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      </div>
    </section>
  );
};

export default KanbanBoard;
