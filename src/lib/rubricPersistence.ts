import { supabase } from "@/lib/supabaseClient";
import type { ParsedRubric } from "./rubricParser";
import {
  buildRubricTableJson,
  normalizeRubricGradeStatus,
  normalizeRubricTemplateStatus,
  normalizeRubricVisibility,
  parseStoredRubricTemplate,
  type RubricGradeStatus,
  type RubricTemplateStatus,
  type RubricVisibility,
} from "./rubricModel";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface RubricDbRow {
  id: string;
  project_id: string;
  course_id: string | null;
  name: string;
  description: string | null;
  original_file_name: string | null;
  file_type: string | null;
  status: RubricTemplateStatus;
  visibility: RubricVisibility;
  created_by: string | null;
  source_rubric_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface RubricTemplateDbRow {
  id: string;
  rubric_id: string;
  table_json: JsonValue;
  columns_json: JsonValue;
  settings_json: JsonValue;
  created_at: string;
  updated_at: string;
}

export interface RubricGradeDbRow {
  id: string;
  rubric_id: string;
  group_id: string;
  project_id: string;
  graded_by: string | null;
  grade_table_json: JsonValue;
  selected_cells_json?: JsonValue;
  total_score: number;
  max_total_score: number;
  status: RubricGradeStatus;
  submitted_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RubricAuditLogDbRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: JsonValue;
  created_at: string;
}

export interface RubricSummary {
  rubric: RubricDbRow;
  template: RubricTemplateDbRow | null;
  projectName: string;
  createdByName: string;
  selectedSheetName: string | null;
  rowCount: number;
  columnCount: number;
  usageCount: number;
}

export interface RubricGradeListRow extends RubricGradeDbRow {
  rubrics?: { name: string } | null;
  grader?: { full_name?: string | null; email?: string | null } | null;
}

type SupabaseLikeError = {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
  status?: number;
};

export const RUBRICS_SETUP_ERROR_MESSAGE = "Bảng rubrics chưa tồn tại hoặc schema cache chưa được cập nhật.";

function logRubricSupabaseError(context: string, error: SupabaseLikeError | null | undefined) {
  console.error(`[Rubrics] ${context}`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    status: error?.status,
  });
}

function isMissingRubricsRelation(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;

  const message = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`.toLowerCase();
  return (
    error.status === 404 ||
    error.code === "42P01" ||
    error.code === "PGRST204" ||
    error.code === "PGRST205" ||
    (message.includes("rubrics") &&
      (message.includes("does not exist") || message.includes("not found") || message.includes("schema cache")))
  );
}

function isMissingSourceRubricColumn(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;

  const message = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`.toLowerCase();
  return error.code === "PGRST204" && message.includes("source_rubric_id");
}

function isPermissionError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;

  const message = `${error.message || ""} ${error.details || ""} ${error.hint || ""}`.toLowerCase();
  return (
    error.status === 403 ||
    error.code === "42501" ||
    message.includes("row-level security") ||
    message.includes("permission denied")
  );
}

function isDuplicateError(error: SupabaseLikeError | null | undefined) {
  if (!error) return false;
  return error.code === "23505";
}

function toRubricUserError(defaultMessage: string, error: SupabaseLikeError | null | undefined) {
  if (isMissingRubricsRelation(error)) {
    return new Error(RUBRICS_SETUP_ERROR_MESSAGE);
  }

  if (isPermissionError(error)) {
    return new Error("Tài khoản hiện tại chưa có quyền lưu rubric. Hãy kiểm tra role giảng viên trong public.users và quyền truy cập của nhóm.");
  }

  if (isDuplicateError(error)) {
    return new Error("Tên rubric này đã tồn tại trong dự án. Vui lòng chọn một tên khác.");
  }

  return new Error(defaultMessage);
}

