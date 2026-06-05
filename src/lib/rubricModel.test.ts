import { describe, expect, it } from "vitest";
import {
  buildRubricTableJson,
  canManageRubric,
  normalizeRubricGradeStatus,
  normalizeRubricVisibility,
  parseStoredRubricTemplate,
  validateRubricGradeTable,
  validateRubricTemplateInput,
} from "@/lib/rubricModel";

describe("rubricModel", () => {
  it("normalizes legacy and lowercase grade statuses", () => {
    expect(normalizeRubricGradeStatus("Draft")).toBe("draft");
    expect(normalizeRubricGradeStatus("Submitted")).toBe("submitted");
    expect(normalizeRubricGradeStatus("locked")).toBe("locked");
    expect(normalizeRubricGradeStatus("unknown")).toBe("draft");
    expect(normalizeRubricVisibility("PRIVATE")).toBe("private");
    expect(normalizeRubricVisibility("anything")).toBe("project");
  });

  it("allows only owner or admin to manage a rubric", () => {
    expect(
      canManageRubric({
        currentUserId: "lecturer-1",
        currentUserRole: "lecturer",
        createdBy: "lecturer-1",
      }),
    ).toBe(true);

    expect(
      canManageRubric({
        currentUserId: "lecturer-2",
        currentUserRole: "lecturer",
        createdBy: "lecturer-1",
      }),
    ).toBe(false);

    expect(
      canManageRubric({
        currentUserId: "admin-1",
        currentUserRole: "admin",
        createdBy: "lecturer-1",
      }),
    ).toBe(true);
  });

  it("builds JSONB-first rubric table payload", () => {
    const result = buildRubricTableJson(
      ["Tiêu chí", "Xuất sắc", "Điểm tối đa"],
      [{ "Tiêu chí": "Phân tích", "Xuất sắc": "Rõ ràng", "Điểm tối đa": "10" }],
      {
        criteriaColumnKey: "Tiêu chí",
        maxScoreColumnKey: "Điểm tối đa",
        ratingColumnKeys: ["Xuất sắc"],
      },
    );

    expect(result.columns).toHaveLength(3);
    expect(result.columns[0]).toMatchObject({ role: "criteria", label: "Tiêu chí" });
    expect(result.columns[1]).toMatchObject({ role: "rating", label: "Xuất sắc" });
    expect(result.columns[2]).toMatchObject({ role: "max_score", label: "Điểm tối đa" });
    expect(result.rows[0].id).toBe("row_1");
  });

  it("parses both new and legacy rubric template payloads", () => {
    const newModel = parseStoredRubricTemplate(
      {
        columns: [{ key: "criteria", label: "Tiêu chí", type: "text", role: "criteria" }],
        rows: [{ id: "row_1", criteria: "Lập kế hoạch" }],
      },
      [],
      { criteriaColumnKey: "criteria", ratingColumnKeys: [] },
    );

    const legacyModel = parseStoredRubricTemplate(
      [{ "Tiêu chí": "Lập kế hoạch" }],
      ["Tiêu chí"],
      { criteriaColumnKey: "Tiêu chí", ratingColumnKeys: [] },
    );

    expect(newModel.headers).toEqual(["Tiêu chí"]);
    expect(newModel.rows[0]["Tiêu chí"]).toBe("Lập kế hoạch");
    expect(legacyModel.headers).toEqual(["Tiêu chí"]);
    expect(legacyModel.rows[0]["Tiêu chí"]).toBe("Lập kế hoạch");
  });

  it("validates rubric template input and grading rows", () => {
    expect(
      validateRubricTemplateInput({
        name: "  ",
        headers: ["Tiêu chí"],
        rows: [{ "Tiêu chí": "A" }],
        criteriaColumnKey: "Tiêu chí",
        maxScoreColumnKey: null,
      }),
    ).toBe("Tên rubric không được để trống.");

    const validation = validateRubricGradeTable({
      rows: [
        { score: "abc", "Điểm tối đa": "10" },
        { score: "12", "Điểm tối đa": "10" },
        { score: "", "Điểm tối đa": "5" },
      ],
      maxScoreColumnKey: "Điểm tối đa",
      requireScores: true,
    });

    expect(validation.isValid).toBe(false);
    expect(validation.errors.map((error) => error.message)).toEqual([
      "Điểm chấm phải là số.",
      "Điểm chấm không được vượt quá điểm tối đa.",
      "Vui lòng nhập điểm cho tiêu chí này.",
    ]);
  });
});
