import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Google Calendar Task Sync Migration File Structure & Security Contract", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20260722300000_google_calendar_task_sync.sql"
  );

  it("migration file exists", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
  });

  const sqlContent = fs.readFileSync(migrationPath, "utf-8");

  it("defines private desired-state outbox and event mapping tables", () => {
    expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS private.google_calendar_task_sync_desired");
    expect(sqlContent).toContain("CREATE TABLE IF NOT EXISTS private.google_calendar_task_event_mappings");
  });

  it("enforces Row Level Security (RLS) on private tables", () => {
    expect(sqlContent).toContain("ALTER TABLE private.google_calendar_task_sync_desired ENABLE ROW LEVEL SECURITY");
    expect(sqlContent).toContain("ALTER TABLE private.google_calendar_task_event_mappings ENABLE ROW LEVEL SECURITY");
  });

  it("revokes all client access and grants access only to service_role", () => {
    expect(sqlContent).toContain(
      "REVOKE ALL ON TABLE private.google_calendar_task_sync_desired FROM PUBLIC, anon, authenticated"
    );
    expect(sqlContent).toContain("GRANT ALL ON TABLE private.google_calendar_task_sync_desired TO service_role");
    expect(sqlContent).toContain(
      "REVOKE ALL ON TABLE private.google_calendar_task_event_mappings FROM PUBLIC, anon, authenticated"
    );
    expect(sqlContent).toContain("GRANT ALL ON TABLE private.google_calendar_task_event_mappings TO service_role");
  });

  it("contains triggers for tasks reconciliation and connection disconnect cleanup", () => {
    expect(sqlContent).toContain("CREATE TRIGGER trg_google_calendar_task_sync_reconcile");
    expect(sqlContent).toContain("CREATE TRIGGER trg_google_calendar_connection_sync_reconcile");
  });

  it("defines all service-role RPCs with SECURITY DEFINER and safe search_path", () => {
    const requiredRpcs = [
      "public.claim_google_calendar_task_sync_jobs",
      "public.complete_google_calendar_task_sync_job",
      "public.reschedule_google_calendar_task_sync_job",
      "public.reconcile_google_calendar_tasks_for_owner",
    ];

    for (const rpc of requiredRpcs) {
      expect(sqlContent).toContain(rpc);
    }

    // SECURITY DEFINER check
    const securityDefinerCount = (sqlContent.match(/SECURITY DEFINER/g) || []).length;
    expect(securityDefinerCount).toBeGreaterThanOrEqual(5);

    // Explicit search_path check
    const searchPathCount = (sqlContent.match(/SET search_path =/g) || []).length;
    expect(searchPathCount).toBeGreaterThanOrEqual(5);
  });
});
