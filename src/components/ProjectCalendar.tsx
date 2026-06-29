import { useState, useMemo } from 'react';
import { useTeam } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { CalendarDays, Plus, ChevronLeft, ChevronRight, Edit, Trash2, Clock } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { tr } from '@/lib/i18n';


export type EventType = 'Meeting' | 'Task Deadline' | 'Milestone';
export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  time: string;
  description: string;
  createdBy: string;
}


const EVENT_COLORS: Record<EventType, { bg: string; text: string; dot: string; border: string }> = {
  'Meeting': { bg: 'bg-blue-500/10 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500', border: 'border-l-2 border-blue-500' },
  'Task Deadline': { bg: 'bg-red-500/10 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500', border: 'border-l-2 border-red-500' },
  'Milestone': { bg: 'bg-emerald-500/10 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', border: 'border-l-2 border-emerald-500' },
};

interface Props {
  isLeader: boolean;
  locked?: boolean;
}

const ProjectCalendar = ({ isLeader, locked }: Props) => {
  const { tasks, calendarEvents, addCalendarEvent, updateCalendarEvent, deleteCalendarEvent } = useTeam();
  const { toast } = useToast();
  const { language } = useLanguage();

  const [currentDate, setCurrentDate] = useState(new Date(2026, 2, 1)); // March 2026
  const [view, setView] = useState<'month' | 'week'>('month');
  const [addOpen, setAddOpen] = useState(false);
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({ title: '', type: 'Meeting' as EventType, date: '', time: '', description: '' });

  const getEventTypeLabel = (type: EventType): string => {
    if (language === "vi") {
      if (type === "Meeting") return "Cuộc họp";
      if (type === "Task Deadline") return "Hạn task";
      return "Mốc";
    }
    return type;
  };

  // Auto-generate task deadline events from Kanban tasks
  const taskDeadlineEvents: CalendarEvent[] = useMemo(() =>
    tasks.filter(t => t.deadline).map(t => ({
      id: `task-${t.id}`,
      title: t.name,
      type: 'Task Deadline' as EventType,
      date: t.deadline,
      time: '',
      description:
        language === "vi"
          ? `Được giao cho: ${t.assignedTo} · Trạng thái: ${t.status}`
          : `Assigned to: ${t.assignedTo} · Status: ${t.status}`,
      createdBy: 'Leader',
    })),
    [tasks, language]
  );

  const allEvents = useMemo(() => [...calendarEvents, ...taskDeadlineEvents], [calendarEvents, taskDeadlineEvents]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const monthName = currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  // Week view helpers
  const getWeekStart = (d: Date) => {
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.getFullYear(), d.getMonth(), diff);
  };
  const weekStart = getWeekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
  const prevWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() - 7); setCurrentDate(d); };
  const nextWeek = () => { const d = new Date(currentDate); d.setDate(d.getDate() + 7); setCurrentDate(d); };

  const getEventsForDate = (dateStr: string) => allEvents.filter(e => e.date === dateStr);

  const formatDateStr = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  const resetForm = () => setFormData({ title: '', type: 'Meeting', date: '', time: '', description: '' });

  const handleSaveEvent = () => {
    if (!formData.title || !formData.date) {
      toast({
        title: tr(language, 'Lỗi', 'Error'),
        description: tr(language, 'Vui lòng nhập tiêu đề và ngày', 'Please enter event title and date'),
        variant: 'destructive',
      });
      return;
    }
    if (editMode && detailEvent) {
      updateCalendarEvent(detailEvent.id, {
        title: formData.title,
        type: formData.type,
        date: formData.date,
        time: formData.time,
        description: formData.description,
      });
      toast({
        title: tr(language, 'Đã cập nhật', 'Updated'),
        description: language === 'vi' ? `Sự kiện "${formData.title}" đã được sửa` : `Event "${formData.title}" has been updated`,
      });
      setEditMode(false);
      setDetailEvent(null);
    } else {
      addCalendarEvent({
        title: formData.title,
        type: formData.type,
        date: formData.date,
        time: formData.time,
        description: formData.description,
      });
      toast({
        title: tr(language, 'Đã tạo sự kiện', 'Event created'),
        description: language === 'vi' ? `"${formData.title}" đã được thêm vào lịch` : `"${formData.title}" has been added to the calendar`,
      });
      setAddOpen(false);
    }
    resetForm();
  };

  const handleDeleteEvent = (ev: CalendarEvent) => {
    deleteCalendarEvent(ev.id);
    toast({
      title: tr(language, 'Đã xóa', 'Deleted'),
      description: language === 'vi' ? `Sự kiện "${ev.title}" đã bị xóa` : `Event "${ev.title}" has been deleted`,
    });
    setDetailEvent(null);
  };

  const canEditEvent = (ev: CalendarEvent) => {
    if (ev.id.startsWith('task-')) return false;
    if (isLeader) return true;
    if (ev.type === 'Milestone') return false;
    return true;
  };

  const canCreate = (type: EventType) => {
    if (isLeader) return true;
    return type === 'Meeting';
  };

  const openDetail = (ev: CalendarEvent) => {
    setDetailEvent(ev);
    setEditMode(false);
  };

  const handleEventClick = (e: { currentTarget: HTMLButtonElement }) => {
    const eventId = e.currentTarget.dataset.eventId;
    if (!eventId) return;
    const ev = allEvents.find(x => x.id === eventId);
    if (!ev) return;
    openDetail(ev);
  };

  const startEdit = () => {
    if (!detailEvent) return;
    setFormData({ title: detailEvent.title, type: detailEvent.type, date: detailEvent.date, time: detailEvent.time, description: detailEvent.description });
    setEditMode(true);
  };

  const today = new Date();
  const todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const renderMonthGrid = () => {
    const cells: JSX.Element[] = [];
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    for (let i = 0; i < 7; i++) {
      cells.push(
        <div key={`hd-${i}`} className="text-center text-xs font-semibold text-muted-foreground py-2">
          {dayNames[i]}
        </div>
      );
    }

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push(<div key={`empty-${i}`} className="min-h-[90px] bg-muted/10 rounded-md opacity-40 border border-transparent" />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDateStr(year, month, day);
      const dayEvents = getEventsForDate(dateStr);
      const isToday = dateStr === todayStr;

      cells.push(
        <div
          key={day}
          className={`min-h-[90px] rounded-md border p-1.5 transition-all duration-300 hover:bg-muted/40 hover:shadow-sm ${isToday ? 'border-primary bg-primary/5 shadow-inner' : 'border-border'}`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${isToday ? 'bg-primary text-primary-foreground font-bold' : 'text-foreground'}`}>
              {day}
            </span>
          </div>
          <div className="space-y-1">
            {dayEvents.slice(0, 3).map(ev => {
              const c = EVENT_COLORS[ev.type];
              return (
                <button
                  key={ev.id}
                  data-event-id={ev.id}
                  onClick={handleEventClick}
                  className={`w-full text-left text-[10px] px-2 py-0.5 rounded truncate shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-95 ${c.bg} ${c.text} ${c.border} hover:opacity-90`}
                >
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.dot} mr-1`} />
                  {ev.title}
                </button>
              );
            })}
            {dayEvents.length > 3 && (
              <p className="text-[9px] font-semibold text-muted-foreground px-1 text-right">+{dayEvents.length - 3} more</p>
            )}
          </div>
        </div>
      );
    }

    return <div className="grid grid-cols-7 gap-1.5 animate-in fade-in zoom-in-95 duration-200">{cells}</div>;
  };

  const renderWeekView = () => {
    const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return (
      <div className="grid grid-cols-7 gap-1.5 animate-in fade-in zoom-in-95 duration-200">
        {weekDays.map(d => {
          const dateStr = formatDateStr(d.getFullYear(), d.getMonth(), d.getDate());
          const dayEvents = getEventsForDate(dateStr);
          const isToday = dateStr === todayStr;
          return (
            <div key={d.getTime()} className={`min-h-[160px] rounded-md border p-2.5 transition-all duration-300 hover:bg-muted/40 hover:shadow-sm ${isToday ? 'border-primary bg-primary/5 shadow-inner' : 'border-border'}`}>
              <div className="text-center mb-3">
                <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{dayNames[d.getDay()]}</div>
                <div className={`mt-0.5 inline-flex items-center justify-center w-7 h-7 text-sm font-semibold rounded-full ${isToday ? 'bg-primary text-primary-foreground font-bold' : 'text-foreground'}`}>{d.getDate()}</div>
              </div>
              <div className="space-y-1.5">
                {dayEvents.map(ev => {
                  const c = EVENT_COLORS[ev.type];
                  return (
                    <button
                      key={ev.id}
                      data-event-id={ev.id}
                      onClick={handleEventClick}
                      className={`w-full text-left text-[10px] px-2 py-1 rounded shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-95 ${c.bg} ${c.text} ${c.border} hover:opacity-90`}
                    >
                      <div className="flex items-center gap-1">
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${c.dot}`} />
                        <span className="truncate font-semibold block flex-1">{ev.title}</span>
                      </div>
                      {ev.time && <span className="text-[9px] opacity-75 font-mono mt-0.5 block">{ev.time}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-3">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          {tr(language, 'Dòng thời gian / Lịch dự án', 'Project Timeline / Calendar')}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant={view === 'month' ? 'default' : 'outline'} onClick={() => setView('month')}>{tr(language, 'Chế độ tháng', 'Month View')}</Button>
          <Button size="sm" variant={view === 'week' ? 'default' : 'outline'} onClick={() => setView('week')}>{tr(language, 'Chế độ tuần', 'Week View')}</Button>
          <Button size="sm" variant="outline" onClick={goToday}>{tr(language, 'Hôm nay', 'Today')}</Button>
          <Button size="sm" onClick={() => { resetForm(); setAddOpen(true); }}>
            <Plus className="h-4 w-4 mr-1" /> {tr(language, 'Thêm sự kiện', 'Add Event')}
          </Button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        {(['Meeting', 'Task Deadline', 'Milestone'] as EventType[]).map(t => (
          <span key={t} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${EVENT_COLORS[t].dot}`} />
            {getEventTypeLabel(t)}
          </span>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button size="sm" variant="ghost" onClick={view === 'month' ? prevMonth : prevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="font-display font-semibold text-sm capitalize">{view === 'month' ? monthName : `${weekDays[0].toLocaleDateString('vi-VN')} – ${weekDays[6].toLocaleDateString('vi-VN')}`}</span>
        <Button size="sm" variant="ghost" onClick={view === 'month' ? nextMonth : nextWeek}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {view === 'month' ? renderMonthGrid() : renderWeekView()}

      {/* Add Event Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{tr(language, 'Thêm sự kiện', 'Add Event')}</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>{tr(language, 'Tiêu đề sự kiện', 'Event Title')}</Label>
              <Input
                value={formData.title}
                onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                placeholder={tr(language, 'Nhập tiêu đề', 'Enter title')}
              />
            </div>
            <div className="space-y-1">
              <Label>{tr(language, 'Loại sự kiện', 'Event Type')}</Label>
              <Select value={formData.type} onValueChange={(v: EventType) => setFormData(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Meeting" disabled={!canCreate('Meeting')}>{getEventTypeLabel('Meeting')}</SelectItem>
                  <SelectItem value="Task Deadline" disabled={!canCreate('Task Deadline')}>{getEventTypeLabel('Task Deadline')}</SelectItem>
                  <SelectItem value="Milestone" disabled={!canCreate('Milestone')}>{getEventTypeLabel('Milestone')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{tr(language, 'Ngày', 'Date')}</Label>
                <Input type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>{tr(language, 'Thời gian', 'Time')}</Label>
                <Input type="time" value={formData.time} onChange={e => setFormData(p => ({ ...p, time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>{tr(language, 'Mô tả', 'Description')}</Label>
              <Textarea
                value={formData.description}
                onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                placeholder={tr(language, 'Nhập mô tả', 'Description')}
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={handleSaveEvent}>{tr(language, 'Lưu sự kiện', 'Save Event')}</Button>
              <Button variant="outline" className="flex-1" onClick={() => setAddOpen(false)}>{tr(language, 'Hủy', 'Cancel')}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Event Detail / Edit Dialog */}
      <Dialog open={!!detailEvent} onOpenChange={open => { if (!open) { setDetailEvent(null); setEditMode(false); resetForm(); } }}>
        <DialogContent>
          {detailEvent && !editMode && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${EVENT_COLORS[detailEvent.type].dot}`} />
                  {detailEvent.title}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${EVENT_COLORS[detailEvent.type].bg} ${EVENT_COLORS[detailEvent.type].text}`}>
                    {getEventTypeLabel(detailEvent.type)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarDays className="h-4 w-4" /> {detailEvent.date}
                </div>
                {detailEvent.time && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" /> {detailEvent.time}
                  </div>
                )}
                {detailEvent.description && (
                  <p className="text-muted-foreground bg-muted rounded-lg p-3">{detailEvent.description}</p>
                )}
                <div className="flex gap-2 pt-2">
                  {canEditEvent(detailEvent) && (
                    <Button size="sm" variant="outline" onClick={startEdit}>
                      <Edit className="h-3 w-3 mr-1" /> {tr(language, 'Chỉnh sửa', 'Edit')}
                    </Button>
                  )}
                  {canEditEvent(detailEvent) && (
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteEvent(detailEvent)}>
                      <Trash2 className="h-3 w-3 mr-1" /> {tr(language, 'Xóa', 'Delete')}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setDetailEvent(null)}>{tr(language, 'Đóng', 'Close')}</Button>
                </div>
              </div>
            </>
          )}
          {detailEvent && editMode && (
            <>
              <DialogHeader><DialogTitle>{tr(language, 'Chỉnh sửa sự kiện', 'Edit Event')}</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>{tr(language, 'Tiêu đề sự kiện', 'Event Title')}</Label>
                  <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>{tr(language, 'Loại sự kiện', 'Event Type')}</Label>
                  <Select value={formData.type} onValueChange={(v: EventType) => setFormData(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Meeting">{getEventTypeLabel('Meeting')}</SelectItem>
                      <SelectItem value="Task Deadline">{getEventTypeLabel('Task Deadline')}</SelectItem>
                      <SelectItem value="Milestone">{getEventTypeLabel('Milestone')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>{tr(language, 'Ngày', 'Date')}</Label>
                    <Input type="date" value={formData.date} onChange={e => setFormData(p => ({ ...p, date: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>{tr(language, 'Thời gian', 'Time')}</Label>
                    <Input type="time" value={formData.time} onChange={e => setFormData(p => ({ ...p, time: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>{tr(language, 'Mô tả', 'Description')}</Label>
                  <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div className="flex gap-2">
                  <Button className="flex-1" onClick={handleSaveEvent}>{tr(language, 'Lưu', 'Save')}</Button>
                  <Button variant="outline" className="flex-1" onClick={() => setEditMode(false)}>{tr(language, 'Hủy', 'Cancel')}</Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      </div>
    </section>
  );
};

export default ProjectCalendar;