function normalizeRubricRow(data: RubricDbRow): RubricDbRow {
  return {
    ...data,
    status: normalizeRubricTemplateStatus(data.status),
    visibility: normalizeRubricVisibility(data.visibility),
  };
}

function normalizeGradeRow(data: RubricGradeDbRow): RubricGradeDbRow {
  return {
    ...data,
    status: normalizeRubricGradeStatus(data.status),
    submitted_at: data.submitted_at ?? null,
    locked_at: data.locked_at ?? null,
  };
}

function buildRubricSummary(params: {
  rubric: RubricDbRow;
  template: RubricTemplateDbRow | null;
  usageCount: number;
  projectName?: string | null;
  createdByName?: string | null;
}) {
  const parsedTemplate = params.template
    ? parseStoredRubricTemplate(params.template.table_json, params.template.columns_json, params.template.settings_json)
    : null;

  return {
    rubric: params.rubric,
    template: params.template,
    projectName: params.projectName || "Dự án",
    createdByName: params.createdByName || params.rubric.created_by || "Không xác định",
    selectedSheetName: parsedTemplate?.settings.selectedSheetName || null,
    rowCount: parsedTemplate?.rows.length || 0,
    columnCount: parsedTemplate?.headers.length || 0,
    usageCount: params.usageCount,
  } satisfies RubricSummary;
}

export async function insertRubricAuditLog(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  details: JsonValue,
): Promise<void> {
  if (!userId) return;

  try {
    const { error } = await supabase.from("rubric_audit_logs").insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });

    if (error) {
      logRubricSupabaseError("Failed to insert rubric audit log", error);
    }
  } catch (error) {
    console.error("[Rubrics] Unexpected failure while inserting rubric audit log", error);
  }
}

export async function fetchRubrics(projectId: string): Promise<RubricDbRow[]> {
  const { data, error } = await supabase
    .from("rubrics")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    logRubricSupabaseError("Failed to fetch rubric list", error);
    throw toRubricUserError("Không thể tải danh sách rubric.", error);
  }

  return (data || []).map((item) => normalizeRubricRow(item as RubricDbRow));
}

export async function fetchRubricSummaries(): Promise<RubricSummary[]> {
  const { data: rubrics, error: rubricError } = await supabase
    .from("rubrics")
    .select(`
      *,
      groups:project_id(project_name),
      users:created_by(full_name,email),
      rubric_templates(*)
    `)
    .order("created_at", { ascending: false });

  if (rubricError) {
    logRubricSupabaseError("Failed to fetch rubric summaries", rubricError);
    throw toRubricUserError("Không thể tải danh sách rubric.", rubricError);
  }

  const { data: grades, error: gradesError } = await supabase.from("rubric_grades").select("rubric_id");
  if (gradesError) {
    logRubricSupabaseError("Failed to fetch rubric usage counts", gradesError);
  }

  const usageCountByRubric = (grades || []).reduce<Record<string, number>>((accumulator, grade) => {
    const rubricId = (grade as { rubric_id?: string }).rubric_id;
    if (!rubricId) return accumulator;
    accumulator[rubricId] = (accumulator[rubricId] || 0) + 1;
    return accumulator;
  }, {});

  return ((rubrics || []) as Array<
    RubricDbRow & {
      groups?: { project_name?: string | null } | null;
      users?: { full_name?: string | null; email?: string | null } | null;
      rubric_templates?: RubricTemplateDbRow[] | RubricTemplateDbRow | null;
    }
  >).map((row) => {
    const template = Array.isArray(row.rubric_templates)
      ? row.rubric_templates[0] || null
      : row.rubric_templates || null;

    return buildRubricSummary({
      rubric: normalizeRubricRow(row),
      template,
      usageCount: usageCountByRubric[row.id] || 0,
      projectName: row.groups?.project_name || null,
      createdByName: row.users?.full_name || row.users?.email || null,
    });
  });
}

