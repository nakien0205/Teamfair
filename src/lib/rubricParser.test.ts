import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { normalizeRawGrid, parseCSVText, parseRubricFile } from "@/lib/rubricParser";

describe("rubricParser", () => {
  it("parses quoted CSV cells, embedded separators, escaped quotes, and CRLF rows", () => {
    expect(parseCSVText('"Tiêu chí","Mô tả";"Điểm tối đa"\r\n"Phân tích","A; B, C ""quoted""","10"\r\n')).toEqual([
      ["Tiêu chí", "Mô tả", "Điểm tối đa"],
      ["Phân tích", 'A; B, C "quoted"', "10"],
    ]);
  });

  it("normalizes duplicate and blank headers while detecting criteria and max-score columns", () => {
    const parsed = normalizeRawGrid([
      [" Tiêu chí ", "", "Điểm tối đa", "Tiêu chí"],
      [" Kế hoạch ", "Rõ ràng", "10", "Bổ sung"],
      ["", "", "", ""],
    ]);

    expect(parsed.headers).toEqual(["Tiêu chí", "Cột 2", "Điểm tối đa", "Tiêu chí_1"]);
    expect(parsed.rows).toEqual([
      {
        "Tiêu chí": "Kế hoạch",
        "Cột 2": "Rõ ràng",
        "Điểm tối đa": "10",
        "Tiêu chí_1": "Bổ sung",
      },
    ]);
    expect(parsed.maxScoreColumnKey).toBe("Điểm tối đa");
    expect(parsed.settings.criteriaColumnKey).toBe("Tiêu chí");
    expect(parsed.settings.maxScoreColumnKey).toBe("Điểm tối đa");
  });

  it("parses UTF-8 CSV files with a BOM and rejects unsupported extensions", async () => {
    const csv = new File(["\uFEFFCriteria,Max Score\nPlanning,5"], "rubric.csv", { type: "text/csv" });

    await expect(parseRubricFile(csv)).resolves.toMatchObject({
      isMultiSheet: false,
      sheets: [
        {
          sheetName: "CSV",
          data: {
            headers: ["Criteria", "Max Score"],
            maxScoreColumnKey: "Max Score",
          },
        },
      ],
    });

    await expect(parseRubricFile(new File(["x"], "rubric.txt", { type: "text/plain" }))).rejects.toThrow(
      "File không đúng định dạng.",
    );
  });

  it("throws a useful error when the uploaded grid has no non-empty rows", () => {
    expect(() => normalizeRawGrid([[" ", ""], [""]])).toThrow("Rubric phải có ít nhất một dòng dữ liệu.");
  });

  it("parses multi-sheet XLSX files through the local SheetJS dependency", async () => {
    const workbook = XLSX.utils.book_new();
    const validSheet = XLSX.utils.aoa_to_sheet([
      ["Criteria", "Max Score"],
      ["Planning", "5"],
    ]);
    const blankSheet = XLSX.utils.aoa_to_sheet([["", ""]]);

    XLSX.utils.book_append_sheet(workbook, validSheet, "Valid rubric");
    XLSX.utils.book_append_sheet(workbook, blankSheet, "Blank rubric");

    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
    const file = new File([bytes], "rubric.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await expect(parseRubricFile(file)).resolves.toMatchObject({
      isMultiSheet: true,
      sheets: [
        {
          sheetName: "Valid rubric",
          data: {
            headers: ["Criteria", "Max Score"],
            rows: [{ Criteria: "Planning", "Max Score": "5" }],
          },
        },
        {
          sheetName: "Blank rubric",
          data: null,
          error: "Rubric phải có ít nhất một dòng dữ liệu.",
        },
      ],
    });
  });
});
