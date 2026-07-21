import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Task } from "@/context/TeamContext";
import type { PeerReviewPeriod } from "@/lib/studentPeerReview";

export type PeerReviewManagerRole = "lecturer" | "leader" | "student" | "admin" | null | undefined;

export type PeerReviewLeaderSummary = {
  revieweeId: string;
  selectedTaskCount: number;
  reviewCount: number;
  averageScore: number | null;
  submittedBundleCount: number;
  requiredBundleCount: number;
};

export function canManagePeerReview(role: PeerReviewManagerRole, isGroupLeader: boolean): boolean {
  return role === "lecturer" || role === "admin" || (role === "student" && isGroupLeader);
}

export function getPeerReviewEligibleTasks(tasks: Task[]): Task[] {
  return tasks.filter(task => Boolean(task.id && task.assigneeId));
}

function mapPeriod(row: Record<string, unknown>): PeerReviewPeriod {
  return {
    id: String(row.id), groupId: String(row.group_id), title: String(row.title),
    milestoneLabel: typeof row.milestone_label === "string" ? row.milestone_label : null,
    status: row.status as PeerReviewPeriod["status"], startAt: String(row.start_at), endAt: String(row.end_at),
    allowLeaderSummary: Boolean(row.allow_leader_summary),
  };
}

export async function listManagedPeerReviewPeriods(groupId: string): Promise<PeerReviewPeriod[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.from("peer_review_periods")
    .select("id, group_id, title, milestone_label, status, start_at, end_at, allow_leader_summary")
    .eq("group_id", groupId).order("start_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(row => mapPeriod(row as Record<string, unknown>));
}

export async function createManagedPeerReviewPeriod(input: {
  groupId: string; title: string; milestoneLabel?: string; endAt: string; taskIds: string[];
}): Promise<PeerReviewPeriod> {
  const { data, error } = await supabase.rpc("create_peer_review_period", {
    p_group_id: input.groupId, p_title: input.title, p_milestone_label: input.milestoneLabel || null,
    p_end_at: input.endAt, p_task_ids: input.taskIds,
  });
  if (error) throw new Error(error.message);
  return mapPeriod(data as Record<string, unknown>);
}

export async function changePeerReviewPeriodStatus(period: PeerReviewPeriod, status: "closed" | "reopened", endAt?: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const update: Record<string, string> = { status };
  if (status === "reopened") update.end_at = endAt || period.endAt;
  const { error } = await supabase.from("peer_review_periods").update(update).eq("id", period.id);
  if (error) throw new Error(error.message);
}

export async function getLeaderPeerReviewSummary(periodId: string): Promise<PeerReviewLeaderSummary[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase.rpc("get_peer_review_leader_summary", { p_period_id: periodId });
  if (error) throw new Error(error.message);
  return (data || []).map((row: Record<string, unknown>) => ({
    revieweeId: String(row.reviewee_id), selectedTaskCount: Number(row.selected_task_count),
    reviewCount: Number(row.review_count), averageScore: row.average_score === null ? null : Number(row.average_score),
    submittedBundleCount: Number(row.submitted_bundle_count), requiredBundleCount: Number(row.required_bundle_count),
  }));
}

