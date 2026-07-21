import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = resolve(process.cwd(), "supabase/migrations");

describe("Supabase migration integrity", () => {
  it("uses each migration version exactly once", () => {
    const versions = readdirSync(migrationsDir)
      .filter((name) => name.endsWith(".sql"))
      .map((name) => name.match(/^(\d{14})_/)?.[1]);

    expect(versions).not.toContain(undefined);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it("keeps the duplicated June migration payloads under unique versions", () => {
    expect(existsSync(resolve(migrationsDir, "20260609090000_enable_realtime.sql"))).toBe(true);
    expect(existsSync(resolve(migrationsDir, "20260609091000_api_layer_invite_security.sql"))).toBe(true);
  });

  it("reconciles Realtime with guarded, idempotent publication changes", () => {
    const migration = readFileSync(
      resolve(migrationsDir, "20260721180001_reconcile_realtime.sql"),
      "utf8",
    );

    expect(migration).toContain("CREATE PUBLICATION supabase_realtime");
    expect(migration).toContain("IF NOT EXISTS (");
    expect(migration).toContain("FROM pg_publication_tables");
    expect(migration).toContain("to_regclass(format('public.%I', table_name)) IS NOT NULL");
    expect(migration).toContain("ALTER PUBLICATION supabase_realtime ADD TABLE public.%I");
    expect(migration).not.toMatch(
      /project_invites|CREATE POLICY|CREATE OR REPLACE FUNCTION|GRANT EXECUTE|REVOKE ALL/i,
    );

    for (const table of [
      "notifications",
      "tasks",
      "activity_logs",
      "group_members",
      "materials",
      "join_requests",
    ]) {
      expect(migration).toContain(`ALTER TABLE public.${table} REPLICA IDENTITY FULL;`);
    }
  });
});
