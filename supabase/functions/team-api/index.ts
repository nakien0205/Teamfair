import { getSupabaseAdmin, requireAuthUser } from "../_shared/auth.ts";
import { isAllowedOrigin, optionsResponse } from "../_shared/cors.ts";
import { enforceRateLimit } from "../_shared/ratelimit.ts";
import { ApiError, internalError, jsonError, jsonOk } from "../_shared/responses.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const createInviteSchema = z.object({
  groupId: z.string().uuid(),
  approvalMode: z.enum(["auto", "requires_approval"]),
  expiresAt: z.string().trim().nullable().optional(),
  maxUses: z.number().int().min(1).max(500).nullable().optional(),
}).strict();

const listInvitesSchema = z.object({
  groupId: z.string().uuid(),
}).strict();

const revokeInviteSchema = z.object({
  inviteId: z.string().regex(/^IV-[A-Z0-9]{6}$/i),
}).strict();

const joinWithInviteSchema = z.object({
  inviteCode: z.string().regex(/^IV-[A-Z0-9]{6}$/i),
}).strict();

const processJoinRequestSchema = z.object({
  requestId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
}).strict();

const submitStudentReportSchema = z.object({
  groupId: z.string().uuid(),
  toName: z.string().min(1).max(160),
  reason: z.string().min(1).max(120),
  notes: z.string().max(2000).nullable().optional(),
}).strict();

const saveLecturerEvaluationSchema = z.object({
  groupId: z.string().uuid(),
  studentName: z.string().min(1).max(160),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).nullable().optional(),
  awardBadge: z.boolean(),
}).strict();

const approveTaskSchema = z.object({
  groupId: z.string().uuid(),
  taskId: z.string().uuid(),
}).strict();

const calculateContributionSnapshotSchema = z.object({
  groupId: z.string().uuid(),
}).strict();

const payloadSchemas: Record<string, z.ZodType<any>> = {
  create_invite: createInviteSchema,
  list_invites: listInvitesSchema,
  revoke_invite: revokeInviteSchema,
  join_with_invite: joinWithInviteSchema,
  process_join_request: processJoinRequestSchema,
  submit_student_report: submitStudentReportSchema,
  save_lecturer_evaluation: saveLecturerEvaluationSchema,
  approve_task: approveTaskSchema,
  calculate_contribution_snapshot: calculateContributionSnapshotSchema,
};


type ApprovalMode = "auto" | "requires_approval";
type JoinStatus = "success" | "pending_approval";
type ProcessStatus = "approved" | "rejected";

type ProfileRow = {
  id: string;
  email: string;
  role: "student" | "lecturer" | "admin";
  full_name: string;
};

type GroupRow = {
  id: string;
  project_name: string;
  lecturer_id: string;
};

type InviteRow = {
  id: string;
  group_id: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  approval_mode: ApprovalMode;
  created_at: string;
};

type JoinRequestRow = {
  id: string;
  group_id: string;
  invite_id: string;
  user_id: string;
  status: ProcessStatus | "pending";
  created_at: string;
};

type TaskRow = {
  id: string;
  group_id: string;
  title: string;
  assignee_id: string | null;
  approved: boolean;
  contribution_percent: number | null;
  weight: number;
  evidence: unknown;
};

const ACTIONS = new Set([
  "create_invite",
  "list_invites",
  "revoke_invite",
  "join_with_invite",
  "process_join_request",
  "submit_student_report",
  "save_lecturer_evaluation",
  "approve_task",
  "calculate_contribution_snapshot",
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError("bad_request", "Dữ liệu gửi lên không hợp lệ.");
  }
  return value as Record<string, unknown>;
}

function stringField(payload: Record<string, unknown>, key: string, max = 200): string {
  const value = payload[key];
  if (typeof value !== "string") {
    throw new ApiError("bad_request", "Dữ liệu gửi lên không hợp lệ.");
  }
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) {
    throw new ApiError("bad_request", "Dữ liệu gửi lên không hợp lệ.");
  }
  return trimmed;
}

function optionalStringField(payload: Record<string, unknown>, key: string, max = 2000): string | null {
  const value = payload[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw new ApiError("bad_request", "Dữ liệu gửi lên không hợp lệ.");
  }
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function uuidField(payload: Record<string, unknown>, key: string): string {
  const value = stringField(payload, key, 80);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ApiError("bad_request", "Mã định danh không hợp lệ.");
  }
  return value;
}

