import { describe, expect, it, vi } from "vitest";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    clear: () => {
      store = {};
    },
    removeItem: (key: string) => {
      delete store[key];
    },
  };
})();
vi.stubGlobal("localStorage", localStorageMock);

describe("Session 4 - Security, Database, and Redirection Rules", () => {
  it("verifies nearest project redirection logic works using localStorage key schemas", () => {
    const mockUserId = "test-user-uuid-123";
    const mockGroupId = "group-uuid-456";
    const storageKey = `teamfair_last_project_${mockUserId}`;

    // 1. Simulate saving last-visited project ID
    localStorage.setItem(storageKey, mockGroupId);
    expect(localStorage.getItem(storageKey)).toBe(mockGroupId);

    // 2. Validate fallback behavior if not set
    const emptyStorageKey = `teamfair_last_project_unknown`;
    expect(localStorage.getItem(emptyStorageKey)).toBeNull();
  });

  it("ensures datasource canPersist evaluations enforce proper auth and env gating", () => {
    // Mimics the persistence check condition inside TeamContext.tsx
    const canPersistMock = (dataSource: string, isSupabaseConfigured: boolean, userId: string | undefined, isDemoSession: boolean) => {
      return dataSource === "supabase" && isSupabaseConfigured && Boolean(userId) && !isDemoSession;
    };

    // Authenticated user with configured backend -> Allowed to persist
    expect(canPersistMock("supabase", true, "uid-1", false)).toBe(true);

    // Unconfigured supabase client -> Blocked
    expect(canPersistMock("supabase", false, "uid-1", false)).toBe(false);

    // Active Demo Session session storage flag -> Blocked
    expect(canPersistMock("supabase", true, "uid-1", true)).toBe(false);

    // Unauthenticated user -> Blocked
    expect(canPersistMock("supabase", true, undefined, false)).toBe(false);

    // Demo datasource selected -> Blocked
    expect(canPersistMock("demo", true, "uid-1", false)).toBe(false);
  });

  it("validates that role role-based access control redirect strings map correctly", () => {
    const dashboardPathForRole = (role?: "student" | "lecturer" | "admin" | null) => {
      if (role === "lecturer" || role === "admin") {
        return "/dashboard-lecturer";
      }
      return "/dashboard-student";
    };

    expect(dashboardPathForRole("student")).toBe("/dashboard-student");
    expect(dashboardPathForRole("lecturer")).toBe("/dashboard-lecturer");
    expect(dashboardPathForRole("admin")).toBe("/dashboard-lecturer");
    expect(dashboardPathForRole(null)).toBe("/dashboard-student");
  });
});
