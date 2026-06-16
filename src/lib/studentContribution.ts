import type { LecturerStudentReview, Task } from "@/context/TeamContext";
import type { WorkLogRecord } from "@/lib/workLogs";
import { getTaskWorkflowStatus, isTaskOverdue } from "@/lib/studentWorkflow";

export type ContributionRiskLevel = "normal" | "attention" | "high";

export type ContributionBreakdownItem = {
  key:
    | "task_completion"
    | "deadline"
    | "task_quality"
    | "peer_review"
    | "leader_evaluation"
    | "work_log";
  label: string;
  score: number;
  weight: number;
  weightedScore: number;
  explanation: string;
  hasData: boolean;
};

export type ContributionEvidenceSummary = {
  assignedTasks: number;
  approvedTasks: number;
  pendingTasks: number;
  rejectedTasks: number;
  lateTasks: number;
  averageQualityRating: number | null;
  workLogCount: number;
  peerReviewAverage: number | null;
  leaderFeedbackSummary: string;
};

export type ContributionResult = {
  referenceScore: number;
  riskLevel: ContributionRiskLevel;
  riskReasons: string[];
  breakdown: ContributionBreakdownItem[];
  evidenceSummary: ContributionEvidenceSummary;
  explanation: string;
  lastUpdatedAt: string | null;
  hasEnoughData: boolean;
  canAppeal: boolean;
};