function normalizeInviteCode(value: unknown): string {
  if (typeof value !== "string") {
    throw new ApiError("bad_request", "Mã mời không hợp lệ.");
  }
  const normalized = value.trim().toUpperCase();
  if (!/^IV-[A-Z0-9]{6}$/.test(normalized)) {
    throw new ApiError("bad_request", "Mã mời không hợp lệ.");
  }
  return normalized;
}

function generateInviteCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let suffix = "";
  for (const byte of bytes) {
    suffix += chars[byte % chars.length];
  }
  return `IV-${suffix}`;
}

function toError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message: unknown }).message);
    if (message.includes("invite_not_found")) return new ApiError("not_found", "Mã mời không tồn tại hoặc không hợp lệ.");
    if (message.includes("invite_expired")) return new ApiError("gone", "Mã mời đã hết hạn.");
    if (message.includes("invite_full")) return new ApiError("conflict", "Mã mời đã đạt số lượt sử dụng tối đa.");
    if (message.includes("already_member")) return new ApiError("conflict", "Bạn đã là thành viên của dự án này.");
    if (message.includes("request_already_pending")) return new ApiError("conflict", "Yêu cầu tham gia của bạn đang chờ duyệt.");
    if (message.includes("request_not_found")) return new ApiError("not_found", "Không tìm thấy yêu cầu tham gia.");
    if (message.includes("request_not_pending")) return new ApiError("conflict", "Yêu cầu tham gia này đã được xử lý.");
  }
  return new ApiError("internal_error", "Không thể xử lý yêu cầu. Vui lòng thử lại sau.");
}

async function getProfile(admin: ReturnType<typeof getSupabaseAdmin>, userId: string): Promise<ProfileRow> {
  const { data, error } = await admin
    .from("users")
    .select("id,email,role,full_name")
    .eq("id", userId)
    .single();

  if (error || !data) {
    throw new ApiError("forbidden", "Không tìm thấy hồ sơ người dùng.");
  }

  return data as ProfileRow;
}

async function getGroup(admin: ReturnType<typeof getSupabaseAdmin>, groupId: string): Promise<GroupRow> {
  const { data, error } = await admin
    .from("groups")
    .select("id,project_name,lecturer_id")
    .eq("id", groupId)
    .single();

  if (error || !data) {
    throw new ApiError("not_found", "Không tìm thấy dự án.");
  }

  return data as GroupRow;
}

