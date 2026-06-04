// Supabase persistence layer for Rubrics, Templates, Grades and Audit Logs
// Filename: src/lib/rubricPersistence.ts

import { supabase } from "@/lib/supabaseClient";
import type { ParsedRubric, RubricTemplateSettings } from "./rubricParser";

export interface RubricDbRow {
  id: string;
  project_id: string;
  course_id: string | null;
  name: string;
  description: string | null;
  original_file_name: string | null;
  file_type: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RubricTemplateDbRow {
  id: string;
  rubric_id: string;
  table_json: any;
  columns_json: any;
  settings_json: any;
  created_at: string;
  updated_at: string;
}

export interface RubricGradeDbRow {
  id: string;
  rubric_id: string;
  group_id: string;
  project_id: string;
  graded_by: string | null;
  grade_table_json: any;
  total_score: number;
  max_total_score: number;
  status: 'Draft' | 'Submitted';
  created_at: string;
  updated_at: string;
}

export interface RubricAuditLogDbRow {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  created_at: string;
}

/**
 * Creates an audit log entry for rubric actions.
 */
export async function insertRubricAuditLog(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  details: any
): Promise<void> {
  if (!userId) return;
  try {
    await supabase.from("rubric_audit_logs").insert({
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details
    });
  } catch (err) {
    console.error("Lỗi khi ghi nhận nhật ký hệ thống (Audit Log):", err);
  }
}

/**
 * Fetches all rubrics for a specific project/group.
 */
export async function fetchRubrics(projectId: string): Promise<RubricDbRow[]> {
  const { data, error } = await supabase
    .from("rubrics")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Lỗi khi tải danh sách Rubric:", error);
    throw new Error("Không thể tải danh sách Rubric.");
  }
  return data || [];
}

/**
 * Fetches a single rubric and its corresponding template.
 */
export async function fetchRubricWithTemplate(rubricId: string): Promise<{
  rubric: RubricDbRow;
  template: RubricTemplateDbRow;
}> {
  const { data: rubric, error: rubricError } = await supabase
    .from("rubrics")
    .select("*")
    .eq("id", rubricId)
    .single();

  if (rubricError) {
    console.error("Lỗi khi tải thông tin Rubric:", rubricError);
    throw new Error("Không thể tải thông tin Rubric.");
  }

  const { data: template, error: templateError } = await supabase
    .from("rubric_templates")
    .select("*")
    .eq("rubric_id", rubricId)
    .single();

  if (templateError) {
    console.error("Lỗi khi tải cấu trúc Template:", templateError);
    throw new Error("Không thể tải cấu trúc Template.");
  }

  return { rubric, template };
}

/**
 * Saves a rubric and its template structure.
 */
export async function saveRubricTemplate(
  projectId: string,
  rubricId: string | null,
  name: string,
  description: string,
  originalFileName: string | null,
  fileType: string | null,
  parsedData: ParsedRubric,
  userId: string
): Promise<string> {
  if (rubricId) {
    // 1. Update existing rubric
    const { error: rubricError } = await supabase
      .from("rubrics")
      .update({
        name,
        description,
        status: 'Active',
        updated_at: new Date().toISOString()
      })
      .eq("id", rubricId);

    if (rubricError) throw rubricError;

    // 2. Update existing template
    const { error: templateError } = await supabase
      .from("rubric_templates")
      .update({
        table_json: parsedData.rows,
        columns_json: parsedData.headers,
        settings_json: parsedData.settings,
        updated_at: new Date().toISOString()
      })
      .eq("rubric_id", rubricId);

    if (templateError) throw templateError;

    // 3. Create Audit Log
    await insertRubricAuditLog(
      userId,
      "EDIT_RUBRIC_TEMPLATE",
      "rubrics",
      rubricId,
      { name, description, file: originalFileName }
    );

    return rubricId;
  } else {
    // 1. Insert new rubric
    const { data: newRubric, error: rubricError } = await supabase
      .from("rubrics")
      .insert({
        project_id: projectId,
        course_id: null,
        name,
        description: description || null,
        original_file_name: originalFileName,
        file_type: fileType,
        status: 'Active',
        created_by: userId
      })
      .select("id")
      .single();

    if (rubricError) throw rubricError;
    const newRubricId = newRubric.id;

    // 2. Insert new template
    const { error: templateError } = await supabase
      .from("rubric_templates")
      .insert({
        rubric_id: newRubricId,
        table_json: parsedData.rows,
        columns_json: parsedData.headers,
        settings_json: parsedData.settings
      });

    if (templateError) throw templateError;

    // 3. Create Audit Log
    await insertRubricAuditLog(
      userId,
      "CREATE_RUBRIC_TEMPLATE",
      "rubrics",
      newRubricId,
      { name, description, file: originalFileName }
    );

    return newRubricId;
  }
}

