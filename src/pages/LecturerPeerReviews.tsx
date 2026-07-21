import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeam } from "@/context/TeamContext";
import { supabase } from "@/lib/supabaseClient";
import { listManagedPeerReviewPeriods } from "@/lib/peerReviewManagement";
import type { PeerReviewPeriod } from "@/lib/studentPeerReview";

type DetailRow = { id: string; overall_score: number; comment: string | null; submitted_at: string; reviewer?: { full_name?: string | null } | null; reviewee?: { full_name?: string | null } | null; peer_review_period_tasks?: { task_title?: string | null; task_snapshot?: Record<string, unknown> | null } | null };

const LecturerPeerReviews = () => {
  const { groupId } = useParams(); const navigate = useNavigate(); const { groups, currentGroupIndex } = useTeam();
  const group = groups.find(item => item.id === groupId) || groups[currentGroupIndex] || groups[0];
  const [periods, setPeriods] = useState<PeerReviewPeriod[]>([]); const [periodId, setPeriodId] = useState("");
  const [rows, setRows] = useState<DetailRow[]>([]); const [error, setError] = useState("");
  useEffect(() => { if (!group?.id) return; void listManagedPeerReviewPeriods(group.id).then(next => { setPeriods(next); setPeriodId(next[0]?.id || ""); }).catch(err => setError(err.message)); }, [group?.id]);
  useEffect(() => { if (!periodId) { setRows([]); return; } void supabase.from("peer_reviews").select("id,overall_score,comment,submitted_at,reviewer:reviewer_id(full_name),reviewee:reviewee_id(full_name),peer_review_period_tasks(task_title,task_snapshot)").eq("period_id", periodId).order("submitted_at", { ascending: false }).then(({ data, error: queryError }) => { if (queryError) setError(queryError.message); else setRows((data || []) as DetailRow[]); }); }, [periodId]);
  return <div className="container mx-auto max-w-6xl space-y-6 px-6 py-6"><Button variant="outline" onClick={() => navigate(`/lecturer/groups/${group?.id || ""}`)}>Quay lại nhóm</Button><Card><CardHeader><CardTitle>Chi tiết đánh giá chéo</CardTitle><CardDescription>Giảng viên xem được người đánh giá, nhận xét và task snapshot. Dữ liệu này không hiển thị cho leader.</CardDescription></CardHeader><CardContent><Select value={periodId} onValueChange={setPeriodId}><SelectTrigger><SelectValue placeholder="Chọn kỳ đánh giá" /></SelectTrigger><SelectContent>{periods.map(period => <SelectItem key={period.id} value={period.id}>{period.title}</SelectItem>)}</SelectContent></Select></CardContent></Card>{error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}<div className="space-y-3">{rows.map(row => <Card key={row.id}><CardContent className="space-y-2 p-5"><div className="flex flex-wrap justify-between gap-2"><strong>{row.reviewee?.full_name || "Thành viên"} · {row.peer_review_period_tasks?.task_title || "Task snapshot"}</strong><span>{row.overall_score}/5</span></div><p className="text-sm">Reviewer: {row.reviewer?.full_name || "—"}</p><p className="text-sm text-muted-foreground">{row.comment || "Không có nhận xét."}</p></CardContent></Card>)}</div></div>;
};
export default LecturerPeerReviews;
