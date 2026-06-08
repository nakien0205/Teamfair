import type { Task } from "@/context/TeamContext";

export type StudentTaskWorkflowStatus =
  | "todo"
  | "in_progress"
  | "submitted"
  | "need_revision"
  | "approved"
  | "rejected"
  | "overdue";

export type StudentReviewStatus = "pending" | "need_revision" | "approved" | "rejected";

export const studentTaskStatusMeta: Record<
  StudentTaskWorkflowStatus,
  { label: string; className: string; order: number }
> = {
  todo: { label: "Chưa bắt đầu", className: "border-slate-200 bg-slate-100 text-slate-700", order: 1 },
  in_progress: { label: "Đang thực hiện", className: "border-sky-200 bg-sky-50 text-sky-700", order: 2 },
  submitted: { label: "Đã nộp", className: "border-amber-200 bg-amber-50 text-amber-700", order: 3 },
  need_revision: { label: "Cần chỉnh sửa", className: "border-orange-200 bg-orange-50 text-orange-700", order: 4 },
  approved: { label: "Đã duyệt", className: "border-emerald-200 bg-emerald-50 text-emerald-700", order: 5 },
  rejected: { label: "Bị từ chối", className: "border-rose-200 bg-rose-50 text-rose-700", order: 6 },
  overdue: { label: "Trễ hạn", className: "border-red-200 bg-red-50 text-red-700", order: 7 },
};

export const studentReviewMeta: Record<StudentReviewStatus, { label: string; className: string }> = {
  pending: { label: "Đang chờ review", className: "text-amber-700" },
  need_revision: { label: "Cần chỉnh sửa", className: "text-orange-700" },
  approved: { label: "Đã duyệt", className: "text-emerald-700" },
  rejected: { label: "Bị từ chối", className: "text-rose-700" },
};

export function isTaskOverdue(task: Task, now = new Date()): boolean {
  if (!task.deadline || task.approved) return false;
  const deadline = new Date(task.deadline);
  if (Number.isNaN(deadline.getTime())) return false;
  const current = new Date(now);
  current.setHours(0, 0, 0, 0);
  return deadline.getTime() < current.getTime();
}

export function getTaskWorkflowStatus(task: Task, now = new Date()): StudentTaskWorkflowStatus {
  const normalizedDescription = task.description?.toLowerCase() || "";
  if (normalizedDescription.includes("[rejected]")) return "rejected";
  if (normalizedDescription.includes("[need_revision]")) return "need_revision";
  if (task.approved) return "approved";
  if (isTaskOverdue(task, now)) return "overdue";
  if (task.status === "Done") return "submitted";
  if (task.status === "In Progress") return "in_progress";
  return "todo";
}

export function getTaskReviewStatus(task: Task, now = new Date()): StudentReviewStatus {
  const workflowStatus = getTaskWorkflowStatus(task, now);
  if (workflowStatus === "approved") return "approved";
  if (workflowStatus === "rejected") return "rejected";
  if (workflowStatus === "need_revision") return "need_revision";
  return "pending";
}

export function getDifficultyMeta(priority?: Task["priority"]) {
  if (priority === "High") {
    return { label: "Khó", className: "border-rose-200 bg-rose-50 text-rose-700" };
  }
  if (priority === "Medium") {
    return { label: "Trung bình", className: "border-orange-200 bg-orange-50 text-orange-700" };
  }
  if (priority === "Low") {
    return { label: "Dễ", className: "border-emerald-200 bg-emerald-50 text-emerald-700" };
  }
  return { label: "Chưa phân loại", className: "border-slate-200 bg-slate-100 text-slate-700" };
}
