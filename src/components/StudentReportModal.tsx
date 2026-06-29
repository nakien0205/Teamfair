import { useState } from 'react';
import { useTeam, MemberStat } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Flag } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { tr } from '@/lib/i18n';
import { useNotifications } from '@/context/NotificationContext';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetMember: MemberStat | null;
  currentUser: string;
}

const REASONS = [
  { value: 'Late submission', vi: 'Nộp bài muộn' },
  { value: 'Did not complete tasks', vi: 'Chưa hoàn thành nhiệm vụ' },
  { value: 'Not participating', vi: 'Không tham gia' },
  { value: 'Other', vi: 'Khác' },
];

const StudentReportModal = ({ open, onOpenChange, targetMember, currentUser }: Props) => {
  const { addReport, groups, currentGroupIndex } = useTeam();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { sendNotification } = useNotifications();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = () => {
    if (!targetMember || !reason) {
      toast({ title: tr(language, 'Lỗi', 'Error'), description: tr(language, 'Vui lòng chọn lý do', 'Please select a reason'), variant: 'destructive' });
      return;
    }
    addReport({ from: currentUser, to: targetMember.name, reason, notes });

    void sendNotification(
      "lecturer",
      currentUser,
      tr(
        language,
        `Đã gửi báo cáo về ${targetMember.name}: ${reason}`,
        `Submitted a report on ${targetMember.name}: ${reason}`
      ),
      groups[currentGroupIndex]?.id
    );

    toast({
      title: tr(language, 'Đã gửi báo cáo cho giảng viên', 'Report sent to lecturer'),
      description: tr(language, `Đã báo cáo ${targetMember.name}`, `Report submitted for ${targetMember.name}`),
    });
    setReason('');
    setNotes('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-destructive" /> {tr(language, 'Báo cáo sinh viên', 'Report student')}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>{tr(language, 'Báo cáo sinh viên', 'Reported student')}</Label>
            <p className="text-sm font-medium mt-1 bg-muted rounded px-3 py-2">{targetMember?.name}</p>
          </div>
          <div className="space-y-1">
            <Label>{tr(language, 'Lý do', 'Reason')}</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder={tr(language, 'Chọn lý do', 'Pick a reason')} /></SelectTrigger>
              <SelectContent>
                {REASONS.map(r => (
                  <SelectItem key={r.value} value={r.value}>
                    {language === "vi" ? r.vi : r.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>{tr(language, 'Ghi chú thêm', 'Additional notes')}</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder={tr(language, 'Ghi chú thêm...', 'Optional notes...')} />
          </div>
          <Button className="w-full" onClick={handleSubmit}>{tr(language, 'Gửi báo cáo', 'Submit report')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentReportModal;