/**
 * Deletes a rubric template (cascades to template and grades).
 */
export async function deleteRubric(rubricId: string, userId: string): Promise<void> {
  // Retrieve metadata for auditing before deletion
  const { data: rubric } = await supabase
    .from("rubrics")
    .select("name")
    .eq("id", rubricId)
    .maybeSingle();

  const { error } = await supabase
    .from("rubrics")
    .delete()
    .eq("id", rubricId);

  if (error) {
    console.error("Lỗi khi xóa Rubric:", error);
    throw new Error("Không thể xóa Rubric.");
  }

  await insertRubricAuditLog(
    userId,
    "DELETE_RUBRIC_TEMPLATE",
    "rubrics",
    rubricId,
    { name: rubric?.name || "Unknown" }
  );
}

/**
 * Fetches group members to populate grading grids and fetch student IDs.
 */
export async function fetchGroupMembers(groupId: string): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase
    .from("group_members")
    .select("student_id, users:student_id(full_name)")
    .eq("group_id", groupId);

  if (error) {
    console.error("Lỗi khi tải thành viên nhóm:", error);
    return [];
  }

  return data.map((row: any) => ({
    id: row.student_id,
    name: row.users?.full_name || row.student_id
  }));
}

/**
 * Fetches existing grade records for a rubric and group.
 */
export async function fetchRubricGrade(
  groupId: string,
  rubricId: string
): Promise<RubricGradeDbRow | null> {
  const { data, error } = await supabase
    .from("rubric_grades")
    .select("*")
    .eq("group_id", groupId)
    .eq("rubric_id", rubricId)
    .maybeSingle();

  if (error) {
    console.error("Lỗi khi tải kết quả chấm điểm:", error);
    return null;
  }
  return data;
}

/**
 * Saves a rubric grade sheet (as Draft or Submitted).
 * If status is Submitted, it also cascades the calculated final grade (scaled out of 10) 
 * to the `lecturer_scores` table for all group members.
 */
export async function saveRubricGrade(
  rubricId: string,
  groupId: string,
  projectId: string,
  gradedBy: string,
  gradeTableJson: any[],
  totalScore: number,
  maxTotalScore: number,
  status: 'Draft' | 'Submitted'
): Promise<void> {
  const { data, error } = await supabase
    .from("rubric_grades")
    .upsert({
      rubric_id: rubricId,
      group_id: groupId,
      project_id: projectId,
      graded_by: gradedBy,
      grade_table_json: gradeTableJson,
      total_score: totalScore,
      max_total_score: maxTotalScore,
      status,
      updated_at: new Date().toISOString()
    }, {
      onConflict: "rubric_id,group_id"
    })
    .select("id")
    .single();

  if (error) {
    console.error("Lỗi khi lưu kết quả chấm điểm:", error);
    throw new Error("Không thể lưu kết quả chấm điểm.");
  }

  const logAction = status === 'Submitted' ? "SUBMIT_RUBRIC_GRADE" : "SAVE_DRAFT_RUBRIC_GRADE";
  await insertRubricAuditLog(
    gradedBy,
    logAction,
    "rubric_grades",
    data.id,
    { group_id: groupId, total_score: totalScore, max_total_score: maxTotalScore }
  );

  // If final submission, cascade the scaled score to the students in the group
  if (status === 'Submitted') {
    // Score scaling: we calculate scale out of 10.
    // e.g. If total score is 8.5 out of 10, scaled is 8.5. If out of 100, scaled is 85/10 = 8.5.
    const maxVal = maxTotalScore > 0 ? maxTotalScore : 10;
    const rawScaledScore = (totalScore / maxVal) * 10;
    const scaledScore = Math.min(10, Math.max(0, Math.round(rawScaledScore * 10) / 10)); // Rounded to 1 decimal place

    // Fetch members to map their names
    const members = await fetchGroupMembers(groupId);
    
    // Upsert lecturer scores for each member
    for (const member of members) {
      try {
        await supabase
          .from("lecturer_scores")
          .upsert({
            group_id: groupId,
            student_name: member.name,
            score: scaledScore
          }, {
            onConflict: "group_id,student_name"
          });
      } catch (upsertErr) {
        console.error(`Lỗi khi gán điểm giảng viên cho thành viên ${member.name}:`, upsertErr);
      }
    }
  }
}
