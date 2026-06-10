export type LecturerGroupImportRow = {
  index: number;
  raw: string;
  typeLabel: string | null;
  name: string;
  displayName: string;
  normalizedName: string;
};

export type LecturerMemberImportRow = {
  index: number;
  email: string;
  note: string | null;
  normalizedEmail: string;
};

const KNOWN_TYPE_LABELS = new Set([
  "lop",
  "lop hoc",
  "class",
  "course",
  "mon hoc",
  "project",
  "group",
  "nhom",
]);

const XLSX_URL = "https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs";

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

function isHeaderRow(cells: string[]): boolean {
  const normalized = cells.map(normalizeText);
  const hasType = normalized.some(cell => ["type", "loai", "group type", "loai nhom"].includes(cell));
  const hasName = normalized.some(cell => ["name", "ten", "display name", "ten hien thi"].includes(cell));
  return hasType && hasName;
}

function isMemberHeaderRow(cells: string[]): boolean {
  const normalized = cells.map(normalizeText);
  const hasEmail = normalized.some(cell => ["email", "e-mail", "mail"].includes(cell));
  const hasNote = normalized.some(cell => ["ghi chu", "note", "notes"].includes(cell));
  return hasEmail || (hasEmail && hasNote);
}

function stripLeadingNumbering(value: string): string {
  return value.replace(/^\s*\d+\s*[.\-)]\s*/, "").trim();
}

function splitImportLine(value: string): string[] {
  return value
    .split(/\s*(?:\||\t|;|,)\s*/)
    .map(part => part.trim())
    .filter(Boolean);
}

export function parseLecturerGroupImport(text: string): LecturerGroupImportRow[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const rows: LecturerGroupImportRow[] = [];

  lines.forEach((line, index) => {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) return;

    const parts = splitImportLine(raw).map(stripLeadingNumbering);
    if (parts.length === 0) return;

    let typeLabel: string | null = null;
    let name = parts[0];

    if (parts.length > 1) {
      const candidateType = normalizeText(parts[0]);
      if (KNOWN_TYPE_LABELS.has(candidateType)) {
        typeLabel = parts[0];
        name = parts.slice(1).join(" ").trim();
      }
    }

    name = stripLeadingNumbering(name);
    if (!name) return;

    const displayName = typeLabel ? `${typeLabel}: ${name}` : name;

    rows.push({
      index: index + 1,
      raw,
      typeLabel,
      name,
      displayName,
      normalizedName: normalizeText(displayName),
    });
  });

  return rows;
}

export function dedupeLecturerGroupImportRows(rows: LecturerGroupImportRow[]): LecturerGroupImportRow[] {
  const seen = new Set<string>();
  const deduped: LecturerGroupImportRow[] = [];

  for (const row of rows) {
    if (seen.has(row.normalizedName)) continue;
    seen.add(row.normalizedName);
    deduped.push(row);
  }

  return deduped;
}

function rowToImportLine(cells: string[]): string | null {
  const cleaned = cells.map(cell => cell.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;
  if (cleaned.length === 1) return cleaned[0];
  return `${cleaned[0]} | ${cleaned.slice(1).join(" ").trim()}`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function parseLecturerMemberImport(text: string): LecturerMemberImportRow[] {
  const lines = text.replace(/\r/g, "").split("\n");
  const rows: LecturerMemberImportRow[] = [];

  lines.forEach((line, index) => {
    const raw = line.trim();
    if (!raw || raw.startsWith("#")) return;

    const parts = splitImportLine(raw);
    const email = parts[0]?.trim() ?? "";
    const note = parts.slice(1).join(" ").trim() || null;

    if (!isValidEmail(email)) return;

    rows.push({
      index: index + 1,
      email,
      note,
      normalizedEmail: normalizeText(email),
    });
  });

  return rows;
}

export function dedupeLecturerMemberImportRows(rows: LecturerMemberImportRow[]): LecturerMemberImportRow[] {
  const seen = new Set<string>();
  const deduped: LecturerMemberImportRow[] = [];

  for (const row of rows) {
    if (seen.has(row.normalizedEmail)) continue;
    seen.add(row.normalizedEmail);
    deduped.push(row);
  }

  return deduped;
}

export async function parseLecturerGroupImportFile(file: File): Promise<LecturerGroupImportRow[]> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "csv" || extension === "txt") {
    return dedupeLecturerGroupImportRows(parseLecturerGroupImport(await file.text()));
  }

  if (!["xlsx", "xls"].includes(extension)) {
    throw new Error("File không đúng định dạng. Vui lòng tải lên file .xlsx, .xls hoặc .csv.");
  }

  const arrayBuffer = await file.arrayBuffer();

  try {
    const XLSX = await import(/* @vite-ignore */ XLSX_URL);
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error("Không tìm thấy sheet nào trong file Excel.");
    }

    const importLines: string[] = [];

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) return;

      const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
      grid.forEach((row, index) => {
        const cells = row.map(cell => (cell === null || cell === undefined ? "" : String(cell).trim()));
        if (cells.every(cell => cell === "")) return;
        if (index === 0 && isHeaderRow(cells)) return;

        const line = rowToImportLine(cells);
        if (line) importLines.push(line);
      });
    });

    return dedupeLecturerGroupImportRows(parseLecturerGroupImport(importLines.join("\n")));
  } catch (error) {
    console.error("[Lecturer group import] Failed to parse Excel file", error);
    throw new Error("Không thể đọc dữ liệu từ file Excel.");
  }
}

export async function parseLecturerMemberImportFile(file: File): Promise<LecturerMemberImportRow[]> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "csv" || extension === "txt") {
    return dedupeLecturerMemberImportRows(parseLecturerMemberImport(await file.text()));
  }

  if (!["xlsx", "xls"].includes(extension)) {
    throw new Error("File không đúng định dạng. Vui lòng tải lên file .xlsx, .xls hoặc .csv.");
  }

  const arrayBuffer = await file.arrayBuffer();

  try {
    const XLSX = await import(/* @vite-ignore */ XLSX_URL);
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error("Không tìm thấy sheet nào trong file Excel.");
    }

    const importLines: string[] = [];

    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      if (!worksheet) return;

      const grid = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];
      grid.forEach((row, index) => {
        const cells = row.map(cell => (cell === null || cell === undefined ? "" : String(cell).trim()));
        if (cells.every(cell => cell === "")) return;
        if (index === 0 && isMemberHeaderRow(cells)) return;

        const line = rowToImportLine(cells);
        if (line) importLines.push(line);
      });
    });

    return dedupeLecturerMemberImportRows(parseLecturerMemberImport(importLines.join("\n")));
  } catch (error) {
    console.error("[Lecturer member import] Failed to parse Excel file", error);
    throw new Error("Không thể đọc dữ liệu từ file Excel.");
  }
}
