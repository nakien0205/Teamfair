import { useTeam } from '@/context/TeamContext';
import ContributionAnalytics from '@/components/ContributionAnalytics';
import { tr } from '@/lib/i18n';
import { useLanguage } from '@/context/LanguageContext';
import { PremiumGate } from '@/components/PremiumGate';

const LecturerContributionPage = () => {
  const { groups, currentGroupIndex } = useTeam();
  const { language } = useLanguage();
  const group = groups[currentGroupIndex];

  if (!group) return null;

  return (
    <div className="space-y-6">
      <PremiumGate><section className="bg-card rounded-xl p-6 shadow-card border border-border">
        <h2 className="font-display text-lg font-semibold mb-4">
          {tr(language, 'Phân tích đóng góp', 'Contribution analytics')} — {group.name}
        </h2>
        <ContributionAnalytics
          members={group.members}
          showFreeriderWarning
        />
      </section></PremiumGate>
    </div>
  );
};

export default LecturerContributionPage;
