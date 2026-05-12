import { useState, useRef } from 'react';
import { useTeam } from '@/context/TeamContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { FileText, Upload, Save, RotateCcw } from 'lucide-react';

interface RubricRow {
  name: string;
  contribution: number;
  quality: number;
  teamwork: number;
}

const RubricManager = () => {
  const { groups, currentGroupIndex } = useTeam();
  const { toast } = useToast();
  const group = groups[currentGroupIndex];
  const fileRef = useRef<HTMLInputElement>(null);
  const [rubricLoaded, setRubricLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const initialScores = (): RubricRow[] => group.members.map(m => ({
    name: m.name,
    contribution: Math.round(5 + Math.random() * 5),
    quality: Math.round(5 + Math.random() * 5),
    teamwork: Math.round(5 + Math.random() * 5),
  }));

  const [scores, setScores] = useState<RubricRow[]>(initialScores);
  const [savedScores, setSavedScores] = useState<RubricRow[] | null>(null);

  const getFinal = (r: RubricRow) => ((r.contribution + r.quality + r.teamwork) / 3).toFixed(1);

  const handleUploadRubric = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast({ title: 'Lỗi', description: 'Vui lòng chọn file PDF', variant: 'destructive' });
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setScores(initialScores());
      setRubricLoaded(true);
      setLoading(false);
      toast({ title: 'Rubric loaded', description: `AI đã chuyển đổi "${file.name}" thành bảng chấm điểm` });
      if (fileRef.current) fileRef.current.value = '';
    }, 1500);
  };

  const updateScore = (idx: number, field: keyof Omit<RubricRow, 'name'>, val: string) => {
    const n = Math.min(10, Math.max(0, Number(val)));
    setScores(prev => prev.map((r, i) => i === idx ? { ...r, [field]: n } : r));
  };

  const handleSave = () => {
    setSavedScores([...scores]);
    toast({ title: 'Đã lưu điểm', description: 'Rubric scores saved successfully' });
  };

  const handleReset = () => {
    if (savedScores) {
      setScores([...savedScores]);
    } else {
      setScores(initialScores());
    }
    toast({ title: 'Đã reset', description: 'Scores reverted' });
  };

  return (
    <section className="bg-card rounded-xl p-6 shadow-card border border-border">
      <h2 className="font-display text-lg font-semibold mb-4">
        <FileText className="h-5 w-5 inline mr-1" /> Rubric Management
      </h2>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input type="file" ref={fileRef} accept=".pdf" className="hidden" />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={loading}>
          <Upload className="h-4 w-4 mr-1" /> Upload Rubric PDF
        </Button>
        {loading && <span className="text-sm text-muted-foreground animate-pulse">AI đang xử lý rubric...</span>}
      </div>

      {(rubricLoaded || true) && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">Student</th>
                  <th className="text-center px-4 py-2 font-medium">Contribution</th>
                  <th className="text-center px-4 py-2 font-medium">Quality</th>
                  <th className="text-center px-4 py-2 font-medium">Teamwork</th>
                  <th className="text-center px-4 py-2 font-medium">Final Score</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((r, i) => (
                  <tr key={r.name} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2">
                      <Input type="number" min={0} max={10} className="w-16 h-8 text-center text-sm mx-auto" value={r.contribution} onChange={e => updateScore(i, 'contribution', e.target.value)} />
                    </td>
                    <td className="px-4 py-2">
                      <Input type="number" min={0} max={10} className="w-16 h-8 text-center text-sm mx-auto" value={r.quality} onChange={e => updateScore(i, 'quality', e.target.value)} />
                    </td>
                    <td className="px-4 py-2">
                      <Input type="number" min={0} max={10} className="w-16 h-8 text-center text-sm mx-auto" value={r.teamwork} onChange={e => updateScore(i, 'teamwork', e.target.value)} />
                    </td>
                    <td className="px-4 py-2 text-center font-semibold">{getFinal(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={handleSave}><Save className="h-4 w-4 mr-1" /> Save Grades</Button>
            <Button size="sm" variant="outline" onClick={handleReset}><RotateCcw className="h-4 w-4 mr-1" /> Reset</Button>
          </div>
        </>
      )}
    </section>
  );
};

export default RubricManager;
