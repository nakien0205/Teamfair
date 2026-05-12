import { useState } from 'react';
import { MemberStat } from '@/context/TeamContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend } from 'recharts';
import { AlertTriangle, Info, TrendingUp } from 'lucide-react';

interface Props {
  members: MemberStat[];
  showScoreCard?: boolean;
  currentUserName?: string;
  showFreeriderWarning?: boolean;
}

const COLORS = [
  'hsl(217, 91%, 50%)',
  'hsl(172, 66%, 40%)',
  'hsl(38, 92%, 55%)',
  'hsl(0, 72%, 55%)',
  'hsl(280, 60%, 50%)',
];

const getInitials = (name: string) => name.split(' ').map(w => w[0]).join('').slice(-2).toUpperCase();

const calcContributionScore = (m: MemberStat) => {
  const taskScore = Math.min(m.completedTasks * 20, 40);
  const contribScore = Math.min(m.contributionPercent * 0.6, 60);
  return Math.round(taskScore + contribScore);
};

const ContributionAnalytics = ({ members, showScoreCard, currentUserName, showFreeriderWarning }: Props) => {
  const [explainOpen, setExplainOpen] = useState(false);
  const sorted = [...members].sort((a, b) => b.contributionPercent - a.contributionPercent);
  const currentUser = members.find(m => m.name === currentUserName);
  const personalScore = currentUser ? calcContributionScore(currentUser) : 0;

  const barData = sorted.map(m => ({ name: m.name.split(' ').slice(-1)[0], contribution: m.contributionPercent, tasks: m.completedTasks }));

  const radarData = sorted.map(m => ({
    name: m.name.split(' ').slice(-1)[0],
    'Đóng góp': m.contributionPercent,
    'Tasks': Math.min(m.completedTasks * 25, 100),
    'Hoạt động': Math.min(m.contributionPercent + m.completedTasks * 10, 100),
  }));

  const freeriders = showFreeriderWarning ? members.filter(m => m.contributionPercent < 20 && m.contributionPercent >= 0 && members.length > 1) : [];

  return (
    <div className="space-y-6">
      {/* Member cards with avatars */}
      <div className="space-y-3">
        {sorted.map((m, i) => (
          <div key={m.name} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-xs font-semibold" style={{ backgroundColor: COLORS[i % COLORS.length], color: 'white' }}>
                {getInitials(m.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm truncate">{m.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{m.role}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <Progress value={m.contributionPercent} className="h-2.5 flex-1" />
                <span className="text-sm font-semibold w-10 text-right">{m.contributionPercent}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{m.completedTasks} task hoàn thành</p>
            </div>
          </div>
        ))}
      </div>

      {/* Free-rider warnings */}
      {freeriders.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="font-semibold text-sm text-destructive">⚠ Low contribution detected</span>
          </div>
          {freeriders.map(m => (
            <p key={m.name} className="text-sm text-muted-foreground ml-6">
              {m.name} — chỉ {m.contributionPercent}% đóng góp
            </p>
          ))}
        </div>
      )}

      {/* Score card */}
      {showScoreCard && currentUser && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Your Contribution Score</p>
              <p className="text-3xl font-display font-bold text-primary">{personalScore} <span className="text-lg text-muted-foreground">/ 100</span></p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setExplainOpen(true)}>
              <Info className="h-4 w-4 mr-1" /> Explain Score
            </Button>
          </div>
        </div>
      )}

      {/* Bar chart */}
      <div>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-1">
          <TrendingUp className="h-4 w-4" /> Contribution Chart
        </h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="contribution" fill="hsl(217, 91%, 50%)" radius={[4, 4, 0, 0]} name="Đóng góp %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Radar chart */}
      {members.length >= 2 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Radar Chart</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(220, 14%, 88%)" />
                <PolarAngleAxis dataKey="name" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Đóng góp" dataKey="Đóng góp" stroke="hsl(217, 91%, 50%)" fill="hsl(217, 91%, 50%)" fillOpacity={0.3} />
                <Radar name="Tasks" dataKey="Tasks" stroke="hsl(172, 66%, 40%)" fill="hsl(172, 66%, 40%)" fillOpacity={0.2} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Explain modal */}
      <Dialog open={explainOpen} onOpenChange={setExplainOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Contribution Score Explained</DialogTitle></DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Contribution Score is calculated from:</p>
            <ul className="space-y-2 ml-4">
              <li className="flex items-start gap-2"><span className="font-semibold text-primary">40%</span> Tasks completed — number of approved tasks</li>
              <li className="flex items-start gap-2"><span className="font-semibold text-primary">20%</span> Deadlines met — tasks finished before deadline</li>
              <li className="flex items-start gap-2"><span className="font-semibold text-primary">15%</span> Task participation — engagement across project</li>
              <li className="flex items-start gap-2"><span className="font-semibold text-primary">15%</span> Evidence uploads — supporting documentation</li>
              <li className="flex items-start gap-2"><span className="font-semibold text-primary">10%</span> Peer interaction — peer evaluations given/received</li>
            </ul>
            <div className="rounded-lg bg-muted p-3 mt-3">
              <p className="font-medium">Your current score: <span className="text-primary">{personalScore}/100</span></p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContributionAnalytics;
