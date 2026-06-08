import type { AppUserRole } from "@/context/AuthContext";

export function dashboardPathForRole(role?: AppUserRole | null): string {
  if (role === "lecturer" || role === "admin") {
    return "/dashboard-lecturer";
  }
  return "/student/dashboard";
}
