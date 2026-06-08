import { useTeam } from '@/context/TeamContext';
import { tr } from '@/lib/i18n';
import { useLanguage } from '@/context/LanguageContext';
import { Clock } from 'lucide-react';

const LecturerActivityPage = () => {
  const { groups, currentGroupIndex } = useTeam();
  const { language } = useLanguage();
  const group = groups[currentGroupIndex];

  if (!group) return null;

  return (
    <div className="space-y-6">
      <section className="bg-card rounded-xl p-6 shadow-card border border-border">
        <h2 className="font-display text-lg font-semibold mb-4">
          <Clock className="h-5 w-5 inline mr-1" />
          {tr(language, 'Nhật ký hoạt động', 'Activity log')} — {group.name}
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
          {group.activityLog.length === 0 && (
            <p className="text-slate-500 italic text-sm">{tr(language, 'Chưa có hoạt động nào.', 'No activities yet.')}</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default LecturerActivityPage;
