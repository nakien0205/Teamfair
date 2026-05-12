import { useTeam } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useLanguage } from '@/context/LanguageContext';
import { tr } from '@/lib/i18n';

const LecturerReports = () => {
  const { reports, markReportReviewed } = useTeam();
  const { toast } = useToast();
  const { language } = useLanguage();

  if (reports.length === 0) {
    return (
      <section className="bg-card rounded-xl p-6 shadow-card border border-border">
        <h2 className="font-display text-lg font-semibold mb-4">
          <AlertTriangle className="h-5 w-5 inline mr-1" /> {tr(language, 'Báo cáo / Cảnh báo', 'Reports / Alerts')}
        </h2>
        <p className="text-muted-foreground text-sm text-center py-4">{tr(language, 'Chưa có báo cáo nào', 'No reports yet')}</p>
      </section>
    );
  }

  return (
    <section className="bg-card rounded-xl p-6 shadow-card border border-border">
      <h2 className="font-display text-lg font-semibold mb-4">
        <AlertTriangle className="h-5 w-5 inline mr-1 text-destructive" /> {tr(language, 'Báo cáo / Cảnh báo', 'Reports / Alerts')}
        <span className="ml-2 text-xs bg-destructive/10 text-destructive rounded-full px-2 py-0.5">
          {reports.filter(r => !r.reviewed).length} {tr(language, 'mới', 'new')}
        </span>
      </h2>
      <div className="space-y-3">
        {reports.map(r => (
          <div key={r.id} className={`rounded-lg border p-4 transition-colors ${r.reviewed ? 'border-border bg-muted/30' : 'border-destructive/30 bg-destructive/5'}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold">{tr(language, 'Đã nhận báo cáo từ sinh viên', 'Student report received')}</p>
                <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                  <p>{tr(language, 'Người báo cáo', 'Reporter')}: <span className="text-foreground">{r.from}</span></p>
                  <p>{tr(language, 'Sinh viên bị báo cáo', 'Reported student')}: <span className="text-foreground">{r.to}</span></p>
                  <p>{tr(language, 'Lý do', 'Reason')}: <span className="text-foreground">{r.reason}</span></p>
                  {r.notes && <p>{tr(language, 'Ghi chú', 'Notes')}: <span className="text-foreground">{r.notes}</span></p>}
                  <p className="text-xs">{tr(language, 'Thời gian', 'Time')}: {r.timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {r.timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <div className="flex gap-1">
                {!r.reviewed && (
                  <Button size="sm" variant="outline" onClick={() => {
                    markReportReviewed(r.id);
                    toast({
                      title: tr(language, 'Đã đánh dấu đã xem', 'Marked as reviewed'),
                      description: tr(language, `Report về ${r.to}`, `Review for ${r.to}`),
                    });
                  }}>
                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> {tr(language, 'Đánh dấu đã xem', 'Mark as reviewed')}
                  </Button>
                )}
                {r.reviewed && (
                  <span className="text-xs bg-success/10 text-success px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" /> {tr(language, 'Đã xem', 'Reviewed')}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default LecturerReports;
