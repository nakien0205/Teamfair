import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";
import type { Task, LecturerStudentReview } from "@/context/TeamContext";
import type { WorkLogRecord } from "@/lib/workLogs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContributionAiAnalysis = {
  effort_summary: string;
  anomalies: string[];
  timeline_assessment: "regular" | "front_loaded" | "back_loaded" | "sporadic";
  recommendations: string[];
  confidence_tag: "well_supported" | "partially_supported" | "insufficient_evidence";
  reasoning: string;
};

type AnalysisPayload = {
  student_name: string;
  group_name: string;
  deterministic_score: number;
  tasks: {
    name: string;
    status: string;
    deadline: string;
    description: string;
    evidence_count: number;
    approved: boolean;
  }[];
  work_logs: {
    date: string;
    hours: number;
    description: string;
  }[];
  leader_reviews: {
    rating: number;
    comment: string;
  }[];
  peer_review_average: number | null;
};

export type GetOrFetchParams = {
  studentId: string;
  studentName: string;
  groupId: string;
  groupName: string;
  deterministic_score: number;
  tasks: Task[];
  workLogs: WorkLogRecord[];
  leaderReviews: LecturerStudentReview[];
  peerReviewAverage: number | null;
  forceRefresh?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function agentBaseUrl(): string {
  const base = import.meta.env.VITE_STUDENT_AGENT_URL?.trim();
  if (base) return base.replace(/\/$/, "");
  return "/api/student-agent";
}

/**
 * Compute a simple hash of the key contribution data to detect staleness.
 * Uses a djb2-style hash of sorted JSON for speed (no crypto needed).
 */
export function computeDataHash(
  tasks: Task[],
  workLogs: WorkLogRecord[],
  reviews: LecturerStudentReview[],
): string {
  const taskKeys = tasks
    .map(t => ({
      id: t.id,
      status: t.status,
      approved: t.approved,
      evidence: t.evidence?.length ?? 0,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const logKeys = workLogs
    .map(l => ({ id: l.id, date: l.workDate, hours: l.timeSpentHours }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const reviewKeys = reviews
    .map(r => ({ id: r.id, rating: r.rating }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const payload = JSON.stringify({ t: taskKeys, l: logKeys, r: reviewKeys });

  // djb2 hash
  let hash = 5381;
  for (let i = 0; i < payload.length; i++) {
    hash = ((hash << 5) + hash + payload.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

// ---------------------------------------------------------------------------
// Python server call
// ---------------------------------------------------------------------------

export async function fetchContributionAnalysis(
  payload: AnalysisPayload,
): Promise<ContributionAiAnalysis | null> {
  try {
    const response = await fetch(`${agentBaseUrl()}/analyze-contribution`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.warn("[contributionAi] fetch failed:", response.status, await response.text().catch(() => ""));
      return null;
    }

    const data = (await response.json()) as ContributionAiAnalysis;
    return data;
  } catch (err) {
    console.warn("[contributionAi] fetch error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Supabase cache
// ---------------------------------------------------------------------------

type CachedRow = {
  id: string;
  student_id: string;
  group_id: string;
  analysis_json: ContributionAiAnalysis;
  data_hash: string;
  created_at: string;
  updated_at: string;
};

export async function getCachedAnalysis(
  studentId: string,
  groupId: string,
): Promise<{ analysis: ContributionAiAnalysis; dataHash: string } | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const { data, error } = await supabase
      .from("contribution_ai_analysis")
      .select("analysis_json, data_hash")
      .eq("student_id", studentId)
      .eq("group_id", groupId)
      .single();

    if (error || !data) return null;

    const row = data as Pick<CachedRow, "analysis_json" | "data_hash">;
    return { analysis: row.analysis_json, dataHash: row.data_hash };
  } catch {
    return null;
  }
}

export async function saveCachedAnalysis(
  studentId: string,
  groupId: string,
  analysis: ContributionAiAnalysis,
  dataHash: string,
): Promise<void> {
  if (!isSupabaseConfigured) return;

  try {
    await supabase
      .from("contribution_ai_analysis")
      .upsert(
        {
          student_id: studentId,
          group_id: groupId,
          analysis_json: analysis,
          data_hash: dataHash,
        },
        { onConflict: "student_id,group_id" },
      );
  } catch (err) {
    console.warn("[contributionAi] save cache error:", err);
  }
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

export async function getOrFetchAnalysis(
  params: GetOrFetchParams,
): Promise<ContributionAiAnalysis | null> {
  const {
    studentId,
    studentName,
    groupId,
    groupName,
    deterministic_score,
    tasks,
    workLogs,
    leaderReviews,
    peerReviewAverage,
    forceRefresh = false,
  } = params;

  const currentHash = computeDataHash(tasks, workLogs, leaderReviews);

  // Check cache (unless forcing refresh)
  if (!forceRefresh) {
    const cached = await getCachedAnalysis(studentId, groupId);
    if (cached && cached.dataHash === currentHash) {
      return cached.analysis;
    }
  }

  // Build payload for the Python server
  const payload: AnalysisPayload = {
    student_name: studentName,
    group_name: groupName,
    deterministic_score,
    tasks: tasks.map(t => ({
      name: t.name,
      status: t.status,
      deadline: t.deadline,
      description: t.description || "",
      evidence_count: t.evidence?.length ?? 0,
      approved: t.approved,
    })),
    work_logs: workLogs.map(l => ({
      date: l.workDate,
      hours: l.timeSpentHours,
      description: l.description,
    })),
    leader_reviews: leaderReviews.map(r => ({
      rating: r.rating,
      comment: r.comment,
    })),
    peer_review_average: peerReviewAverage,
  };

  const analysis = await fetchContributionAnalysis(payload);
  if (!analysis) return null;

  // Save to cache (fire-and-forget)
  void saveCachedAnalysis(studentId, groupId, analysis, currentHash);

  return analysis;
}
