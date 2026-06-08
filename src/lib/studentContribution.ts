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
  const peerRatio = peerReviewAverage === null ? 0.6 : peerReviewAverage / 5;
  const leaderRatio = averageQualityRating === null ? 0.6 : averageQualityRating / 5;
  const workLogRatio = assignedTasks === 0 ? 0 : Math.min(1, workLogCount / Math.max(assignedTasks, 2));

  const breakdown: ContributionBreakdownItem[] = [
    {
      key: "task_completion",
      label: "Task Completion Score",
      score: clamp(completionRatio * 100),
      weight: 30,
      weightedScore: Math.round(completionRatio * 30),
      explanation: "Tỷ lệ task đã được duyệt trên tổng số task được giao.",
    },
    {
      key: "deadline",
      label: "Deadline Score",
      score: clamp(deadlineRatio * 100),
      weight: 20,
      weightedScore: Math.round(deadlineRatio * 20),
      explanation: "Mức độ giữ deadline và hạn chế nộp trễ.",
    },
    {
      key: "task_quality",
      label: "Task Quality Score",
      score: clamp(qualityRatio * 100),
      weight: 20,
      weightedScore: Math.round(qualityRatio * 20),
      explanation: "Chất lượng đầu ra dựa trên task được duyệt và đánh giá hiện có.",
    },
    {
      key: "peer_review",
      label: "Peer Review Score",
      score: clamp(peerRatio * 100),
      weight: 10,
      weightedScore: Math.round(peerRatio * 10),
      explanation: "Điểm trung bình từ đánh giá chéo, chỉ là dữ liệu tham khảo.",
    },
    {
      key: "leader_evaluation",
      label: "Leader Evaluation Score",
      score: clamp(leaderRatio * 100),
      weight: 10,
      weightedScore: Math.round(leaderRatio * 10),
      explanation: "Mức đánh giá tổng quát từ trưởng nhóm hoặc giảng viên nếu có.",
    },
    {
      key: "work_log",
      label: "Work Log / Supporting Evidence Score",
      score: clamp(workLogRatio * 100),
      weight: 10,
      weightedScore: Math.round(workLogRatio * 10),
      explanation: "Mức độ bổ sung work log và bằng chứng hỗ trợ cho contribution.",
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