export async function fetchRubricWithTemplate(rubricId: string): Promise<{
  rubric: RubricDbRow;
  template: RubricTemplateDbRow;
}> {
  const { data: rubric, error: rubricError } = await supabase.from("rubrics").select("*").eq("id", rubricId).single();

  if (rubricError || !rubric) {
    logRubricSupabaseError("Failed to fetch rubric", rubricError);
    throw toRubricUserError("Không thể tải thông tin rubric.", rubricError);
  }

  const { data: template, error: templateError } = await supabase
    .from("rubric_templates")
    .select("*")
    .eq("rubric_id", rubricId)
    .single();

  if (templateError || !template) {
    logRubricSupabaseError("Failed to fetch rubric template", templateError);
    throw new Error("Không thể tải cấu trúc rubric template.");
  }

  return {
    rubric: normalizeRubricRow(rubric as RubricDbRow),
    template: template as RubricTemplateDbRow,
  };
}

export async function fetchRubricTemplateByRubricId(rubricId: string): Promise<RubricTemplateDbRow | null> {
  const { data: template, error } = await supabase
    .from("rubric_templates")
    .select("*")
    .eq("rubric_id", rubricId)
    .maybeSingle();

  if (error) {
    logRubricSupabaseError("Failed to fetch optional rubric template", error);
    throw new Error("Không thể tải cấu trúc rubric template.");
  }

  return (template as RubricTemplateDbRow | null) ?? null;
}

export async function fetchRubricSummaryById(rubricId: string): Promise<RubricSummary> {
  const summary = (await fetchRubricSummaries()).find((item) => item.rubric.id === rubricId);
  if (!summary) {
    throw new Error("Không tìm thấy rubric.");
  }
  return summary;
}

export async function saveRubricTemplate(
  projectId: string,
  rubricId: string | null,
  name: string,
  description: string,
  originalFileName: string | null,
  fileType: string | null,
  parsedData: ParsedRubric,
  userId: string,
): Promise<string> {
  const normalizedDescription = description.trim() || null;
  const tableJson = buildRubricTableJson(parsedData.headers, parsedData.rows, parsedData.settings) as unknown as JsonValue;
  const columnsJson = tableJson && typeof tableJson === "object" && "columns" in tableJson
    ? (tableJson as { columns: JsonValue }).columns
    : parsedData.columns;

  if (rubricId) {
    const { error: rubricError } = await supabase
      .from("rubrics")
      .update({
        name,
        description: normalizedDescription,
        updated_at: new Date().toISOString(),
      })
      .eq("id", rubricId);

    if (rubricError) {
      logRubricSupabaseError("Failed to update rubric", rubricError);
      throw toRubricUserError("Không thể cập nhật rubric.", rubricError);
    }

    const { error: templateError } = await supabase
      .from("rubric_templates")
      .update({
        table_json: tableJson,
        columns_json: columnsJson,
        settings_json: parsedData.settings,
        updated_at: new Date().toISOString(),
      })
      .eq("rubric_id", rubricId);

    if (templateError) {
      logRubricSupabaseError("Failed to update rubric template", templateError);
      throw new Error("Không thể cập nhật cấu trúc rubric.");
    }

    await insertRubricAuditLog(userId, "EDIT_RUBRIC_TEMPLATE", "rubrics", rubricId, {
      name,
      description: normalizedDescription,
      file: originalFileName,
      selected_sheet: parsedData.settings.selectedSheetName ?? null,
    });

    return rubricId;
  }

  const { data: newRubric, error: rubricError } = await supabase
    .from("rubrics")
    .insert({
      project_id: projectId,
      course_id: null,
      name,
      description: normalizedDescription,
      original_file_name: originalFileName,
      file_type: fileType,
      status: "active",
      visibility: "project",
      created_by: userId,
    })
    .select("id")
    .single();

  if (rubricError || !newRubric) {
    logRubricSupabaseError("Failed to create rubric", rubricError);
    throw toRubricUserError("Không thể tạo rubric.", rubricError);
  }

  const { error: templateError } = await supabase.from("rubric_templates").insert({
    rubric_id: newRubric.id,
    table_json: tableJson,
    columns_json: columnsJson,
    settings_json: parsedData.settings,
  });

  if (templateError) {
    logRubricSupabaseError("Failed to create rubric template", templateError);
    throw new Error("Không thể lưu cấu trúc rubric.");
  }

  await insertRubricAuditLog(userId, "CREATE_RUBRIC_TEMPLATE", "rubrics", newRubric.id, {
    name,
    description: normalizedDescription,
    file: originalFileName,
    selected_sheet: parsedData.settings.selectedSheetName ?? null,
  });

  return newRubric.id;
}

