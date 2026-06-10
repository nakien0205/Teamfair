import {
  createRubricColumns,
  ensureRubricSettings,
  type RubricColumnDefinition,
  type RubricTemplateSettings,
} from "./rubricModel";

export interface SheetParseResult {
  sheetName: string;
  data: ParsedRubric | null;
  error?: string;
}

export interface MultiSheetParsedRubric {
  isMultiSheet: boolean;
  sheets: SheetParseResult[];
}

export interface ParsedRubric {
  columns: RubricColumnDefinition[];
  headers: string[];
  rows: Record<string, string>[];
  maxScoreColumnKey: string | null;
  settings: RubricTemplateSettings;
}

export function parseCSVText(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if ((char === "," || char === ";") && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      currentRow.push(currentCell.trim());
      currentCell = "";

      if (currentRow.some((cell) => cell !== "")) {
        rows.push(currentRow);
      }

      currentRow = [];
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      continue;
    }

    currentCell += char;
  }

  if (currentCell || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell !== "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

export async function parseExcelFileAllSheets(file: File): Promise<{ sheetName: string; rawGrid: string[][] }[]> {
  const arrayBuffer = await file.arrayBuffer();

  try {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: "array" });

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error("Không tìm thấy sheet nào trong file Excel.");
    }

    return workbook.SheetNames.map((sheetName: string) => {
      const worksheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" }) as unknown[][];

      return {
        sheetName,
        rawGrid: rawData.map((row) =>
          row.map((cell) => (cell === null || cell === undefined ? "" : String(cell).trim())),
        ),
      };
    });
  } catch (error) {
    console.error("[Rubrics] Failed to parse Excel file", error);
    throw new Error("Không thể đọc dữ liệu từ file Excel.");
  }
}

export function normalizeRawGrid(rawGrid: string[][]): ParsedRubric {
  const cleanGrid = rawGrid
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell !== ""));

  if (cleanGrid.length === 0) {
    throw new Error("Rubric phải có ít nhất một dòng dữ liệu.");
  }

  const rawHeaders = cleanGrid[0];
  const headers: string[] = [];

  rawHeaders.forEach((header, index) => {
    const baseHeader = header.trim() || `Cột ${index + 1}`;
    let candidate = baseHeader;
    let duplicateIndex = 1;

    while (headers.includes(candidate)) {
      candidate = `${baseHeader}_${duplicateIndex}`;
      duplicateIndex += 1;
    }

    headers.push(candidate);
  });

  const rows = cleanGrid.slice(1).map((rawRow) => {
    const normalizedRow: Record<string, string> = {};
    headers.forEach((header, index) => {
      normalizedRow[header] = rawRow[index] || "";
    });
    return normalizedRow;
  });

  const lowerCaseHeaders = headers.map((header) => header.toLowerCase().trim());
  const maxScoreColumnKey =
    headers.find((header, index) => {
      const lowerHeader = lowerCaseHeaders[index];
      return [
        "điểm tối đa",
        "diem toi da",
        "điểm max",
        "diem max",
        "max score",
        "max_score",
        "maxscore",
      ].some((keyword) => lowerHeader.includes(keyword));
    }) || null;

  const criteriaColumnKey =
    headers.find((header, index) => {
      const lowerHeader = lowerCaseHeaders[index];
      return ["tiêu chí", "tieu chi", "criteria", "nội dung đánh giá"].some((keyword) =>
        lowerHeader.includes(keyword),
      );
    }) || null;

  const settings = ensureRubricSettings({
    headerRowIndex: 0,
    criteriaColumnKey,
    maxScoreColumnKey,
    ratingColumnKeys: [],
    autoAddScoreColumn: true,
    scoreColumnLabel: "Điểm chấm",
    commentColumnLabel: "Nhận xét",
  });

  return {
    columns: createRubricColumns(headers, settings),
    headers,
    rows,
    maxScoreColumnKey,
    settings,
  };
}

export async function parseRubricFile(file: File): Promise<MultiSheetParsedRubric> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv") {
    const arrayBuffer = await file.arrayBuffer();
    const text = new TextDecoder("utf-8").decode(arrayBuffer).replace(/^\uFEFF/, "");
    return {
      isMultiSheet: false,
      sheets: [
        {
          sheetName: "CSV",
          data: normalizeRawGrid(parseCSVText(text)),
        },
      ],
    };
  }

  if (extension === "xlsx" || extension === "xls") {
    const sheets = await parseExcelFileAllSheets(file);
    return {
      isMultiSheet: true,
      sheets: sheets.map((sheet) => {
        try {
          return {
            sheetName: sheet.sheetName,
            data: normalizeRawGrid(sheet.rawGrid),
          };
        } catch (error) {
          return {
            sheetName: sheet.sheetName,
            data: null,
            error: error instanceof Error ? error.message : "Không thể đọc sheet.",
          };
        }
      }),
    };
  }

  throw new Error("File không đúng định dạng. Vui lòng tải lên file .xlsx, .xls hoặc .csv.");
}
