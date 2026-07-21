import type { LecturerStudentReview, Task } from "@/context/TeamContext";
import { calculateStudentContribution } from "@/lib/studentContribution";
import {
  buildFallbackFeedback,
  getStudentFeedbackDetail,
  listStudentFeedback,
  markStudentFeedbackRead,
  replyStudentFeedback,
  type StudentFeedbackRecord,
} from "@/lib/studentFeedback";
import {
  getPeerReviewStatus,
  listPeerReviewPeriodTargets,
  getReceivedPeerReviewAverage,
  listActivePeerReviewPeriods,
  submitPeerReviews,
  type PeerReviewInput,
  type PeerReviewPeriod,
  type PeerReviewStatus,
  type PeerReviewTarget,
} from "@/lib/studentPeerReview";
import {
  createStudentAppeal,
  getStudentAppeal,
  listStudentAppeals,
  submitStudentAppeal,
  updateStudentAppeal,
  type StudentAppealRecord,
} from "@/lib/studentAppeals";
import { type WorkLogRecord } from "@/lib/workLogs";

export async function getStudentContributionData(params: {
  tasks: Task[];
  workLogs: WorkLogRecord[];
  leaderReviews: LecturerStudentReview[];
  activePeriodId?: string | null;
  studentId: string;
}) {
  const peerReviewAverage = await getReceivedPeerReviewAverage(params.activePeriodId || null, params.studentId);
  return calculateStudentContribution({
    tasks: params.tasks,
    workLogs: params.workLogs,
    leaderReviews: params.leaderReviews,
    peerReviewAverage,
  });
}

export async function getStudentPeerReviewActive(groupId: string): Promise<PeerReviewPeriod[]> {
  return listActivePeerReviewPeriods(groupId);
}

export async function getStudentPeerReviewStatus(periodId: string, reviewerId: string): Promise<PeerReviewStatus> {
  return getPeerReviewStatus(periodId, reviewerId);
}

export async function getStudentPeerReviewTargets(periodId: string, reviewerId?: string | null): Promise<PeerReviewTarget[]> {
  return listPeerReviewPeriodTargets(periodId, reviewerId);
}

export async function submitStudentPeerReview(params: {
  groupId: string;
  period: PeerReviewPeriod;
  reviewerId: string;
  reviews: PeerReviewInput[];
  honestyConfirmed: boolean;
  targets: PeerReviewTarget[];
  alreadySubmitted?: boolean;
}) {
  return submitPeerReviews(params);
}

export async function getStudentFeedbackList(params: {
  studentId: string;
  studentName: string;
  tasks: Task[];
  lecturerReviews: LecturerStudentReview[];
}): Promise<StudentFeedbackRecord[]> {
  const fallback = buildFallbackFeedback({
    studentId: params.studentId,
    studentName: params.studentName,
    tasks: params.tasks,
    lecturerReviews: params.lecturerReviews,
  });
  return listStudentFeedback(params.studentId, fallback);
}

export async function getStudentFeedbackItem(id: string) {
  return getStudentFeedbackDetail(id);
}

export async function readStudentFeedback(id: string) {
  return markStudentFeedbackRead(id);
}

export async function answerStudentFeedback(id: string, replyText: string) {
  return replyStudentFeedback(id, replyText);
}

export async function getStudentAppealList(studentId: string): Promise<StudentAppealRecord[]> {
  return listStudentAppeals(studentId);
}

export async function getStudentAppealItem(id: string) {
  return getStudentAppeal(id);
}

export async function createDraftStudentAppeal(record: Omit<StudentAppealRecord, "id" | "createdAt" | "updatedAt" | "submittedAt">) {
  return createStudentAppeal(record);
}

export async function updateDraftStudentAppeal(
  id: string,
  updates: Parameters<typeof updateStudentAppeal>[1],
) {
  return updateStudentAppeal(id, updates);
}

export async function submitDraftStudentAppeal(id: string) {
  return submitStudentAppeal(id);
}
