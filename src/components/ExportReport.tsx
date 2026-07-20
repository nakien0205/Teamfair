import { useTeam } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Download } from 'lucide-react';
import { useEntitlements } from '@/context/EntitlementContext';
import { hasProGroupFeatures } from '@/lib/billing';

const getGrade = (score: number): string => {
  if (score >= 8.5) return 'A';
  if (score >= 7) return 'B';
  if (score >= 5.5) return 'C';
  if (score >= 4) return 'D';
  return 'F';
};

const ExportReport = () => {
  const { groups, currentGroupIndex } = useTeam();
  const { toast } = useToast();
  const { plan } = useEntitlements();
  const group = groups[currentGroupIndex];

  const generateData = () => {
    return group.members.map(m => {
      const rubricScore = m.lecturerScore ?? ((10 * m.contributionPercent / 100) * 0.8 + 5);
      const finalScore = Math.min(10, rubricScore);
      return {
        name: m.name,
        contribution: `${m.contributionPercent}%`,
        rubricScore: finalScore.toFixed(1),
        finalGrade: getGrade(finalScore),
      };
    });
  };

  const exportCSV = () => {
    if (!hasProGroupFeatures(plan)) return;
    const data = generateData();
    const header = 'Student Name,Contribution,Rubric Score,Final Score\n';
    const rows = data.map(d => `${d.name},${d.contribution},${d.rubricScore},${d.finalGrade}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${group.name}_report.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported CSV', description: `${group.name}_report.csv` });
  };

  const exportExcel = () => {
    if (!hasProGroupFeatures(plan)) return;
    // Simulate Excel export with tab-separated values
    const data = generateData();
    const header = 'Student Name\tContribution\tRubric Score\tFinal Score\n';
    const rows = data.map(d => `${d.name}\t${d.contribution}\t${d.rubricScore}\t${d.finalGrade}`).join('\n');
    const blob = new Blob([header + rows], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${group.name}_report.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported Excel', description: `${group.name}_report.xls` });
  };

  return (
    <section className="bg-card rounded-xl p-6 shadow-card border border-border">
      <h2 className="font-display text-lg font-semibold mb-4">
        <Download className="h-5 w-5 inline mr-1" /> Export Report
      </h2>

      {/* Preview */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead className="bg-muted">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Student Name</th>
              <th className="text-center px-4 py-2 font-medium">Contribution</th>
              <th className="text-center px-4 py-2 font-medium">Rubric Score</th>
              <th className="text-center px-4 py-2 font-medium">Final Score</th>
            </tr>
          </thead>
          <tbody>
            {generateData().map(d => (
              <tr key={d.name} className="border-b border-border last:border-0">
                <td className="px-4 py-2 font-medium">{d.name}</td>
                <td className="px-4 py-2 text-center">{d.contribution}</td>
                <td className="px-4 py-2 text-center">{d.rubricScore}</td>
                <td className="px-4 py-2 text-center font-semibold">{d.finalGrade}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={exportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        <Button size="sm" variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" /> Excel</Button>
      </div>
    </section>
  );
};

export default ExportReport;
