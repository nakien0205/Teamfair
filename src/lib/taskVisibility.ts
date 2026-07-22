export interface TaskAssigneeIdentity {
  assigneeId?: string | null;
  assignedTo?: string | null;
}

export interface ViewerIdentity {
  id?: string | null;
  name?: string | null;
}

export function isTaskVisibleToViewer(
  task: TaskAssigneeIdentity,
  viewer: ViewerIdentity,
): boolean {
  if (task.assigneeId !== null && task.assigneeId !== undefined) {
    return Boolean(viewer.id?.trim()) && task.assigneeId === viewer.id;
  }

  const taskName = task.assignedTo?.trim().toLowerCase() ?? "";
  const viewerName = viewer.name?.trim().toLowerCase() ?? "";

  return taskName.length > 0 && viewerName.length > 0 && taskName === viewerName;
}
