import type { LecturerStudentReview, Task } from "@/context/TeamContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type StudentFeedbackType =
  | "task_review"
  | "contribution"
  | "warning"
  | "general_comment"
  | "lecturer_note"
  | "revision_request";

export type StudentFeedbackRecord = {
  id: string;
  groupId: string;
  recipientId: string;
  senderId?: string | null;
  senderName: string;
  senderRole: "leader" | "lecturer";
  relatedTaskId?: string | null;
  relatedTaskTitle?: string | null;
  feedbackType: StudentFeedbackType;
  content: string;
  suggestedAction?: string | null;
  evidenceLink?: string | null;
  allowsReply: boolean;
  replyText?: string | null;
  read: boolean;
  createdAt: string;
  repliedAt?: string | null;
};

type DbStudentFeedback = {
  id: string;
  group_id: string;
  recipient_id: string;
  sender_id: string | null;
  sender_name: string;
  sender_role: "leader" | "lecturer";
  related_task_id: string | null;
  related_task_title: string | null;
  feedback_type: StudentFeedbackType;
  content: string;
  suggested_action: string | null;
  evidence_link: string | null;
  allows_reply: boolean;
  reply_text: string | null;
  is_read: boolean;
  created_at: string;
  replied_at: string | null;
};

export const feedbackTypeMeta: Record<StudentFeedbackType, { label: string; className: string }> = {
  task_review: { label: "Góp ý task", className: "border-sky-200 bg-sky-50 text-sky-700" },
  contribution: { label: "Góp ý đóng góp", className: "border-indigo-200 bg-indigo-50 text-indigo-700" },
  warning: { label: "Cảnh báo", className: "border-amber-200 bg-amber-50 text-amber-700" },
  general_comment: { label: "Nhận xét chung", className: "border-slate-200 bg-slate-100 text-slate-700" },
  lecturer_note: { label: "Ghi chú của giảng viên", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  revision_request: { label: "Yêu cầu chỉnh sửa", className: "border-orange-200 bg-orange-50 text-orange-700" },
};

const mapRow = (row: DbStudentFeedback): StudentFeedbackRecord => ({
  id: row.id,
  groupId: row.group_id,
  recipientId: row.recipient_id,
  senderId: row.sender_id,
  senderName: row.sender_name,
  senderRole: row.sender_role,
  relatedTaskId: row.related_task_id,
  relatedTaskTitle: row.related_task_title,
  feedbackType: row.feedback_type,
  content: row.content,
  suggestedAction: row.suggested_action,
  evidenceLink: row.evidence_link,
  allowsReply: row.allows_reply,
  replyText: row.reply_text,
  read: row.is_read,
  createdAt: row.created_at,
  repliedAt: row.replied_at,
});

export function buildFallbackFeedback(params: {
  studentId: string;
  studentName: string;
  tasks: Task[];
  lecturerReviews: LecturerStudentReview[];
}): StudentFeedbackRecord[] {
  const reviews = params.lecturerReviews
    .filter(review => review.studentName.trim().toLowerCase() === params.studentName.trim().toLowerCase())
    .map(review => ({
      id: review.id,
      groupId: "demo-group",
      recipientId: params.studentId,
      senderName: "Giảng viên",
      senderRole: "lecturer" as const,
      feedbackType: review.rating <= 2 ? "warning" as const : "lecturer_note" as const,
      content: review.comment.trim() || "Giảng viên đã cập nhật phản hồi cho contribution của bạn.",
      suggestedAction: review.rating <= 2 ? "Rà soát lại minh chứng, task và work log trước mốc đánh giá tiếp theo." : null,
      allowsReply: review.rating <= 3,
      read: false,
      createdAt: review.timestamp.toISOString(),
    }));

  const rejectedTasks = params.tasks
    .filter(task => (task.description || "").toLowerCase().includes("[rejected]"))
    .map(task => ({
      id: `rejected-${task.id}`,
      groupId: "demo-group",
      recipientId: params.studentId,
      senderName: "Nhóm trưởng",
      senderRole: "leader" as const,
      relatedTaskId: task.id,
      relatedTaskTitle: task.name,
      feedbackType: "revision_request" as const,
      content: `Task "${task.name}" cần chỉnh sửa hoặc nộp lại minh chứng trước khi được duyệt.`,
      suggestedAction: "Mở task chi tiết, xem lại feedback và cập nhật submission mới.",
      allowsReply: true,
      read: false,
      createdAt: new Date().toISOString(),
    }));

  return [...rejectedTasks, ...reviews].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

export async function listStudentFeedback(studentId: string, fallback?: StudentFeedbackRecord[]): Promise<StudentFeedbackRecord[]> {
  if (!isSupabaseConfigured) return fallback || [];

  const { data, error } = await supabase
    .from("student_feedback")
    .select("id, group_id, recipient_id, sender_id, sender_name, sender_role, related_task_id, related_task_title, feedback_type, content, suggested_action, evidence_link, allows_reply, reply_text, is_read, created_at, replied_at")
    .eq("recipient_id", studentId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(row => mapRow(row as DbStudentFeedback));
}

export async function getStudentFeedbackDetail(feedbackId: string): Promise<StudentFeedbackRecord | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("student_feedback")
    .select("id, group_id, recipient_id, sender_id, sender_name, sender_role, related_task_id, related_task_title, feedback_type, content, suggested_action, evidence_link, allows_reply, reply_text, is_read, created_at, replied_at")
    .eq("id", feedbackId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRow(data as DbStudentFeedback) : null;
}

export async function markStudentFeedbackRead(feedbackId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase.from("student_feedback").update({ is_read: true }).eq("id", feedbackId);
  if (error) throw new Error(error.message);
}

export async function replyStudentFeedback(feedbackId: string, replyText: string): Promise<void> {
  if (replyText.trim().length < 10) {
    throw new Error("Vui lòng nhập nội dung phản hồi rõ ràng hơn.");
  }

  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from("student_feedback")
    .update({
      reply_text: replyText.trim(),
      replied_at: new Date().toISOString(),
      is_read: true,
    })
    .eq("id", feedbackId);

  if (error) throw new Error(error.message);
}