async function isGroupLeader(admin: ReturnType<typeof getSupabaseAdmin>, groupId: string, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("student_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data?.role === "Leader";
}

async function isGroupMember(admin: ReturnType<typeof getSupabaseAdmin>, groupId: string, userId: string): Promise<boolean> {
  const { data, error } = await admin
    .from("group_members")
    .select("student_id")
    .eq("group_id", groupId)
    .eq("student_id", userId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

async function canManageGroup(
  admin: ReturnType<typeof getSupabaseAdmin>,
  profile: ProfileRow,
  groupId: string,
): Promise<boolean> {
  const group = await getGroup(admin, groupId);
  return profile.role === "admin" || group.lecturer_id === profile.id || await isGroupLeader(admin, groupId, profile.id);
}

async function canReviewGroup(
  admin: ReturnType<typeof getSupabaseAdmin>,
  profile: ProfileRow,
  groupId: string,
): Promise<boolean> {
  const group = await getGroup(admin, groupId);
  return profile.role === "admin" || group.lecturer_id === profile.id;
}

async function assertCanManageGroup(admin: ReturnType<typeof getSupabaseAdmin>, profile: ProfileRow, groupId: string): Promise<void> {
  if (!await canManageGroup(admin, profile, groupId)) {
    throw new ApiError("forbidden", "Bạn không có quyền quản lý dự án này.");
  }
}

async function assertCanReadGroup(admin: ReturnType<typeof getSupabaseAdmin>, profile: ProfileRow, groupId: string): Promise<void> {
  const group = await getGroup(admin, groupId);
  if (profile.role === "admin" || group.lecturer_id === profile.id || await isGroupMember(admin, groupId, profile.id)) {
    return;
  }
  throw new ApiError("forbidden", "Bạn không có quyền xem dự án này.");
}

async function notifyJoinApprovers(
  admin: ReturnType<typeof getSupabaseAdmin>,
  groupId: string,
  groupName: string,
  senderName: string,
): Promise<void> {
  const { data: group } = await admin
    .from("groups")
    .select("lecturer_id")
    .eq("id", groupId)
    .single();
  const { data: leaders } = await admin
    .from("group_members")
    .select("student_id")
    .eq("group_id", groupId)
    .eq("role", "Leader");

  const recipients = new Set<string>();
  if (group?.lecturer_id) recipients.add(group.lecturer_id);
  for (const leader of leaders ?? []) {
    if (leader.student_id) recipients.add(leader.student_id);
  }

  if (recipients.size === 0) return;

  const content = `Sinh viên ${senderName} đang yêu cầu tham gia dự án "${groupName}".`;
  const rows = [...recipients].map(recipient_id => ({
    recipient_id,
    sender_name: senderName,
    content,
    is_read: false,
  }));

  const { error } = await admin.from("notifications").insert(rows);
  if (error) console.warn("Failed to create join request notifications:", error.message);
}

async function handleCreateInvite(admin: ReturnType<typeof getSupabaseAdmin>, profile: ProfileRow, payload: Record<string, unknown>) {
  const groupId = uuidField(payload, "groupId");
  await assertCanManageGroup(admin, profile, groupId);

  const approvalMode = payload.approvalMode;
  if (approvalMode !== "auto" && approvalMode !== "requires_approval") {
    throw new ApiError("bad_request", "Chế độ phê duyệt không hợp lệ.");
  }

  const expiresAtValue = payload.expiresAt;
  const expiresAt = typeof expiresAtValue === "string" && expiresAtValue.trim()
    ? new Date(expiresAtValue)
    : null;
  if (expiresAt && Number.isNaN(expiresAt.getTime())) {
    throw new ApiError("bad_request", "Ngày hết hạn không hợp lệ.");
  }

  const maxUsesValue = payload.maxUses;
  const maxUses = maxUsesValue === null || maxUsesValue === undefined
    ? null
    : Number(maxUsesValue);
  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 500)) {
    throw new ApiError("bad_request", "Số lượt sử dụng không hợp lệ.");
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const { data, error } = await admin
      .from("project_invites")
      .insert({
        id: generateInviteCode(),
        group_id: groupId,
        created_by: profile.id,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        max_uses: maxUses,
        approval_mode: approvalMode,
      })
      .select()
      .single();

    if (!error && data) return data as InviteRow;
    if (error?.code !== "23505") throw error;
  }

  throw new ApiError("conflict", "Không thể tạo mã mời duy nhất. Vui lòng thử lại.");
}

async function handleListInvites(admin: ReturnType<typeof getSupabaseAdmin>, profile: ProfileRow, payload: Record<string, unknown>) {
  const groupId = uuidField(payload, "groupId");
  await assertCanManageGroup(admin, profile, groupId);

  const { data, error } = await admin
    .from("project_invites")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function handleRevokeInvite(admin: ReturnType<typeof getSupabaseAdmin>, profile: ProfileRow, payload: Record<string, unknown>) {
  const inviteId = normalizeInviteCode(payload.inviteId);
  const { data: invite, error } = await admin
    .from("project_invites")
    .select("id,group_id")
    .eq("id", inviteId)
    .single();

  if (error || !invite) throw new ApiError("not_found", "Không tìm thấy mã mời.");
  await assertCanManageGroup(admin, profile, invite.group_id);

  const { error: deleteError } = await admin.from("project_invites").delete().eq("id", inviteId);
  if (deleteError) throw deleteError;
  return { invite_id: inviteId };
}

async function handleJoinWithInvite(admin: ReturnType<typeof getSupabaseAdmin>, profile: ProfileRow, payload: Record<string, unknown>) {
  const inviteId = normalizeInviteCode(payload.inviteCode);
  const { data, error } = await admin.rpc("consume_project_invite", {
    p_invite_id: inviteId,
    p_user_id: profile.id,
  });

  if (error) throw error;
  const result = data as {
    group_id: string;
    group_name: string;
    approval_mode: ApprovalMode;
    status: JoinStatus;
    request_id?: string;
  };

  if (result.status === "pending_approval") {
    await notifyJoinApprovers(admin, result.group_id, result.group_name, profile.full_name || profile.email);
  }

  return result;
}

async function handleProcessJoinRequest(admin: ReturnType<typeof getSupabaseAdmin>, profile: ProfileRow, payload: Record<string, unknown>) {
  const requestId = uuidField(payload, "requestId");
  const status = payload.status;
  if (status !== "approved" && status !== "rejected") {
    throw new ApiError("bad_request", "Trạng thái yêu cầu không hợp lệ.");
  }

  const { data: request, error } = await admin
    .from("join_requests")
    .select("id,group_id,invite_id,user_id,status,created_at")
    .eq("id", requestId)
    .single();

  if (error || !request) throw new ApiError("not_found", "Không tìm thấy yêu cầu tham gia.");
  await assertCanManageGroup(admin, profile, (request as JoinRequestRow).group_id);

  if (status === "rejected") {
    const { error: updateError } = await admin
      .from("join_requests")
      .update({ status: "rejected" })
      .eq("id", requestId)
      .eq("status", "pending");
    if (updateError) throw updateError;
    return { request_id: requestId, status };
  }

  const { data, error: rpcError } = await admin.rpc("approve_project_join_request", {
    p_request_id: requestId,
  });
  if (rpcError) throw rpcError;
  return data;
}

async function handleSubmitStudentReport(admin: ReturnType<typeof getSupabaseAdmin>, profile: ProfileRow, payload: Record<string, unknown>) {
  const groupId = uuidField(payload, "groupId");
  const targetName = stringField(payload, "toName", 160);
  const reason = stringField(payload, "reason", 120);
  const notes = optionalStringField(payload, "notes", 2000);

  if (!await isGroupMember(admin, groupId, profile.id)) {
    throw new ApiError("forbidden", "Bạn không phải thành viên của dự án này.");
  }

  const { data: target, error: targetError } = await admin
    .from("group_members")
    .select("student_id, users:student_id(full_name)")
    .eq("group_id", groupId);

  if (targetError) throw targetError;
  const targetMember = (target ?? []).find((row: { users?: { full_name?: string } | { full_name?: string }[] }) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    return user?.full_name === targetName;
  });

  if (!targetMember) {
    throw new ApiError("bad_request", "Sinh viên được báo cáo không thuộc dự án này.");
  }

  const { error } = await admin.from("student_reports").insert({
    group_id: groupId,
    reporter_id: profile.id,
    from_name: profile.full_name || profile.email,
    to_name: targetName,
    reason,
    notes,
  });

  if (error) throw error;
  return { group_id: groupId };
}

async function handleSaveLecturerEvaluation(admin: ReturnType<typeof getSupabaseAdmin>, profile: ProfileRow, payload: Record<string, unknown>) {
  const groupId = uuidField(payload, "groupId");
  if (!await canReviewGroup(admin, profile, groupId)) {
    throw new ApiError("forbidden", "Bạn không có quyền đánh giá dự án này.");
  }

  const studentName = stringField(payload, "studentName", 160);
  const rating = Number(payload.rating);
  const comment = optionalStringField(payload, "comment", 2000);
  const awardBadge = Boolean(payload.awardBadge);

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new ApiError("bad_request", "Số sao đánh giá không hợp lệ.");
  }

  const { data: members, error: membersError } = await admin
    .from("group_members")
    .select("student_id, users:student_id(full_name)")
    .eq("group_id", groupId);
  if (membersError) throw membersError;

  const hasStudent = (members ?? []).some((row: { users?: { full_name?: string } | { full_name?: string }[] }) => {
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    return user?.full_name === studentName;
  });
  if (!hasStudent) throw new ApiError("bad_request", "Sinh viên không thuộc dự án này.");

  const { error } = await admin.from("lecturer_student_reviews").insert({
    group_id: groupId,
    lecturer_id: profile.id,
    student_name: studentName,
    rating,
    comment,
    award_badge: awardBadge,
  });
  if (error) throw error;

  if (awardBadge) {
    const { error: badgeError } = await admin.from("verified_badges").insert({
      group_id: groupId,
      lecturer_id: profile.id,
      student_name: studentName,
      rating,
      comment,
      link: "https://www.linkedin.com/",
    });
    if (badgeError) throw badgeError;
  }

  return { group_id: groupId };
}

