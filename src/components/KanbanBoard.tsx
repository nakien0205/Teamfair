import { useState, useRef } from 'react';
import { useTeam, Task } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, GripVertical, Upload, FileText, Clock, User } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { tr } from '@/lib/i18n';

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
}

const KanbanBoard = ({ isLeader, currentUser, locked }: Props) => {
  const { tasks, members, addTask, updateTaskStatus, updateTask } = useTeam();
  const { toast } = useToast();
  const { language } = useLanguage();
  const [createOpen, setCreateOpen] = useState(false);
  const [newTask, setNewTask] = useState({ name: '', description: '', assignedTo: '', deadline: '', priority: 'Medium' as 'Low' | 'Medium' | 'High', contributionPercent: 10 });
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const evidenceRef = useRef<HTMLInputElement>(null);
  const [evidenceTaskId, setEvidenceTaskId] = useState<string | null>(null);

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

  const handleCreate = () => {
    if (!newTask.name || !newTask.assignedTo) {
      toast({ title: tr(language, 'Lỗi', 'Error'), description: tr(language, 'Vui lòng điền đầy đủ', 'Please fill in all required fields'), variant: 'destructive' });
      return;
    }
    addTask({ ...newTask });
    setNewTask({ name: '', description: '', assignedTo: '', deadline: '', priority: 'Medium', contributionPercent: 10 });
    setCreateOpen(false);
    toast({ title: tr(language, 'Task đã tạo', 'Task created'), description: `"${newTask.name}" ${tr(language, 'đã được thêm', 'has been added')}` });
  };

  const handleDrop = (status: Task['status']) => {
    if (draggedTask) {
      const task = tasks.find(t => t.id === draggedTask);
      if (task && task.status !== status) {
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

  const handleEvidenceUpload = (taskId: string) => {
    const file = evidenceRef.current?.files?.[0];
    if (!file) return;
    // Limit file size to 50 MB
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: tr(language, 'Lỗi kích thước', 'Size Error'),
        description: tr(language, 'Dung lượng file tối đa là 50MB', 'Max file size is 50MB'),
        variant: 'destructive',
      });
      if (evidenceRef.current) evidenceRef.current.value = '';
      setEvidenceTaskId(null);
      return;
    }
    // Sanitize filename to prevent directory traversal and handle weird characters safely
    let cleanName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    if (cleanName.length > 100) {
      const parts = cleanName.split('.');
      const ext = parts.length > 1 ? parts.pop() : '';
      const base = parts.join('.');
      cleanName = base.substring(0, 95 - (ext ? ext.length + 1 : 0)) + (ext ? '.' + ext : '');
    }
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const existing = task.evidence || [];
      updateTask(taskId, { evidence: [...existing, { fileName: cleanName, uploadTime: new Date() }] });
      toast({ title: tr(language, 'Evidence uploaded', 'Evidence uploaded'), description: `"${cleanName}" ${tr(language, 'đã được tải lên', 'has been uploaded')}` });
    }
    if (evidenceRef.current) evidenceRef.current.value = '';
    setEvidenceTaskId(null);
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
            <DialogContent>
              <DialogHeader><DialogTitle>{tr(language, 'Tạo Task', 'Create Task')}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>{tr(language, 'Tên task', 'Task Title')}</Label>
                  <Input value={newTask.name} onChange={e => setNewTask(p => ({ ...p, name: e.target.value }))} placeholder={tr(language, 'Nhập tên task', 'Task title')} />
                </div>
                <div className="space-y-1">
                  <Label>{tr(language, 'Mô tả', 'Description')}</Label>
                  <Textarea value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder={tr(language, 'Nhập mô tả', 'Description')} />
                </div>
                <div className="space-y-1">
                  <Label>{tr(language, 'Giao cho', 'Assign To')}</Label>
                  <Select value={newTask.assignedTo} onValueChange={v => setNewTask(p => ({ ...p, assignedTo: v }))}>
                    <SelectTrigger><SelectValue placeholder={tr(language, 'Chọn thành viên', 'Select member')} /></SelectTrigger>
                    <SelectContent>{members.map(m => <SelectItem key={m.name} value={m.name}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{tr(language, 'Deadline', 'Deadline')}</Label>
                    <Input type="date" value={newTask.deadline} onChange={e => setNewTask(p => ({ ...p, deadline: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{tr(language, 'Ưu tiên', 'Priority')}</Label>
                    <Select value={newTask.priority} onValueChange={(v: 'Low' | 'Medium' | 'High') => setNewTask(p => ({ ...p, priority: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">{tr(language, 'Thấp', 'Low')}</SelectItem>
                        <SelectItem value="Medium">{tr(language, 'Trung bình', 'Medium')}</SelectItem>
                        <SelectItem value="High">{tr(language, 'Cao', 'High')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleCreate}>{tr(language, 'Tạo Task', 'Create Task')}</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setCreateOpen(false)}>{tr(language, 'Hủy', 'Cancel')}</Button>
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

      {/* Hidden evidence file input */}
      <input type="file" ref={evidenceRef} className="hidden" onChange={() => evidenceTaskId && handleEvidenceUpload(evidenceTaskId)} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => (
          <button type="button"
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
                <button type="button"
                  key={t.id}
                  draggable={isLeader || t.assignedTo === currentUser}
                  onDragStart={() => setDraggedTask(t.id)}
                  className={`bg-card rounded-lg border border-border p-3 hover:shadow-md transition-shadow ${(isLeader || t.assignedTo === currentUser) ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-80'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{t.name}</p>
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
                    {t.priority && (
                      <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[t.priority]}`}>{getPriorityLabel(t.priority)}</span>
                    )}
                  </div>
                  {/* Evidence */}
                  <div className="mt-2 pt-2 border-t border-border">
                    {t.evidence && t.evidence.length > 0 && (
                      <div className="space-y-1 mb-1">
                        {t.evidence.map(e => (
                          <p key={`${e.fileName}-${e.uploadTime.getTime()}`} className="text-xs text-muted-foreground flex items-center gap-1">
                            <FileText className="h-3 w-3" /> {e.fileName}
                          </p>
                        ))}
                      </div>
                    )}
                    {(isLeader || t.assignedTo === currentUser) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-xs px-2"
                        onClick={() => {
                          setEvidenceTaskId(t.id);
                          evidenceRef.current?.click();
                        }}
                      >
                        <Upload className="h-3 w-3 mr-1" /> {tr(language, 'Tải bằng chứng', 'Upload Evidence')}
                      </Button>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </button>
        ))}
      </div>
      </div>
    </section>
  );
};

export default KanbanBoard;
