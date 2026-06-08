import { z } from "zod";
import { supabase, isSupabaseConfigured } from "@/lib/supabaseClient";

export type StudentAppealType =
  | "risk_flag"
  | "low_contribution"
  | "rejected_task"
  | "missing_contribution"
  | "other";

export type StudentAppealStatus = "draft" | "submitted" | "under_review" | "resolved" | "rejected";

export type AppealAttachment = {
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath?: string;
  uploadedAt: string;
};

export type StudentAppealRecord = {
  id: string;
  groupId: string;
  studentId: string;
  appealType: StudentAppealType;
  relatedTaskId?: string | null;
  relatedFeedbackId?: string | null;
  relatedPeriodId?: string | null;
  relatedMilestone?: string | null;
  explanationContent: string;
  evidenceLinks: string[];
  attachments: AppealAttachment[];
  status: StudentAppealStatus;
  submittedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type DbStudentAppeal = {
  id: string;
  group_id: string;
  student_id: string;
  appeal_type: StudentAppealType;
  related_task_id: string | null;
  related_feedback_id: string | null;
  related_period_id: string | null;
  related_milestone: string | null;
  explanation_content: string;
  evidence_links: unknown;
  attachment_files: unknown;
  status: StudentAppealStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

const APPEAL_BUCKET = (import.meta.env.VITE_SUPABASE_APPEAL_BUCKET as string | undefined) || "student-appeals";

export const appealTypeMeta: Record<StudentAppealType, string> = {
  risk_flag: "Giải trình cờ rủi ro",
  low_contribution: "Điểm đóng góp thấp",
  rejected_task: "Task bị từ chối",
  missing_contribution: "Thiếu ghi nhận đóng góp",
  other: "Khác",
};

export const appealStatusMeta: Record<StudentAppealStatus, { label: string; className: string }> = {
  draft: { label: "Bản nháp", className: "border-slate-200 bg-slate-100 text-slate-700" },
  submitted: { label: "Đã gửi", className: "border-sky-200 bg-sky-50 text-sky-700" },
  under_review: { label: "Đang xem xét", className: "border-amber-200 bg-amber-50 text-amber-700" },
  resolved: { label: "Đã xử lý", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  rejected: { label: "Bị từ chối", className: "border-rose-200 bg-rose-50 text-rose-700" },
};

export const appealFormSchema = z.object({
  appealType: z.enum(["risk_flag", "low_contribution", "rejected_task", "missing_contribution", "other"], {
    message: "Vui lòng chọn loại giải trình.",
  }),
  explanationContent: z
    .string()
    .trim()
    .min(50, "Nội dung giải trình cần ít nhất 50 ký tự.")
    .max(2000, "Nội dung giải trình không được vượt quá 2000 ký tự."),
  confirmationChecked: z.literal(true, {
    errorMap: () => ({ message: "Bạn cần xác nhận trước khi gửi." }),
  }),
});

const normalizeStringArray = (value: unknown) => {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((item): item is string => typeof item === "string");
};

const normalizeAttachments = (value: unknown): AppealAttachment[] => {
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

const mapRow = (row: DbStudentAppeal): StudentAppealRecord => ({
  id: row.id,
  groupId: row.group_id,
  studentId: row.student_id,
  appealType: row.appeal_type,
  relatedTaskId: row.related_task_id,
  relatedFeedbackId: row.related_feedback_id,
  relatedPeriodId: row.related_period_id,
  relatedMilestone: row.related_milestone,
  explanationContent: row.explanation_content,
  evidenceLinks: normalizeStringArray(row.evidence_links),
  attachments: normalizeAttachments(row.attachment_files),
  status: row.status,
  submittedAt: row.submitted_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_");

export async function listStudentAppeals(studentId: string): Promise<StudentAppealRecord[]> {
  if (!isSupabaseConfigured) return [];
  const { data, error } = await supabase
    .from("student_appeals")
    .select("id, group_id, student_id, appeal_type, related_task_id, related_feedback_id, related_period_id, related_milestone, explanation_content, evidence_links, attachment_files, status, submitted_at, created_at, updated_at")
    .eq("student_id", studentId)
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).map(row => mapRow(row as DbStudentAppeal));
}

export async function getStudentAppeal(appealId: string): Promise<StudentAppealRecord | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase
    .from("student_appeals")
    .select("id, group_id, student_id, appeal_type, related_task_id, related_feedback_id, related_period_id, related_milestone, explanation_content, evidence_links, attachment_files, status, submitted_at, created_at, updated_at")
    .eq("id", appealId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRow(data as DbStudentAppeal) : null;
}

export async function createStudentAppeal(input: Omit<StudentAppealRecord, "id" | "createdAt" | "updatedAt" | "submittedAt">): Promise<StudentAppealRecord> {
  if (!isSupabaseConfigured) {
    const timestamp = new Date().toISOString();
    return { ...input, id: crypto.randomUUID(), createdAt: timestamp, updatedAt: timestamp, submittedAt: null };
  }

  const { data, error } = await supabase
    .from("student_appeals")
    .insert({
      group_id: input.groupId,
      student_id: input.studentId,
      appeal_type: input.appealType,
      related_task_id: input.relatedTaskId || null,
      related_feedback_id: input.relatedFeedbackId || null,
      related_period_id: input.relatedPeriodId || null,
      related_milestone: input.relatedMilestone || null,
      explanation_content: input.explanationContent,
      evidence_links: input.evidenceLinks,
      attachment_files: input.attachments,
      status: input.status,
    })
    .select("id, group_id, student_id, appeal_type, related_task_id, related_feedback_id, related_period_id, related_milestone, explanation_content, evidence_links, attachment_files, status, submitted_at, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as DbStudentAppeal);
}

export async function updateStudentAppeal(appealId: string, updates: {
  appealType: StudentAppealType;
  relatedTaskId?: string | null;
  relatedFeedbackId?: string | null;
  relatedPeriodId?: string | null;
  relatedMilestone?: string | null;
  explanationContent: string;
  evidenceLinks: string[];
  attachments: AppealAttachment[];
}): Promise<StudentAppealRecord> {
  if (!isSupabaseConfigured) {
    const timestamp = new Date().toISOString();
    return {
      id: appealId,
      groupId: "",
      studentId: "",
      appealType: updates.appealType,
      relatedTaskId: updates.relatedTaskId || null,
      relatedFeedbackId: updates.relatedFeedbackId || null,
      relatedPeriodId: updates.relatedPeriodId || null,
      relatedMilestone: updates.relatedMilestone || null,
      explanationContent: updates.explanationContent,
      evidenceLinks: updates.evidenceLinks,
      attachments: updates.attachments,
      status: "draft",
      submittedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }

  const { data, error } = await supabase
    .from("student_appeals")
    .update({
      appeal_type: updates.appealType,
      related_task_id: updates.relatedTaskId || null,
      related_feedback_id: updates.relatedFeedbackId || null,
      related_period_id: updates.relatedPeriodId || null,
      related_milestone: updates.relatedMilestone || null,
      explanation_content: updates.explanationContent,
      evidence_links: updates.evidenceLinks,
      attachment_files: updates.attachments,
      updated_at: new Date().toISOString(),
    })
    .eq("id", appealId)
    .eq("status", "draft")
    .select("id, group_id, student_id, appeal_type, related_task_id, related_feedback_id, related_period_id, related_milestone, explanation_content, evidence_links, attachment_files, status, submitted_at, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  return mapRow(data as DbStudentAppeal);
}

export async function submitStudentAppeal(appealId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase
    .from("student_appeals")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", appealId)
    .eq("status", "draft");

  if (error) throw new Error(error.message);
}

export async function uploadAppealAttachment(params: {
  groupId: string;
  studentId: string;
  file: File;
}): Promise<AppealAttachment> {
  const fileName = sanitizeFileName(params.file.name);
  if (!isSupabaseConfigured) {
    return {
      fileName,
      fileSize: params.file.size,
      mimeType: params.file.type || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
    };
  }

  const storagePath = `${params.groupId}/${params.studentId}/${Date.now()}-${fileName}`;
  const { error } = await supabase.storage.from(APPEAL_BUCKET).upload(storagePath, params.file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) throw new Error(error.message);

  return {
    fileName,
    fileSize: params.file.size,
    mimeType: params.file.type || "application/octet-stream",
    storagePath,
    uploadedAt: new Date().toISOString(),
  };
}