async function handleApproveTask(admin: ReturnType<typeof getSupabaseAdmin>, profile: ProfileRow, payload: Record<string, unknown>) {
  const groupId = uuidField(payload, "groupId");
  const taskId = uuidField(payload, "taskId");
  await assertCanManageGroup(admin, profile, groupId);

  const { data: task, error: taskError } = await admin
    .from("tasks")
    .select("id,group_id,title")
    .eq("id", taskId)
    .eq("group_id", groupId)
    .single();

  if (taskError || !task) throw new ApiError("not_found", "Không tìm thấy task.");

  const { error } = await admin.from("tasks").update({ approved: true }).eq("id", taskId).eq("group_id", groupId);
  if (error) throw error;

  await admin.from("activity_logs").insert({
    group_id: groupId,
    description: `Task "${task.title}" đã được duyệt`,
  });

  return { task_id: taskId };
}

function calculateContributionScore(completedTasks: number, contributionPercent: number): number {
  const taskScore = Math.min(completedTasks * 20, 40);
  const contributionScore = Math.min(contributionPercent * 0.6, 60);
  return Math.round(taskScore + contributionScore);
}

async function handleCalculateContributionSnapshot(admin: ReturnType<typeof getSupabaseAdmin>, profile: ProfileRow, payload: Record<string, unknown>) {
  const groupId = uuidField(payload, "groupId");
  await assertCanReadGroup(admin, profile, groupId);

  const { data: members, error: membersError } = await admin
    .from("group_members")
    .select("student_id,role,users:student_id(full_name)")
    .eq("group_id", groupId);
  if (membersError) throw membersError;

  const { data: tasks, error: tasksError } = await admin
    .from("tasks")
    .select("id,group_id,title,assignee_id,approved,contribution_percent,weight,evidence")
    .eq("group_id", groupId);
  if (tasksError) throw tasksError;

  const approvedTasks = ((tasks ?? []) as TaskRow[]).filter(task => task.approved);
  const totalApprovedPercent = approvedTasks.reduce(
    (sum, task) => sum + (task.contribution_percent ?? task.weight * 10),
    0,
  );

  return ((members ?? []) as Array<{ student_id: string; role?: string; users?: { full_name?: string } | { full_name?: string }[] }>).map(member => {
    const user = Array.isArray(member.users) ? member.users[0] : member.users;
    const memberTasks = approvedTasks.filter(task => task.assignee_id === member.student_id);
    const memberPercent = memberTasks.reduce((sum, task) => sum + (task.contribution_percent ?? task.weight * 10), 0);
    const contributionPercent = totalApprovedPercent > 0 ? Math.round((memberPercent / totalApprovedPercent) * 100) : 0;

    return {
      id: member.student_id,
      name: user?.full_name ?? member.student_id,
      role: member.role ?? "Member",
      completedTasks: memberTasks.length,
      contributionPercent,
      contributionScore: calculateContributionScore(memberTasks.length, contributionPercent),
    };
  });
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return optionsResponse(req);

  if (req.method !== "POST") {
    return jsonError(req, new ApiError("not_found", "Không tìm thấy endpoint."));
  }

  if (!isAllowedOrigin(req)) {
    return jsonError(req, new ApiError("forbidden", "Origin không được phép."));
  }

  try {
    const rawBody = await req.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      throw new ApiError("bad_request", "Dữ liệu gửi lên không hợp lệ.");
    }
    const body = asRecord(rawBody);
    const action = stringField(body, "action", 80);
    if (!ACTIONS.has(action)) {
      throw new ApiError("not_found", "Không tìm thấy thao tác API.");
    }
    const rawPayload = body.payload ?? {};
    const schema = payloadSchemas[action];
    if (!schema) {
      throw new ApiError("bad_request", "Thao tác không được hỗ trợ.");
    }
    const parsedPayload = schema.safeParse(rawPayload);
    if (!parsedPayload.success) {
      throw new ApiError("bad_request", "Dữ liệu payload không đúng định dạng.");
    }
    const payload = parsedPayload.data;

    const user = await requireAuthUser(req);
    await enforceRateLimit(`${user.id}:${action}`);

    const admin = getSupabaseAdmin();
    const profile = await getProfile(admin, user.id);

    const data = await ({
      create_invite: () => handleCreateInvite(admin, profile, payload),
      list_invites: () => handleListInvites(admin, profile, payload),
      revoke_invite: () => handleRevokeInvite(admin, profile, payload),
      join_with_invite: () => handleJoinWithInvite(admin, profile, payload),
      process_join_request: () => handleProcessJoinRequest(admin, profile, payload),
      submit_student_report: () => handleSubmitStudentReport(admin, profile, payload),
      save_lecturer_evaluation: () => handleSaveLecturerEvaluation(admin, profile, payload),
      approve_task: () => handleApproveTask(admin, profile, payload),
      calculate_contribution_snapshot: () => handleCalculateContributionSnapshot(admin, profile, payload),
    } as Record<string, () => Promise<unknown>>)[action]();

    return jsonOk(req, data);
  } catch (error) {
    const apiError = toError(error);
    if (apiError.code === "internal_error") {
      console.error("team-api internal error:", error);
      return internalError(req);
    }
    return jsonError(req, apiError);
  }
});
