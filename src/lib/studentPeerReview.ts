import { z } from "zod";
import type { Group } from "@/context/TeamContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type PeerReviewPeriod = {
  id: string;
  groupId: string;
  title: string;
  milestoneLabel?: string | null;
  status: "open" | "closed" | "reopened";
  startAt: string;
  endAt: string;
  allowLeaderSummary: boolean;
};

export type PeerReviewTarget = {
  id: string;
  fullName: string;
  role: "Leader" | "Member";
};

export type PeerReviewInput = {
  revieweeId: string;
  completionScore: number;
  deadlineScore: number;
  collaborationScore: number;
  responsivenessScore: number;
  overallScore: number;
  comment: string;
};

export type PeerReviewStatus = {
  periodId: string;
  reviewerId: string;
  submitted: boolean;
  submittedAt?: string | null;
};

const scoreSchema = z.number().int().min(1).max(5);

export const peerReviewFormSchema = z.object({
  revieweeId: z.string().uuid("Bạn không thể đánh giá chính mình."),
  completionScore: scoreSchema,
  deadlineScore: scoreSchema,
  collaborationScore: scoreSchema,
  responsivenessScore: scoreSchema,
  overallScore: scoreSchema,
  comment: z.string().trim(),
});

type DbPeerReviewPeriod = {
  id: string;
  group_id: string;
  title: string;
  milestone_label: string | null;
  status: "open" | "closed" | "reopened";
  start_at: string;
  end_at: string;
  allow_leader_summary: boolean;
};

type DbPeerReviewStatusRow = {
  period_id: string;
  reviewer_id: string;
  submitted_at: string;
};

export function getPeerReviewTargets(group: Group | undefined, currentUserId?: string | null): PeerReviewTarget[] {
  if (!group) return [];
  return group.members
    .filter(member => member.id && member.id !== currentUserId)
    .map(member => ({
      id: member.id as string,
      fullName: member.name,
      role: member.role === "Leader" ? "Leader" : "Member",
    }));
}

export function validatePeerReviewSubmission(params: {
  currentUserId?: string | null;
  period?: PeerReviewPeriod | null;
  reviews: PeerReviewInput[];
  targets: PeerReviewTarget[];
  honestyConfirmed: boolean;
  alreadySubmitted?: boolean;
  now?: Date;
}): { ok: true } | { ok: false; message: string } {
  if (!params.period) {
    return { ok: false, message: "Kỳ đánh giá đã đóng." };
  }

  if (params.period.status === "closed") {
    return { ok: false, message: "Kỳ đánh giá đã đóng." };
  }

  if (params.alreadySubmitted) {
    return { ok: false, message: "Bạn đã hoàn thành đánh giá chéo cho kỳ này." };
  }

  const now = params.now || new Date();
  if (new Date(params.period.endAt).getTime() < now.getTime() && params.period.status !== "reopened") {
    return { ok: false, message: "Kỳ đánh giá đã đóng." };
  }

  if (!params.honestyConfirmed) {
    return { ok: false, message: "Bạn cần xác nhận trước khi gửi." };
  }

  if (params.reviews.length !== params.targets.length) {
    return { ok: false, message: "Vui lòng đánh giá đầy đủ tất cả thành viên." };
  }

  const seen = new Set<string>();
  for (const review of params.reviews) {
    if (review.revieweeId === params.currentUserId) {
      return { ok: false, message: "Bạn không thể đánh giá chính mình." };
    }

    if (!params.targets.some(target => target.id === review.revieweeId)) {
      return { ok: false, message: "Vui lòng đánh giá đầy đủ tất cả thành viên." };
    }

    if (seen.has(review.revieweeId)) {
      return { ok: false, message: "Vui lòng đánh giá đầy đủ tất cả thành viên." };
    }
    seen.add(review.revieweeId);

    const parsed = peerReviewFormSchema.safeParse(review);
    if (!parsed.success) {
      return { ok: false, message: "Vui lòng đánh giá đầy đủ tất cả thành viên." };
    }

    const hasLowScore = [
      review.completionScore,
      review.deadlineScore,
      review.collaborationScore,
      review.responsivenessScore,
      review.overallScore,
    ].some(score => score <= 2);

    if (hasLowScore && review.comment.trim().length < 20) {
      return { ok: false, message: "Vui lòng nhập nhận xét khi cho điểm thấp." };
    }
  }

  return { ok: true };
}

