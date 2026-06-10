import type { AppUserRole } from "@/context/AuthContext";
import type { Group } from "@/context/TeamContext";

export type ProjectAccessEntry = {
  group: Group;
  index: number;
};

export function isProjectMember(group: Pick<Group, "members">, userId?: string | null): boolean {
  if (!userId) return false;
  return group.members?.some((member) => member.id === userId) ?? false;
}

export function canAccessProjectGroup(
  group: Pick<Group, "lecturer_id" | "members">,
  userId?: string | null,
  role?: AppUserRole | null,
  isDemo = false,
): boolean {
  if (isDemo) return true;
  if (!userId) return false;
  if (role === "admin") return true;
  if (role === "lecturer") {
    return group.lecturer_id === userId || isProjectMember(group, userId);
  }
  return isProjectMember(group, userId);
}

export function getAccessibleProjectGroups(
  groups: Group[],
  userId?: string | null,
  role?: AppUserRole | null,
  isDemo = false,
): Group[] {
  return groups.filter((group) => canAccessProjectGroup(group, userId, role, isDemo));
}

export function getAccessibleProjectEntries(
  groups: Group[],
  userId?: string | null,
  role?: AppUserRole | null,
  isDemo = false,
): ProjectAccessEntry[] {
  return groups.flatMap((group, index) =>
    canAccessProjectGroup(group, userId, role, isDemo) ? [{ group, index }] : [],
  );
}
