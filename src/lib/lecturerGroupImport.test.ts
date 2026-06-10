import { describe, expect, it } from "vitest";
import { dedupeLecturerGroupImportRows, parseLecturerGroupImport } from "./lecturerGroupImport";

describe("parseLecturerGroupImport", () => {
  it("parses simple lines and typed import rows", () => {
    const rows = parseLecturerGroupImport(`
1. Nhóm 1
Lớp học | SE101 - A
Project | Capstone 2026
# ignored comment
`);

    expect(rows).toHaveLength(3);
    expect(rows[0].name).toBe("Nhóm 1");
    expect(rows[0].displayName).toBe("Nhóm 1");
    expect(rows[1].typeLabel).toBe("Lớp học");
    expect(rows[1].displayName).toBe("Lớp học: SE101 - A");
    expect(rows[2].displayName).toBe("Project: Capstone 2026");
  });

  it("deduplicates rows using normalized display names", () => {
    const rows = parseLecturerGroupImport(`
Nhóm A
nhóm a
Nhóm B
`);

    const deduped = dedupeLecturerGroupImportRows(rows);

    expect(deduped).toHaveLength(2);
    expect(deduped.map(row => row.displayName)).toEqual(["Nhóm A", "Nhóm B"]);
  });
});
