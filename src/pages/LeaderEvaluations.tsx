import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/context/TeamContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  canManagePeerReview, changePeerReviewPeriodStatus, createManagedPeerReviewPeriod,
  getLeaderPeerReviewSummary, getPeerReviewEligibleTasks, listManagedPeerReviewPeriods,
  type PeerReviewLeaderSummary,
} from "@/lib/peerReviewManagement";
import type { PeerReviewPeriod } from "@/lib/studentPeerReview";

const LeaderEvaluations = () => {
  const { user, profile } = useAuth();
  const { groups, currentGroupIndex } = useTeam();
  const { toast } = useToast();
  const group = groups[currentGroupIndex] || groups[0];
  const isLeader = Boolean(group?.members.some(member => member.id === user?.id && member.role === "Leader"));
  const canManage = canManagePeerReview(profile?.role, isLeader);
  const eligibleTasks = useMemo(() => getPeerReviewEligibleTasks(group?.tasks || []), [group?.tasks]);
  const [periods, setPeriods] = useState<PeerReviewPeriod[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [title, setTitle] = useState("Đợt đánh giá chéo");
  const [endAt, setEndAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<PeerReviewLeaderSummary[]>([]);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!group?.id) return;
    const next = await listManagedPeerReviewPeriods(group.id);
    setPeriods(next);
    const latest = next[0];
    if (latest) setSummary(await getLeaderPeerReviewSummary(latest.id)); else setSummary([]);
  }, [group?.id]);
  useEffect(() => { void reload().catch(err => setError(err instanceof Error ? err.message : "Không thể tải kỳ đánh giá.")); }, [reload]);

  const createPeriod = async () => {
    if (!group?.id) return;
    setBusy(true); setError("");
    try {
      await createManagedPeerReviewPeriod({ groupId: group.id, title, endAt: new Date(endAt).toISOString(), taskIds: selectedTaskIds });
      await reload(); setSelectedTaskIds([]); toast({ title: "Đã mở kỳ đánh giá" });
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể mở kỳ đánh giá."); }
    finally { setBusy(false); }
  };
  const updateStatus = async (period: PeerReviewPeriod, status: "closed" | "reopened") => {
    setBusy(true); setError("");
    try {
      const nextEndAt = status === "reopened" ? new Date(Date.now() + 7 * 86400000).toISOString() : undefined;
      await changePeerReviewPeriodStatus(period, status, nextEndAt); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "Không thể cập nhật kỳ đánh giá."); }
    finally { setBusy(false); }
  };

  if (!group) return <div className="container mx-auto max-w-6xl px-6 py-6">Bạn chưa thuộc nhóm.</div>;
  if (!isLeader) return <div className="container mx-auto max-w-6xl px-6 py-6"><Alert><AlertDescription>Chỉ group leader mới xem được tổng hợp đánh giá chéo.</AlertDescription></Alert></div>;
  return <div className="container mx-auto max-w-6xl space-y-6 px-6 py-6">
    <Card><CardHeader><CardTitle>Đánh giá thành viên theo task</CardTitle><CardDescription>Leader chỉ thấy tiến độ và điểm tổng hợp ẩn danh; không thấy tên người đánh giá hoặc nhận xét.</CardDescription></CardHeader></Card>
    {!canManage ? <Alert><AlertDescription>Chỉ group leader hoặc giảng viên sở hữu nhóm mới có thể quản lý kỳ đánh giá.</AlertDescription></Alert> : null}
    {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
    {canManage ? <Card><CardHeader><CardTitle>Mở kỳ đánh giá</CardTitle><CardDescription>Chọn task đã gán cho thành viên. Phạm vi được chụp lại khi mở kỳ.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2"><div><Label>Tiêu đề</Label><Input value={title} onChange={e => setTitle(e.target.value)} /></div><div><Label>Đóng lúc</Label><Input type="datetime-local" value={endAt} onChange={e => setEndAt(e.target.value)} /></div></div>
      <div className="space-y-2">{eligibleTasks.map(task => <label key={task.id} className="flex items-center gap-3 rounded border p-3"><Checkbox checked={selectedTaskIds.includes(task.id)} onCheckedChange={checked => setSelectedTaskIds(current => checked ? [...current, task.id] : current.filter(id => id !== task.id))} />{task.name} — {task.assignedTo}</label>)}</div>
      <Button disabled={busy || !title.trim() || !endAt || selectedTaskIds.length === 0} onClick={() => void createPeriod()}>Mở kỳ đánh giá</Button>
    </CardContent></Card> : null}
    <Card><CardHeader><CardTitle>Kỳ đánh giá</CardTitle></CardHeader><CardContent className="space-y-3">{periods.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có kỳ đánh giá.</p> : periods.map(period => <div key={period.id} className="flex flex-wrap items-center justify-between gap-3 rounded border p-4"><div><p className="font-medium">{period.title}</p><p className="text-sm text-muted-foreground">Đến {new Date(period.endAt).toLocaleString()}</p></div><div className="flex items-center gap-2"><Badge>{period.status}</Badge>{canManage && period.status !== "closed" ? <Button size="sm" variant="outline" disabled={busy} onClick={() => void updateStatus(period, "closed")}>Đóng</Button> : null}{canManage && period.status === "closed" ? <Button size="sm" disabled={busy} onClick={() => void updateStatus(period, "reopened")}>Mở lại 7 ngày</Button> : null}</div></div>)}</CardContent></Card>
    {periods[0] ? <Card><CardHeader><CardTitle>Tổng hợp ẩn danh</CardTitle><CardDescription>{summary[0] ? `${summary[0].submittedBundleCount}/${summary[0].requiredBundleCount} thành viên đã nộp.` : "Chưa có dữ liệu."}</CardDescription></CardHeader><CardContent className="space-y-2">{summary.map(item => <div key={item.revieweeId} className="flex justify-between rounded border p-3 text-sm"><span>Thành viên (ẩn danh) · {item.selectedTaskCount} task</span><span>{item.reviewCount} đánh giá · {item.averageScore ?? "—"}/5</span></div>)}</CardContent></Card> : null}
  </div>;
};
export default LeaderEvaluations;