export async function deleteRubric(rubricId: string, userId: string | null): Promise<void> {
  const usageCount = await fetchRubricUsageCount(rubricId);
  if (usageCount > 0) {
    throw new Error("Rubric này đã được dùng để chấm điểm. Hãy lưu trữ thay vì xóa.");
  }

  const { data: rubric, error: loadError } = await supabase
    .from("rubrics")
    .select("name")
    .eq("id", rubricId)
    .maybeSingle();

  if (loadError) {
    logRubricSupabaseError("Failed to load rubric metadata before deletion", loadError);
  }

  const { error } = await supabase.from("rubrics").delete().eq("id", rubricId);

  if (error) {
    logRubricSupabaseError("Failed to delete rubric", error);
    throw toRubricUserError("Không thể xóa rubric.", error);
  }

  await insertRubricAuditLog(userId, "DELETE_RUBRIC_TEMPLATE", "rubrics", rubricId, {
    name: rubric?.name || "Unknown",
  });
}

export async function fetchRubricUsageCount(rubricId: string): Promise<number> {
  const { count, error } = await supabase
    .from("rubric_grades")
    .select("id", { count: "exact", head: true })
    .eq("rubric_id", rubricId);

  if (error) {
    logRubricSupabaseError("Failed to fetch rubric usage count", error);
    return 0;
  }

  return count || 0;
}

