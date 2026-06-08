export type RubricColumnRole = "criteria" | "rating" | "max_score" | "text";
export type RubricColumnType = "text" | "rating" | "number";
export type RubricGradeStatus = "draft" | "submitted" | "locked";
export type RubricTemplateStatus = "active" | "archived";
export type RubricVisibility = "project" | "private";

export interface RubricColumnDefinition {
  key: string;
  label: string;
  type: RubricColumnType;
  role: RubricColumnRole;
}

export interface RubricTableRow {
  id: string;
  [key: string]: string | number;
}

export interface RubricTemplateSettings {
  headerRowIndex: number;
  criteriaColumnKey: string | null;
  maxScoreColumnKey: string | null;
  ratingColumnKeys: string[];
  autoAddScoreColumn: boolean;
  scoreColumnLabel: string;
  commentColumnLabel: string;
  selectedSheetName?: string;
  availableSheets?: string[];
  multiSheetImport?: boolean;
}

export interface RubricTableJson {
  columns: RubricColumnDefinition[];
  rows: RubricTableRow[];
}

export interface RubricPermissionContext {
  currentUserId?: string | null;
  currentUserRole?: "student" | "lecturer" | "admin" | null;
  createdBy?: string | null;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const DEFAULT_SCORE_LABEL = "Điểm chấm";
const DEFAULT_COMMENT_LABEL = "Nhận xét";

function slugifyHeader(label: string, index: number) {
  const normalized = label
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || `column_${index + 1}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeRubricGradeStatus(value: unknown): RubricGradeStatus {
  if (typeof value !== "string") {
    return "draft";
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "submitted" || normalized === "locked") {
    return normalized;
  }

  return "draft";
}

export function normalizeRubricTemplateStatus(value: unknown): RubricTemplateStatus {
  if (typeof value !== "string") {
    return "active";
  }

  return value.trim().toLowerCase() === "archived" ? "archived" : "active";
}

export function normalizeRubricVisibility(value: unknown): RubricVisibility {
  if (typeof value !== "string") {
    return "project";
  }

  return value.trim().toLowerCase() === "private" ? "private" : "project";
}

export function canManageRubric({ currentUserId, currentUserRole, createdBy }: RubricPermissionContext) {
  if (currentUserRole === "admin") return true;
  if (!currentUserId) return false;
  return Boolean(createdBy && createdBy === currentUserId);
}

export function ensureRubricSettings(settings: Partial<RubricTemplateSettings> | null | undefined): RubricTemplateSettings {
  return {
    headerRowIndex: settings?.headerRowIndex ?? 0,
    criteriaColumnKey: settings?.criteriaColumnKey ?? null,
    maxScoreColumnKey: settings?.maxScoreColumnKey ?? null,
    ratingColumnKeys: settings?.ratingColumnKeys ?? [],
    autoAddScoreColumn: settings?.autoAddScoreColumn ?? true,
    scoreColumnLabel: settings?.scoreColumnLabel ?? DEFAULT_SCORE_LABEL,
    commentColumnLabel: settings?.commentColumnLabel ?? DEFAULT_COMMENT_LABEL,
    selectedSheetName: settings?.selectedSheetName,
    availableSheets: settings?.availableSheets,
    multiSheetImport: settings?.multiSheetImport,
  };
}

export function createRubricColumns(headers: string[], settings: Partial<RubricTemplateSettings> | null | undefined): RubricColumnDefinition[] {
  const normalizedSettings = ensureRubricSettings(settings);
  const usedKeys = new Set<string>();

  return headers.map((header, index) => {
    const baseKey = slugifyHeader(header, index);
    let key = baseKey;
    let counter = 1;

    while (usedKeys.has(key)) {
      key = `${baseKey}_${counter}`;
      counter += 1;
    }

    usedKeys.add(key);

    const role: RubricColumnRole =
      normalizedSettings.criteriaColumnKey === header
        ? "criteria"
        : normalizedSettings.maxScoreColumnKey === header
          ? "max_score"
          : normalizedSettings.ratingColumnKeys.includes(header)
            ? "rating"
            : "text";

    return {
      key,
      label: header,
      type: role === "max_score" ? "number" : role === "rating" ? "rating" : "text",
      role,
    };
  });
}

export function normalizeRubricRows(
  rows: Record<string, string>[],
  columns: RubricColumnDefinition[],
): RubricTableRow[] {
  return rows.map((row, index) => {
    const normalizedRow: RubricTableRow = {
      id: typeof row.id === "string" && row.id.trim() ? row.id : `row_${index + 1}`,
    };

    columns.forEach((column) => {
      normalizedRow[column.key] = row[column.label] ?? row[column.key] ?? "";
    });

    return normalizedRow;
  });
}

export function buildRubricTableJson(
  headers: string[],
  rows: Record<string, string>[],
  settings: Partial<RubricTemplateSettings> | null | undefined,
): RubricTableJson {
  const columns = createRubricColumns(headers, settings);
  return {
    columns,
    rows: normalizeRubricRows(rows, columns),
  };
}

export function parseStoredRubricTemplate(
  tableJson: JsonValue,
  columnsJson: JsonValue,
  settingsJson: JsonValue,
): {
  columns: RubricColumnDefinition[];
  headers: string[];
  rows: Record<string, string>[];
  settings: RubricTemplateSettings;
} {
  const settings = ensureRubricSettings((isObject(settingsJson) ? settingsJson : {}) as Partial<RubricTemplateSettings>);

  if (isObject(tableJson) && Array.isArray(tableJson.columns) && Array.isArray(tableJson.rows)) {
    const columns = (tableJson.columns as unknown[]).map((column, index) => {
      const raw = isObject(column) ? column : {};
      const label = typeof raw.label === "string" && raw.label.trim() ? raw.label : `Cột ${index + 1}`;
      const key = typeof raw.key === "string" && raw.key.trim() ? raw.key : slugifyHeader(label, index);
      const role =
        raw.role === "criteria" || raw.role === "rating" || raw.role === "max_score" ? raw.role : "text";
      const type = raw.type === "number" || raw.type === "rating" ? raw.type : "text";

      return {
        key,
        label,
        role,
        type,
      } satisfies RubricColumnDefinition;
    });

    const rows = (tableJson.rows as unknown[]).map((row, index) => {
      const rawRow = isObject(row) ? row : {};
      const normalizedRow: Record<string, string> = {};

      columns.forEach((column) => {
        const value = rawRow[column.key];
        normalizedRow[column.label] = value === null || value === undefined ? "" : String(value);
      });

      normalizedRow.id = typeof rawRow.id === "string" && rawRow.id.trim() ? rawRow.id : `row_${index + 1}`;
      return normalizedRow;
    });

    return {
      columns,
      headers: columns.map((column) => column.label),
      rows,
      settings,
    };
  }

  const legacyHeaders = Array.isArray(columnsJson)
    ? columnsJson.map((item, index) => (typeof item === "string" && item.trim() ? item : `Cột ${index + 1}`))
    : [];
  const columns = createRubricColumns(legacyHeaders, settings);
  const legacyRows = Array.isArray(tableJson)
    ? tableJson.map((row, index) => {
        const rawRow = isObject(row) ? row : {};
        const normalizedRow: Record<string, string> = {};

        legacyHeaders.forEach((header) => {
          const value = rawRow[header];
          normalizedRow[header] = value === null || value === undefined ? "" : String(value);
        });

        normalizedRow.id = typeof rawRow.id === "string" && rawRow.id.trim() ? rawRow.id : `row_${index + 1}`;
        return normalizedRow;
      })
    : [];

  return {
    columns,
    headers: legacyHeaders,
    rows: legacyRows,
    settings,
  };
}

export function validateRubricTemplateInput(params: {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
  criteriaColumnKey: string | null;
  maxScoreColumnKey: string | null;
}) {
  if (!params.name.trim()) {
    return "Tên rubric không được để trống.";
  }

  if (params.headers.length === 0 || params.headers.some((header) => !header.trim())) {
    return "Tiêu đề cột không được để trống.";
  }

  if (params.rows.length === 0) {
    return "Rubric phải có ít nhất một dòng dữ liệu.";
  }

  if (!params.criteriaColumnKey) {
    return "Vui lòng chọn cột tiêu chí.";
  }

  if (params.maxScoreColumnKey) {
    const hasInvalidValue = params.rows.some((row) => {
      const value = String(row[params.maxScoreColumnKey as string] ?? "").trim();
      return value !== "" && Number.isNaN(Number(value));
    });

    if (hasInvalidValue) {
      return "Cột điểm tối đa phải chứa giá trị số.";
    }
  }

  return null;
}

export interface GradeValidationError {
  rowIndex: number;
  message: string;
}

export function validateRubricGradeTable(params: {
  rows: Record<string, string>[];
  maxScoreColumnKey: string | null;
  requireScores: boolean;
}) {
  const errors: GradeValidationError[] = [];

  params.rows.forEach((row, rowIndex) => {
    const rawScore = String(row.score ?? "").trim();

    if (!rawScore) {
      if (params.requireScores) {
        errors.push({ rowIndex, message: "Vui lòng nhập điểm cho tiêu chí này." });
      }
      return;
    }

    const numericScore = Number(rawScore);
    if (Number.isNaN(numericScore)) {
      errors.push({ rowIndex, message: "Điểm chấm phải là số." });
      return;
    }

    if (numericScore < 0) {
      errors.push({ rowIndex, message: "Điểm chấm không được âm." });
      return;
    }

    if (params.maxScoreColumnKey) {
      const maxScoreRaw = String(row[params.maxScoreColumnKey] ?? "").trim();
      const maxScore = Number(maxScoreRaw);

      if (maxScoreRaw && !Number.isNaN(maxScore) && numericScore > maxScore) {
        errors.push({ rowIndex, message: "Điểm chấm không được vượt quá điểm tối đa." });
      }
    }
  });

  return {
    isValid: errors.length === 0,
    errors,
  };
}
