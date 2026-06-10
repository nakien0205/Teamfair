import { describe, expect, it } from "vitest";
import { sanitizeStorageFileName, validateStorageFile } from "./storage";

describe("storage helpers", () => {
  it("sanitizes unsafe filenames", () => {
    expect(sanitizeStorageFileName("../rubric final!.pdf")).toBe(".._rubric_final_.pdf");
  });

  it("accepts configured material files under the size limit", () => {
    const file = new File(["rubric"], "rubric.pdf", { type: "application/pdf" });
    expect(validateStorageFile("materials", file)).toEqual({ valid: true, sanitizedName: "rubric.pdf" });
  });

  it("rejects unsupported evidence extensions", () => {
    const file = new File(["demo"], "demo.exe", { type: "application/octet-stream" });
    expect(validateStorageFile("evidence", file)).toMatchObject({ valid: false, reason: "type" });
  });

  it("rejects evidence files over 10MB", () => {
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" });
    expect(validateStorageFile("evidence", file)).toMatchObject({ valid: false, reason: "size" });
  });
});