export async function duplicateRubric(params: {
  rubricId: string;
  userId: string;
  targetProjectId: string;
  newName: string;
}): Promise<string> {
  const { rubricId, userId, targetProjectId, newName } = params;
  if (!targetProjectId.trim()) {
    throw new Error("Vui lòng chọn dự án đích.");
  }
  const normalizedName = newName.trim();
  if (!normalizedName) {
    throw new Error("Vui lòng nhập tên rubric mới.");
  }
  const { rubric, template } = await fetchRubricWithTemplate(rubricId);
  const rubricInsertPayload = {
    project_id: targetProjectId,
    course_id: rubric.course_id,
    name: normalizedName,
    description: rubric.description,
    original_file_name: rubric.original_file_name,
    file_type: rubric.file_type,
    status: "active",
    visibility: rubric.visibility || "project",
    created_by: userId,
  };
  {
    const firstAttempt = await supabase
      .from("rubrics")
      .insert({
        ...rubricInsertPayload,
        source_rubric_id: rubric.id,
      })
      .select("id")
      .single();

    let safeNewRubric = firstAttempt.data;
    let safeRubricError = firstAttempt.error as SupabaseLikeError | null;

    if (safeRubricError && isMissingSourceRubricColumn(safeRubricError)) {
      const fallbackAttempt = await supabase
        .from("rubrics")
        .insert(rubricInsertPayload)
        .select("id")
        .single();

      safeNewRubric = fallbackAttempt.data;
      safeRubricError = fallbackAttempt.error as SupabaseLikeError | null;
    }

    if (safeRubricError || !safeNewRubric) {
      logRubricSupabaseError("Failed to duplicate rubric", safeRubricError);
      if (isPermissionError(safeRubricError)) {
        throw new Error("Báº¡n khÃ´ng cÃ³ quyá»n táº¡o rubric cho dá»± Ã¡n nÃ y.");
      }
      throw toRubricUserError("KhÃ´ng thá»ƒ nhÃ¢n báº£n rubric.", safeRubricError);
    }

    const { error: safeTemplateError } = await supabase.from("rubric_templates").insert({
      rubric_id: safeNewRubric.id,
      table_json: template.table_json,
      columns_json: template.columns_json,
      settings_json: template.settings_json,
    });

    if (safeTemplateError) {
      logRubricSupabaseError("Failed to duplicate rubric template", safeTemplateError);
      throw new Error("KhÃ´ng thá»ƒ sao chÃ©p cáº¥u trÃºc rubric.");
    }

    await insertRubricAuditLog(userId, "duplicate_rubric", "rubrics", safeNewRubric.id, {
      source_rubric_id: rubricId,
      target_rubric_id: safeNewRubric.id,
      target_project_id: targetProjectId,
      source_name: rubric.name,
      name: normalizedName,
    });

    return safeNewRubric.id;
  }
  const duplicatedName = rubric.name.includes("Bản sao") ? `${rubric.name} v2` : `${rubric.name} - Bản sao`;

  const { data: newRubric, error: rubricError } = await supabase
    .from("rubrics")
    .insert({
      project_id: targetProjectId,
      course_id: rubric.course_id,
      name: normalizedName,
      description: rubric.description,
      original_file_name: rubric.original_file_name,
      file_type: rubric.file_type,
      status: "active",
      visibility: rubric.visibility || "project",
      created_by: userId,
      source_rubric_id: rubric.id,
    })
    .select("id")
    .single();

  if (rubricError || !newRubric) {
    logRubricSupabaseError("Failed to duplicate rubric", rubricError);
    if (isPermissionError(rubricError)) {
      throw new Error("Bạn không có quyền tạo rubric cho dự án này.");
    }
    throw toRubricUserError("Không thể nhân bản rubric.", rubricError);
  }

  const { error: templateError } = await supabase.from("rubric_templates").insert({
    rubric_id: newRubric.id,
    table_json: template.table_json,
    columns_json: template.columns_json,
    settings_json: template.settings_json,
  });

  if (templateError) {
    logRubricSupabaseError("Failed to duplicate rubric template", templateError);
    throw new Error("Không thể sao chép cấu trúc rubric.");
  }

  await insertRubricAuditLog(userId, "duplicate_rubric", "rubrics", newRubric.id, {
    source_rubric_id: rubricId,
    target_rubric_id: newRubric.id,
    target_project_id: targetProjectId,
    source_name: rubric.name,
    name: normalizedName,
  });

  return newRubric.id;
}

export async function updateRubricArchiveState(rubricId: string, archived: boolean, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from("rubrics")
    .update({
      status: archived ? "archived" : "active",
      updated_at: new Date().toISOString(),
    })
    .eq("id", rubricId);

  if (error) {
    logRubricSupabaseError("Failed to update rubric archive state", error);
    throw toRubricUserError(archived ? "Không thể lưu trữ rubric." : "Không thể khôi phục rubric.", error);
  }

  await insertRubricAuditLog(userId, archived ? "ARCHIVE_RUBRIC_TEMPLATE" : "RESTORE_RUBRIC_TEMPLATE", "rubrics", rubricId, {
    status: archived ? "archived" : "active",
  });
}

export async function fetchGroupMembers(groupId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("student_id, users:student_id(full_name)")
    .eq("group_id", groupId);

  if (error) {
    logRubricSupabaseError("Failed to fetch group members", error);
    return [];
  }

  return (data || []).map((row: { student_id: string; users?: { full_name?: string | null } | null }) => ({
    id: row.student_id,
    name: row.users?.full_name || row.student_id,
  }));
}

