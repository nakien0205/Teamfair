import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type WorkLogAttachment = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath?: string;
  uploadedAt: string;
};

export type WorkLogRecord = {
  id: string;
  groupId: string;
  studentId: string;
  taskId?: string | null;
  relatedTaskName?: string | null;
  workDate: string;
  timeSpentHours: number;
  description: string;
  evidenceLink?: string | null;
  attachments: WorkLogAttachment[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
};

type DbWorkLog = {
  id: string;
  group_id: string;
  student_id: string;
  task_id: string | null;
  work_date: string;
  hours_spent: number;
  log_text: string;
  evidence_link: string | null;
  attachment: unknown;
  logged_at: string;
  updated_at: string;
  deleted_at: string | null;
  tasks?: { title: string } | { title: string }[] | null;
};

const WORK_LOG_BUCKET = (import.meta.env.VITE_SUPABASE_WORK_LOG_BUCKET as string | undefined) || "work-log-attachments";

const normalizeAttachments = (value: unknown): WorkLogAttachment[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    if (typeof candidate.fileName !== "string") return [];
    return [{
      fileName: candidate.fileName,
      fileSize: typeof candidate.fileSize === "number" ? candidate.fileSize : 0,
      mimeType: typeof candidate.mimeType === "string" ? candidate.mimeType : "application/octet-stream",
      storagePath: typeof candidate.storagePath === "string" ? candidate.storagePath : undefined,
      uploadedAt: typeof candidate.uploadedAt === "string" ? candidate.uploadedAt : new Date().toISOString(),
    }];
  });
};

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_");

const mapRow = (row: DbWorkLog): WorkLogRecord => ({
  id: row.id,
  groupId: row.group_id,
  studentId: row.student_id,
  taskId: row.task_id,
  relatedTaskName: Array.isArray(row.tasks) ? row.tasks[0]?.title || null : row.tasks?.title || null,
  workDate: row.work_date,
  timeSpentHours: Number(row.hours_spent),
  description: row.log_text,
  evidenceLink: row.evidence_link,
  attachments: normalizeAttachments(row.attachment),
  createdAt: row.logged_at,
  updatedAt: row.updated_at,
  deletedAt: row.deleted_at,
});

export async function listStudentWorkLogs(studentId: string, groupId: string): Promise<WorkLogRecord[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("contribution_logs")
    .select("id, group_id, student_id, task_id, work_date, hours_spent, log_text, evidence_link, attachment, logged_at, updated_at, deleted_at, tasks:task_id(title)")
    .eq("student_id", studentId)
    .eq("group_id", groupId)
    .is("deleted_at", null)
    .order("work_date", { ascending: false })
    .order("logged_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(row => mapRow(row as DbWorkLog));
}

export async function createStudentWorkLog(input: {
  groupId: string;
  studentId: string;
  taskId?: string | null;
  workDate: string;
  timeSpentHours: number;
  description: string;
  evidenceLink?: string | null;
  attachments?: WorkLogAttachment[];
}): Promise<WorkLogRecord> {
  if (!isSupabaseConfigured) {
    return {
      id: crypto.randomUUID(),
      groupId: input.groupId,
      studentId: input.studentId,
      taskId: input.taskId || null,
      relatedTaskName: null,
      workDate: input.workDate,
      timeSpentHours: input.timeSpentHours,
      description: input.description,
      evidenceLink: input.evidenceLink || null,
      attachments: input.attachments || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
  }

  const { data, error } = await supabase
    .from("contribution_logs")
    .insert({
      group_id: input.groupId,
      student_id: input.studentId,
      task_id: input.taskId || null,
      work_date: input.workDate,
      hours_spent: input.timeSpentHours,
      log_text: input.description,
      evidence_link: input.evidenceLink || null,
      attachment: input.attachments || [],
    })
    .select("id, group_id, student_id, task_id, work_date, hours_spent, log_text, evidence_link, attachment, logged_at, updated_at, deleted_at, tasks:task_id(title)")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as DbWorkLog);
}

export async function updateStudentWorkLog(id: string, updates: {
  taskId?: string | null;
  workDate: string;
  timeSpentHours: number;
  description: string;
  evidenceLink?: string | null;
  attachments?: WorkLogAttachment[];
}): Promise<WorkLogRecord> {
  const { data, error } = await supabase
    .from("contribution_logs")
    .update({
      task_id: updates.taskId || null,
      work_date: updates.workDate,
      hours_spent: updates.timeSpentHours,
      log_text: updates.description,
      evidence_link: updates.evidenceLink || null,
      attachment: updates.attachments || [],
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, group_id, student_id, task_id, work_date, hours_spent, log_text, evidence_link, attachment, logged_at, updated_at, deleted_at, tasks:task_id(title)")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as DbWorkLog);
}

export async function softDeleteStudentWorkLog(id: string): Promise<void> {
  const { error } = await supabase
    .from("contribution_logs")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function uploadWorkLogAttachment(params: {
  groupId: string;
  studentId: string;
  file: File;
}): Promise<WorkLogAttachment> {
  const fileName = sanitizeFileName(file.name);

  if (!isSupabaseConfigured) {
    return {
      fileName,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
    };
  }

  const storagePath = `${params.groupId}/${params.studentId}/${Date.now()}-${fileName}`;
  const { error } = await supabase.storage.from(WORK_LOG_BUCKET).upload(storagePath, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw new Error(error.message);

  return {
    fileName,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
    storagePath,
    uploadedAt: new Date().toISOString(),
  };
}
