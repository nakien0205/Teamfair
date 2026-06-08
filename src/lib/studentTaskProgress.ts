import type { Task } from "@/context/TeamContext";

export const STUDENT_TASK_PROGRESS_MESSAGES = {
  unauthorized: "Bạn không có quyền cập nhật task này.",
  approvedLocked: "Task đã được duyệt nên không thể cập nhật.",
  invalidTransition: "Không thể chuyển trạng thái không hợp lệ.",
  startConfirm: "Bạn có chắc muốn bắt đầu task này không?",
  startSuccess: "Task đã được chuyển sang trạng thái Đang thực hiện.",
} as const;

const normalizedDescription = (task: Task) => (task.description || "").toLowerCase();

export const isTaskAssignedToStudent = (task: Task, userId?: string | null, currentUserName?: string | null) => {
  if (userId && task.assigneeId === userId) return true;
  const normalizedName = currentUserName?.trim().toLowerCase();
  return Boolean(normalizedName && task.assignedTo.trim().toLowerCase() === normalizedName);
};

export const isTaskNeedRevision = (task: Task) => normalizedDescription(task).includes("[need_revision]");

export const isTaskRejected = (task: Task) => normalizedDescription(task).includes("[rejected]");

export const canStudentStartTask = (task: Task, isAssignee: boolean) => {
  if (!isAssignee) {
    return { ok: false as const, message: STUDENT_TASK_PROGRESS_MESSAGES.unauthorized };
  }

  if (task.approved) {
    return { ok: false as const, message: STUDENT_TASK_PROGRESS_MESSAGES.approvedLocked };
  }

  if (task.status !== "Todo") {
    return { ok: false as const, message: STUDENT_TASK_PROGRESS_MESSAGES.invalidTransition };
  }

  return { ok: true as const };
};

export const canStudentOpenSubmission = (task: Task, isAssignee: boolean) => {
  if (!isAssignee) {
    return { ok: false as const, message: STUDENT_TASK_PROGRESS_MESSAGES.unauthorized };
  }

  if (task.approved) {
    return { ok: false as const, message: STUDENT_TASK_PROGRESS_MESSAGES.approvedLocked };
  }

  if (task.status === "Todo" || task.status === "In Progress" || isTaskNeedRevision(task) || isTaskRejected(task)) {
    return { ok: true as const };
  }

  return { ok: false as const, message: STUDENT_TASK_PROGRESS_MESSAGES.invalidTransition };
};

export const canStudentEditSubmission = (task: Task, isAssignee: boolean) => {
  if (!isAssignee) {
    return { ok: false as const, message: STUDENT_TASK_PROGRESS_MESSAGES.unauthorized };
  }

  if (task.approved) {
    return { ok: false as const, message: STUDENT_TASK_PROGRESS_MESSAGES.approvedLocked };
  }

  if (task.status === "Done" || task.status === "In Progress" || task.status === "Todo" || isTaskNeedRevision(task) || isTaskRejected(task)) {
    return { ok: true as const };
  }

  return { ok: false as const, message: STUDENT_TASK_PROGRESS_MESSAGES.invalidTransition };
};

export const isLateSubmission = (task: Task) => {
  if (!task.deadline) return false;
  const deadlineDate = new Date(task.deadline);
  deadlineDate.setHours(23, 59, 59, 999);
  const deadline = deadlineDate.getTime();
  if (!Number.isFinite(deadline)) return false;
  return Date.now() > deadline;
};