export async function fetchRubricGrade(groupId: string, rubricId: string): Promise<RubricGradeDbRow | null> {
  const { data, error } = await supabase
    .from("rubric_grades")
    .select("*")
    .eq("group_id", groupId)
    .eq("rubric_id", rubricId)
    .maybeSingle();

  if (error) {
    logRubricSupabaseError("Failed to fetch rubric grade", error);
    return null;
  }

  return data ? normalizeGradeRow(data as RubricGradeDbRow) : null;
}

export async function fetchGradesForGroups(
  groupIds: string[],
): Promise<RubricGradeListRow[]> {
  if (groupIds.length === 0) return [];

  const { data, error } = await supabase
    .from("rubric_grades")
    .select("*, rubrics(name), grader:graded_by(full_name,email)")
    .in("group_id", groupIds);

  if (error) {
    logRubricSupabaseError("Failed to fetch rubric grades for groups", error);
    return [];
  }

  return (data || []).map((item) => ({
    ...(normalizeGradeRow(item as RubricGradeDbRow)),
    rubrics: (item as { rubrics?: { name: string } | null }).rubrics ?? null,
    grader: (item as { grader?: { full_name?: string | null; email?: string | null } | null }).grader ?? null,
  }));
}

export async function reopenRubricGrade(gradeId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("rubric_grades")
    .update({
      status: "draft",
      submitted_at: null,
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gradeId);

  if (error) {
    logRubricSupabaseError("Failed to reopen rubric grade", error);
    throw new Error("Không thể mở lại kết quả chấm điểm.");
  }

  await insertRubricAuditLog(userId, "REOPEN_RUBRIC_GRADE", "rubric_grades", gradeId, {
    action: "Reopened for editing",
  });
}

export async function saveRubricGrade(
  rubricId: string,
  groupId: string,
  projectId: string,
  gradedBy: string,
  gradeTableJson: JsonValue[],
  selectedCellsJson: JsonValue,
  totalScore: number,
  maxTotalScore: number,
  status: RubricGradeStatus,
): Promise<void> {
  const now = new Date().toISOString();
  const payload = {
    rubric_id: rubricId,
    group_id: groupId,
    project_id: projectId,
    graded_by: gradedBy,
    grade_table_json: gradeTableJson,
    selected_cells_json: selectedCellsJson,
    total_score: totalScore,
    max_total_score: maxTotalScore,
    status,
    submitted_at: status === "submitted" ? now : null,
    locked_at: status === "locked" ? now : null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("rubric_grades")
    .upsert(payload, {
      onConflict: "rubric_id,group_id",
    })
    .select("id")
    .single();

  if (error || !data) {
    logRubricSupabaseError("Failed to save rubric grade", error);
    throw toRubricUserError("Không thể lưu kết quả chấm điểm.", error);
  }

  const logAction =
    status === "submitted" ? "SUBMIT_RUBRIC_GRADE" : status === "locked" ? "LOCK_RUBRIC_GRADE" : "SAVE_DRAFT_RUBRIC_GRADE";

  await insertRubricAuditLog(gradedBy, logAction, "rubric_grades", data.id, {
    group_id: groupId,
    total_score: totalScore,
    max_total_score: maxTotalScore,
    status,
  });

  if (status !== "submitted") {
    return;
  }

  const members = await fetchGroupMembers(groupId);
  const maxValue = maxTotalScore > 0 ? maxTotalScore : 10;
  const scaledScore = Math.min(10, Math.max(0, Math.round(((totalScore / maxValue) * 10) * 10) / 10));

  for (const member of members) {
    const { error: lecturerScoreError } = await supabase.from("lecturer_scores").upsert(
      {
        group_id: groupId,
        student_name: member.name,
        score: scaledScore,
      },
      {
        onConflict: "group_id,student_name",
      },
    );

    if (lecturerScoreError) {
      logRubricSupabaseError(`Failed to upsert lecturer score for ${member.name}`, lecturerScoreError);
    }
  }
}
