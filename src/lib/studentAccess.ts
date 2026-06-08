export function canStudentAccessPrivateContribution(targetStudentId: string, currentUserId?: string | null) {
  return Boolean(currentUserId && targetStudentId === currentUserId);
}

export function canStudentCreateAppealFor(targetStudentId: string, currentUserId?: string | null) {
  return Boolean(currentUserId && targetStudentId === currentUserId);
}

export function canStudentCreateWorkLogFor(targetStudentId: string, currentUserId?: string | null) {
  return Boolean(currentUserId && targetStudentId === currentUserId);
}

export function canStudentLinkWorkLogTask(taskId: string | null | undefined, allowedTaskIds: string[]) {
  if (!taskId) return true;
  return allowedTaskIds.includes(taskId);
}