type Input = {
  tasks: Task[];
  workLogs: WorkLogRecord[];
  peerReviewAverage?: number | null;
  leaderReviews?: LecturerStudentReview[];
  now?: Date;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
const round1 = (value: number) => Math.round(value * 10) / 10;

function average(values: number[]): number | null {
  if (!values.length) return null;
  return round1(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildExplanation(summary: ContributionEvidenceSummary, riskLevel: ContributionRiskLevel): string {
  if (summary.assignedTasks === 0) {
    return "Hiện chưa có đủ task được giao để hệ thống ước lượng điểm đóng góp tham khảo.";
  }

  const approvedPart = `Bạn đã hoàn thành ${summary.approvedTasks}/${summary.assignedTasks} task được giao.`;
  const deadlinePart =
    summary.lateTasks > 0
      ? `Có ${summary.lateTasks} task nộp trễ hoặc quá hạn cần lưu ý.`
      : "Các task hiện chưa ghi nhận tình trạng trễ hạn đáng kể.";
  const workLogPart =
    summary.workLogCount > 0
      ? `Bạn đã ghi ${summary.workLogCount} work log để bổ sung quá trình làm việc.`
      : "Bạn chưa có nhiều work log hỗ trợ giải thích quá trình làm việc.";

  if (riskLevel === "high") {
    return `${approvedPart} ${deadlinePart} ${workLogPart} Contribution hiện tại đang ở mức cần giảng viên xem xét thêm.`;
  }

  if (riskLevel === "attention") {
    return `${approvedPart} ${deadlinePart} ${workLogPart} Contribution hiện tại nhìn chung ổn nhưng vẫn còn vài điểm cần cải thiện.`;
  }

  return `${approvedPart} ${deadlinePart} ${workLogPart} Contribution hiện tại được đánh giá là ổn định ở mức tham khảo.`;
}

export function calculateStudentContribution(input: Input): ContributionResult {
  const now = input.now || new Date();
  const assignedTasks = input.tasks.length;
  const approvedTasks = input.tasks.filter(task => task.approved).length;
  const pendingTasks = input.tasks.filter(task => {
    const status = getTaskWorkflowStatus(task, now);
    return status === "submitted" || status === "in_progress" || status === "todo" || status === "need_revision";
  }).length;
  const rejectedTasks = input.tasks.filter(task => getTaskWorkflowStatus(task, now) === "rejected").length;
  const lateTasks = input.tasks.filter(task => isTaskOverdue(task, now)).length;
  const workLogCount = input.workLogs.length;
  const leaderRatings = (input.leaderReviews || []).map(review => review.rating);
  const averageQualityRating = average(leaderRatings);
  const peerReviewAverage = input.peerReviewAverage ?? null;
  const lastUpdatedCandidates = [
    ...input.workLogs.map(log => log.updatedAt || log.createdAt),
    ...(input.leaderReviews || []).map(review => review.timestamp.toISOString()),
    ...input.tasks.flatMap(task => task.evidence?.map(item => item.uploadTime.toISOString()) || []),
  ]
    .map(value => new Date(value))
    .filter(value => !Number.isNaN(value.getTime()))
    .sort((left, right) => right.getTime() - left.getTime());

  const completionRatio = assignedTasks === 0 ? 0 : approvedTasks / assignedTasks;
  const deadlineRatio = assignedTasks === 0 ? 0 : Math.max(0, 1 - lateTasks / assignedTasks);
  const qualityRatio = averageQualityRating === null ? completionRatio : averageQualityRating / 5;
  const workLogRatio = assignedTasks === 0 ? 0 : Math.min(1, workLogCount / Math.max(assignedTasks, 2));

  // Determine which optional components have real data
  const hasPeerData = peerReviewAverage !== null;
  const hasLeaderData = averageQualityRating !== null;

  // Base weights for all components
  const baseWeights = {
    task_completion: 30,
    deadline: 20,
    task_quality: 20,
    peer_review: 10,
    leader_evaluation: 10,
    work_log: 10,
  };

  // Redistribute weight from components that have no data
  // proportionally to components that DO have data
  let redistributable = 0;
  if (!hasPeerData) redistributable += baseWeights.peer_review;
  if (!hasLeaderData) redistributable += baseWeights.leader_evaluation;

  // Components that always have data (task-based + work log)
  const alwaysPresent = ["task_completion", "deadline", "task_quality", "work_log"] as const;
  const alwaysPresentTotal = alwaysPresent.reduce((s, k) => s + baseWeights[k], 0);

  const effectiveWeights = { ...baseWeights };
  if (redistributable > 0) {
    // Redistribute proportionally to components that have data
    for (const k of alwaysPresent) {
      effectiveWeights[k] += Math.round((baseWeights[k] / alwaysPresentTotal) * redistributable);
    }
    if (!hasPeerData) effectiveWeights.peer_review = 0;
    if (!hasLeaderData) effectiveWeights.leader_evaluation = 0;

    // Fix any rounding mismatch so total = 100
    const totalCheck = Object.values(effectiveWeights).reduce((a, b) => a + b, 0);
    if (totalCheck !== 100) {
      effectiveWeights.task_completion += 100 - totalCheck;
    }
  }

  // Compute ratios for optional components (only used if they have data)
  const peerRatio = hasPeerData ? peerReviewAverage / 5 : 0;
  const leaderRatio = hasLeaderData ? averageQualityRating / 5 : 0;

  const breakdown: ContributionBreakdownItem[] = [
    {
      key: "task_completion",
      label: "Task Completion Score",
      score: clamp(completionRatio * 100),
      weight: effectiveWeights.task_completion,
      weightedScore: Math.round(completionRatio * effectiveWeights.task_completion),
      explanation: "Tỷ lệ task đã được duyệt trên tổng số task được giao.",
      hasData: assignedTasks > 0,
    },
    {
      key: "deadline",
      label: "Deadline Score",
      score: clamp(deadlineRatio * 100),
      weight: effectiveWeights.deadline,
      weightedScore: Math.round(deadlineRatio * effectiveWeights.deadline),
      explanation: "Mức độ giữ deadline và hạn chế nộp trễ.",
      hasData: assignedTasks > 0,
    },
    {
      key: "task_quality",
      label: "Task Quality Score",
      score: clamp(qualityRatio * 100),
      weight: effectiveWeights.task_quality,
      weightedScore: Math.round(qualityRatio * effectiveWeights.task_quality),
      explanation: "Chất lượng đầu ra dựa trên task được duyệt và đánh giá hiện có.",
      hasData: assignedTasks > 0,
    },
    {
      key: "peer_review",
      label: "Peer Review Score",
      score: hasPeerData ? clamp(peerRatio * 100) : 0,
      weight: effectiveWeights.peer_review,
      weightedScore: hasPeerData ? Math.round(peerRatio * effectiveWeights.peer_review) : 0,
      explanation: hasPeerData
        ? "Điểm trung bình từ đánh giá chéo, chỉ là dữ liệu tham khảo."
        : "Chưa có dữ liệu đánh giá chéo — trọng số được phân bổ lại cho các thành phần khác.",
      hasData: hasPeerData,
    },
    {
      key: "leader_evaluation",
      label: "Leader Evaluation Score",
      score: hasLeaderData ? clamp(leaderRatio * 100) : 0,
      weight: effectiveWeights.leader_evaluation,
      weightedScore: hasLeaderData ? Math.round(leaderRatio * effectiveWeights.leader_evaluation) : 0,
      explanation: hasLeaderData
        ? "Mức đánh giá tổng quát từ trưởng nhóm hoặc giảng viên nếu có."
        : "Chưa có đánh giá từ trưởng nhóm — trọng số được phân bổ lại cho các thành phần khác.",
      hasData: hasLeaderData,
    },
    {
      key: "work_log",
      label: "Work Log / Supporting Evidence Score",
      score: clamp(workLogRatio * 100),
      weight: effectiveWeights.work_log,
      weightedScore: Math.round(workLogRatio * effectiveWeights.work_log),
      explanation: "Mức độ bổ sung work log và bằng chứng hỗ trợ cho contribution.",
      hasData: workLogCount > 0,
    },
  ];

  const referenceScore = clamp(breakdown.reduce((sum, item) => sum + item.weightedScore, 0));
  const riskReasons: string[] = [];

  if (lateTasks > 0) riskReasons.push("Có task trễ hạn.");
  if (rejectedTasks > 0) riskReasons.push("Có task bị từ chối hoặc cần làm lại.");
  if (input.tasks.some(task => (task.evidence?.length || 0) === 0)) riskReasons.push("Thiếu minh chứng ở một số task.");
  if (peerReviewAverage !== null && peerReviewAverage < 3) riskReasons.push("Điểm đánh giá chéo đang ở mức thấp.");
  if (averageQualityRating !== null && averageQualityRating < 3) riskReasons.push("Đánh giá từ người phụ trách còn thấp.");
  if (workLogCount === 0 && assignedTasks > 0) riskReasons.push("Chưa có work log hỗ trợ.");

  let riskLevel: ContributionRiskLevel = "normal";
  if (referenceScore < 45 || lateTasks >= 2 || rejectedTasks >= 1) {
    riskLevel = "high";
  } else if (referenceScore < 70 || lateTasks > 0 || riskReasons.length > 0) {
    riskLevel = "attention";
  }

  const evidenceSummary: ContributionEvidenceSummary = {
    assignedTasks,
    approvedTasks,
    pendingTasks,
    rejectedTasks,
    lateTasks,
    averageQualityRating,
    workLogCount,
    peerReviewAverage,
    leaderFeedbackSummary:
      input.leaderReviews && input.leaderReviews.length
        ? input.leaderReviews
            .slice(0, 2)
            .map(review => review.comment.trim())
            .filter(Boolean)
            .join(" ")
        : "Chưa có nhận xét tổng hợp mới từ trưởng nhóm hoặc giảng viên.",
  };

  return {
    referenceScore,
    riskLevel,
    riskReasons,
    breakdown,
    evidenceSummary,
    explanation: buildExplanation(evidenceSummary, riskLevel),
    lastUpdatedAt: lastUpdatedCandidates[0]?.toISOString() || null,
    hasEnoughData: assignedTasks > 0,
    canAppeal: riskLevel !== "normal" || referenceScore < 70 || rejectedTasks > 0,
  };
}
