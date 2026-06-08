import type { Group } from "@/context/TeamContext";

export type RubricProjectRole = "student" | "lecturer" | "admin" | null | undefined;

export function getAccessibleRubricProjects(
  groups: Group[],
  currentUserId: string | null | undefined,
  currentUserRole: RubricProjectRole,
) {
  if (currentUserRole === "admin") {
    return groups;
  }

  if (currentUserRole !== "lecturer" || !currentUserId) {
    return [];
  }

  return groups.filter((group) => group.lecturer_id === currentUserId);
}

export function canAccessRubricProject(
  projectId: string | null | undefined,
  groups: Group[],
  currentUserId: string | null | undefined,
  currentUserRole: RubricProjectRole,
) {
  if (!projectId) return false;

  return getAccessibleRubricProjects(groups, currentUserId, currentUserRole).some((group) => group.id === projectId);
}
