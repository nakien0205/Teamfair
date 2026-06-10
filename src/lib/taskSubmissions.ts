import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type SubmissionHistoryRecord = {
  id: string;
  taskId: string;
  groupId: string;
  studentId: string;
  submissionNote: string;
  evidenceLinks: string[];
  evidenceFiles: Array<{
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath?: string;
    publicUrl?: string;
    uploadedAt: string;
  }>;
  checklistConfirmed: boolean;
  lateReason: string | null;
  isLate: boolean;
  submissionStatus: "pending_review" | "approved" | "need_revision" | "rejected";
  submittedAt: string;
};

const TASK_EVIDENCE_BUCKET = (import.meta.env.VITE_SUPABASE_TASK_EVIDENCE_BUCKET as string | undefined) || "task-evidence";

type DbTaskSubmission = {
  id: string;
  task_id: string;
  group_id: string;
  student_id: string;
  submission_note: string;
  evidence_links: unknown;
  evidence_files: unknown;
  checklist_confirmed: boolean;
  late_reason: string | null;
  is_late: boolean;
  submission_status: "pending_review" | "approved" | "need_revision" | "rejected";
  submitted_at: string;
};

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((item): item is string => typeof item === "string");
};

const normalizeEvidenceFiles = (value: unknown): SubmissionHistoryRecord["evidenceFiles"] => {
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
      publicUrl: typeof candidate.publicUrl === "string" ? candidate.publicUrl : undefined,
      uploadedAt: typeof candidate.uploadedAt === "string" ? candidate.uploadedAt : new Date().toISOString(),
    }];
  });
};

const mapSubmissionRow = (row: DbTaskSubmission): SubmissionHistoryRecord => ({
  id: row.id,
  taskId: row.task_id,
  groupId: row.group_id,
  studentId: row.student_id,
  submissionNote: row.submission_note,
  evidenceLinks: normalizeStringArray(row.evidence_links),
  evidenceFiles: normalizeEvidenceFiles(row.evidence_files),
  checklistConfirmed: row.checklist_confirmed,
  lateReason: row.late_reason,
  isLate: row.is_late,
  submissionStatus: row.submission_status,
  submittedAt: row.submitted_at,
});

export async function fetchLatestTaskSubmission(taskId: string): Promise<SubmissionHistoryRecord | null> {
  if (!isSupabaseConfigured) return null;

  const { data, error } = await supabase
    .from("task_submissions")
    .select("id, task_id, group_id, student_id, submission_note, evidence_links, evidence_files, checklist_confirmed, late_reason, is_late, submission_status, submitted_at")
    .eq("task_id", taskId)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapSubmissionRow(data as DbTaskSubmission) : null;
}

export async function createTaskSubmission(input: {
  taskId: string;
  groupId: string;
  studentId: string;
  submissionNote: string;
  evidenceLinks: string[];
  evidenceFiles: SubmissionHistoryRecord["evidenceFiles"];
  checklistConfirmed: boolean;
  lateReason: string | null;
  isLate: boolean;
}): Promise<SubmissionHistoryRecord> {
  if (!isSupabaseConfigured) {
    return {
      id: crypto.randomUUID(),
      taskId: input.taskId,
      groupId: input.groupId,
      studentId: input.studentId,
      submissionNote: input.submissionNote,
      evidenceLinks: input.evidenceLinks,
      evidenceFiles: input.evidenceFiles,
      checklistConfirmed: input.checklistConfirmed,
      lateReason: input.lateReason,
      isLate: input.isLate,
      submissionStatus: "pending_review",
      submittedAt: new Date().toISOString(),
    };
  }

  const { data, error } = await supabase
    .from("task_submissions")
    .insert({
      task_id: input.taskId,
      group_id: input.groupId,
      student_id: input.studentId,
      submission_note: input.submissionNote,
      evidence_links: input.evidenceLinks,
      evidence_files: input.evidenceFiles,
      checklist_confirmed: input.checklistConfirmed,
      late_reason: input.lateReason,
      is_late: input.isLate,
      submission_status: "pending_review",
    })
    .select("id, task_id, group_id, student_id, submission_note, evidence_links, evidence_files, checklist_confirmed, late_reason, is_late, submission_status, submitted_at")
    .single();

  if (error) throw new Error(error.message);
  return mapSubmissionRow(data as DbTaskSubmission);
}

const sanitizeFileName = (value: string) => {
  const cleaned = value.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (cleaned.length <= 120) return cleaned;
  const parts = cleaned.split(".");
  const ext = parts.length > 1 ? parts.pop() : "";
  const base = parts.join(".");
  const trimmedBase = base.slice(0, Math.max(1, 110 - (ext ? ext.length + 1 : 0)));
  return ext ? `${trimmedBase}.${ext}` : trimmedBase;
};

export async function uploadTaskEvidenceFiles(params: {
  groupId: string;
  taskId: string;
  studentId: string;
  files: File[];
}): Promise<SubmissionHistoryRecord["evidenceFiles"]> {
  if (!params.files.length) return [];
  if (!isSupabaseConfigured) {
    return params.files.map(file => ({
      fileName: sanitizeFileName(file.name),
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
    }));
  }

  const uploads: SubmissionHistoryRecord["evidenceFiles"] = [];

  for (const file of params.files) {
    const fileName = sanitizeFileName(file.name);
    const filePath = `${params.groupId}/${params.taskId}/${params.studentId}/${Date.now()}-${fileName}`;
    const { error } = await supabase.storage.from(TASK_EVIDENCE_BUCKET).upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

    if (error) {
      throw new Error(error.message);
    }

    uploads.push({
      fileName,
      fileSize: file.size,
      mimeType: file.type || "application/octet-stream",
      storagePath: filePath,
      uploadedAt: new Date().toISOString(),
    });
  }

  return uploads;
}

export async function createTaskEvidenceSignedUrl(storagePath: string, expiresInSeconds = 600): Promise<string> {
  if (!isSupabaseConfigured) return "";

  const { data, error } = await supabase.storage
    .from(TASK_EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}