export async function listActivePeerReviewPeriods(groupId: string): Promise<PeerReviewPeriod[]> {
  if (!isSupabaseConfigured) {
    return [
      {
        id: "demo-peer-period",
        groupId,
        title: "Đợt đánh giá giữa kỳ",
        milestoneLabel: "Milestone 1",
        status: "open",
        startAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        endAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
        allowLeaderSummary: false,
      },
    ];
  }

  const { data, error } = await supabase
    .from("peer_review_periods")
    .select("id, group_id, title, milestone_label, status, start_at, end_at, allow_leader_summary")
    .eq("group_id", groupId)
    .in("status", ["open", "reopened"])
    .order("start_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map((row: DbPeerReviewPeriod) => ({
    id: row.id,
    groupId: row.group_id,
    title: row.title,
    milestoneLabel: row.milestone_label,
    status: row.status,
    startAt: row.start_at,
    endAt: row.end_at,
    allowLeaderSummary: row.allow_leader_summary,
  }));
}

export async function getPeerReviewStatus(periodId: string, reviewerId: string): Promise<PeerReviewStatus> {
  if (!isSupabaseConfigured) {
    return { periodId, reviewerId, submitted: false, submittedAt: null };
  }

  const { data, error } = await supabase
    .from("peer_reviews")
    .select("period_id, reviewer_id, submitted_at")
    .eq("period_id", periodId)
    .eq("reviewer_id", reviewerId)
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return { periodId, reviewerId, submitted: false, submittedAt: null };

  const row = data as DbPeerReviewStatusRow;
  return {
    periodId: row.period_id,
    reviewerId: row.reviewer_id,
    submitted: true,
    submittedAt: row.submitted_at,
  };
}

export async function getReceivedPeerReviewAverage(periodId: string | null, revieweeId: string): Promise<number | null> {
  if (!periodId || !isSupabaseConfigured) return null;
  const { data, error } = await supabase.rpc("get_peer_review_average", {
    p_period_id: periodId,
    p_reviewee_id: revieweeId,
  });
  if (error) throw new Error(error.message);
  if (data === null || data === undefined) return null;
  return Number(data);
}

export async function submitPeerReviews(params: {
  groupId: string;
  period: PeerReviewPeriod;
  reviewerId: string;
  reviews: PeerReviewInput[];
  honestyConfirmed: boolean;
  targets: PeerReviewTarget[];
  alreadySubmitted?: boolean;
}): Promise<void> {
  const validation = validatePeerReviewSubmission({
    currentUserId: params.reviewerId,
    period: params.period,
    reviews: params.reviews,
    targets: params.targets,
    honestyConfirmed: params.honestyConfirmed,
    alreadySubmitted: params.alreadySubmitted,
  });

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  if (!isSupabaseConfigured) return;

  const rows = params.reviews.map(review => ({
    group_id: params.groupId,
    period_id: params.period.id,
    reviewer_id: params.reviewerId,
    reviewee_id: review.revieweeId,
    completion_score: review.completionScore,
    deadline_score: review.deadlineScore,
    collaboration_score: review.collaborationScore,
    responsiveness_score: review.responsivenessScore,
    overall_score: review.overallScore,
    comment: review.comment.trim() || null,
    honesty_confirmed: params.honestyConfirmed,
    conflict_flag: false,
  }));

  const { error } = await supabase.from("peer_reviews").insert(rows);
  if (error) throw new Error(error.message);
}
