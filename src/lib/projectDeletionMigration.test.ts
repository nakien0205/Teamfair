import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("delete_project migration peer-review cleanup", () => {
  it("deletes task-scoped peer reviews before their RESTRICT period-task rows and the parent group", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "supabase/migrations/20260721180000_delete_project_rpc.sql"),
      "utf8",
    );
    const reviewsDelete = migration.indexOf("DELETE FROM public.peer_reviews WHERE group_id = v_group.id;");
    const periodTasksDelete = migration.indexOf("DELETE FROM public.peer_review_period_tasks WHERE group_id = v_group.id;");
    const groupDelete = migration.indexOf("DELETE FROM public.groups WHERE id = v_group.id;");

    expect(reviewsDelete).toBeGreaterThan(-1);
    expect(periodTasksDelete).toBeGreaterThan(reviewsDelete);
    expect(groupDelete).toBeGreaterThan(periodTasksDelete);
  });
});
