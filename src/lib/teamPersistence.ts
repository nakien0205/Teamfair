import { supabase } from "@/lib/supabaseClient";
import type {
  ActivityLogEntry,
  Group,
  LecturerStudentReview,
  MaterialFile,
  StudentReport,
  Task,
  VerifiedBadge,
} from "@/context/TeamContext";

type DbTaskStatus = "todo" | "in_progress" | "done";

type DbGroup = {
  id: string;
  project_name: string;
};

type DbMember = {
  group_id: string;
  student_id: string;
  users?: { id: string; full_name: string; role?: string } | { id: string; full_name: string; role?: string }[] | null;
};

type DbTask = {
  id: string;
  group_id: string;
  title: string;
  description: string | null;
  assignee_id: string | null;
  status: DbTaskStatus;
  weight: number;
  contribution_percent?: number | null;
  approved?: boolean | null;
  deadline?: string | null;
  priority?: Task["priority"] | null;
  evidence?: unknown;
};

type DbActivityLog = {
  id: string;
  group_id: string;
  description: string;
  created_at: string;
};

type DbStudentReport = {
  id: string;
  group_id: string;
  from_name: string;
  to_name: string;
  reason: string;
  notes: string | null;
  reviewed: boolean;
  created_at: string;
};

type DbMaterial = {
  id: string;
  group_id: string;
  file_name: string;
  file_size: number;
  uploaded_by_name: string;
  created_at: string;
};

type DbLecturerStudentReview = {
  id: string;
  group_id: string;
  student_name: string;
  rating: number;
  comment: string | null;
  award_badge: boolean;
  created_at: string;
};

type DbVerifiedBadge = {
  id: string;
  group_id: string;
  student_name: string;
  rating: number;
  comment: string | null;
  awarded_at: string;
  link: string;
};

type DbLecturerScore = {
  group_id: string;
  student_name: string;
  score: number;
};

export type TeamRows = {
  groups: DbGroup[];
  members: DbMember[];
  tasks: DbTask[];
  activityLogs: DbActivityLog[];
  reports: DbStudentReport[];
  materials: DbMaterial[];
  lecturerStudentReviews: DbLecturerStudentReview[];
  verifiedBadges: DbVerifiedBadge[];
  lecturerScores?: DbLecturerScore[];
};

export type PersistedTeamSnapshot = {
  groups: Group[];
  reports: StudentReport[];
  materialsByGroupId: Record<string, MaterialFile[]>;
  lecturerStudentReviews: LecturerStudentReview[];
  studentBadges: VerifiedBadge[];
};

export function taskStatusToDb(status: Task["status"]): DbTaskStatus {
  if (status === "In Progress") return "in_progress";
  if (status === "Done") return "done";
  return "todo";
}

export function taskStatusFromDb(status: DbTaskStatus): Task["status"] {
  if (status === "in_progress") return "In Progress";
  if (status === "done") return "Done";
  return "Todo";
}

function weightFromContributionPercent(percent: number): number {
  return Math.max(1, Math.min(10, Math.round(percent / 10)));
}

function normalizeEvidence(evidence: unknown): NonNullable<Task["evidence"]> {
  if (!Array.isArray(evidence)) return [];
  return evidence.flatMap(item => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { fileName?: unknown; uploadTime?: unknown };
    if (typeof candidate.fileName !== "string") return [];
    return [{
      fileName: candidate.fileName,
      uploadTime: new Date(typeof candidate.uploadTime === "string" ? candidate.uploadTime : Date.now()),
    }];
  });
}

function serializeEvidence(evidence: Task["evidence"] | undefined): Array<{ fileName: string; uploadTime: string }> {
  return (evidence ?? []).map(item => ({
    fileName: item.fileName,
    uploadTime: item.uploadTime.toISOString(),
  }));
}

function relationUser(member: DbMember): { id: string; full_name: string; role?: string } | null {
  if (Array.isArray(member.users)) return member.users[0] ?? null;
  return member.users ?? null;
}

function taskAssigneeName(task: DbTask, members: DbMember[]): string {
  const member = members.find(m => m.student_id === task.assignee_id);
  const user = member ? relationUser(member) : null;
  return user?.full_name ?? "Unassigned";
}

export function buildTaskInsert(groupId: string, task: Omit<Task, "id"> | Task) {
  return {
    group_id: groupId,
    title: task.name,
    description: task.description || null,
    assignee_id: task.assigneeId ?? null,
    status: taskStatusToDb(task.status),
    weight: weightFromContributionPercent(task.contributionPercent),
    contribution_percent: task.contributionPercent,
    approved: task.approved,
    deadline: task.deadline || null,
    priority: task.priority ?? null,
    evidence: serializeEvidence(task.evidence),
  };
}

export function buildTaskUpdate(updates: Partial<Task>, groupMembers: Group["members"]) {
  const payload: Record<string, unknown> = {};
  if (updates.name !== undefined) payload.title = updates.name;
  if (updates.description !== undefined) payload.description = updates.description || null;
  if (updates.assignedTo !== undefined) {
    payload.assignee_id = groupMembers.find(m => m.name === updates.assignedTo)?.id ?? null;
  }
  if (updates.status !== undefined) payload.status = taskStatusToDb(updates.status);
  if (updates.contributionPercent !== undefined) {
    payload.contribution_percent = updates.contributionPercent;
    payload.weight = weightFromContributionPercent(updates.contributionPercent);
  }
  if (updates.approved !== undefined) payload.approved = updates.approved;
  if (updates.deadline !== undefined) payload.deadline = updates.deadline || null;
  if (updates.priority !== undefined) payload.priority = updates.priority ?? null;
  if (updates.evidence !== undefined) payload.evidence = serializeEvidence(updates.evidence);
  return payload;
}

export function mapTeamRowsToSnapshot(rows: TeamRows): PersistedTeamSnapshot {
  const scoresByGroupAndStudent = new Map(
    (rows.lecturerScores ?? []).map(score => [`${score.group_id}:${score.student_name}`, score.score]),
  );

  const groups = rows.groups.map(groupRow => {
    const groupMembers = rows.members.filter(m => m.group_id === groupRow.id);
    const groupTasks = rows.tasks.filter(t => t.group_id === groupRow.id);
    const approvedTasks = groupTasks.filter(t => Boolean(t.approved));
    const totalApprovedPercent = approvedTasks.reduce(
      (sum, task) => sum + (task.contribution_percent ?? task.weight * 10),
      0,
    );

    const members = groupMembers.map(member => {
      const user = relationUser(member);
      const name = user?.full_name || member.student_id;
      const memberApprovedTasks = approvedTasks.filter(t => t.assignee_id === member.student_id);
      const memberApprovedPercent = memberApprovedTasks.reduce(
        (sum, task) => sum + (task.contribution_percent ?? task.weight * 10),
        0,
      );

      return {
        id: member.student_id,
        name,
        role: "Member",
        completedTasks: memberApprovedTasks.length,
        contributionPercent: totalApprovedPercent > 0
          ? Math.round((memberApprovedPercent / totalApprovedPercent) * 100)
          : 0,
        lecturerScore: scoresByGroupAndStudent.get(`${groupRow.id}:${name}`) ?? null,
      };
    });

    const tasks = groupTasks.map(task => ({
      id: task.id,
      name: task.title,
      assignedTo: taskAssigneeName(task, groupMembers),
      assigneeId: task.assignee_id ?? undefined,
      status: taskStatusFromDb(task.status),
      contributionPercent: task.contribution_percent ?? task.weight * 10,
      approved: Boolean(task.approved),
      deadline: task.deadline ?? "",
      description: task.description ?? undefined,
      priority: task.priority ?? undefined,
      evidence: normalizeEvidence(task.evidence),
    }));

    const activityLog = rows.activityLogs
      .filter(log => log.group_id === groupRow.id)
      .map<ActivityLogEntry>(log => ({
        timestamp: new Date(log.created_at),
        description: log.description,
      }));

    return {
      id: groupRow.id,
      name: groupRow.project_name,
      members,
      tasks,
      activityLog,
    };
  });

  const reports = rows.reports.map<StudentReport>(report => ({
    id: report.id,
    from: report.from_name,
    to: report.to_name,
    reason: report.reason,
    notes: report.notes ?? "",
    timestamp: new Date(report.created_at),
    reviewed: report.reviewed,
  }));

  const materialsByGroupId = rows.materials.reduce<Record<string, MaterialFile[]>>((acc, material) => ({
    ...acc,
    [material.group_id]: [
      ...(acc[material.group_id] ?? []),
      {
        id: material.id,
        fileName: material.file_name,
        size: material.file_size,
        uploadedBy: material.uploaded_by_name,
        uploadTime: new Date(material.created_at),
      },
    ],
  }), {});

  const lecturerStudentReviews = rows.lecturerStudentReviews.map<LecturerStudentReview>(review => ({
    id: review.id,
    lecturer: "lecturer",
    studentName: review.student_name,
    rating: review.rating,
    comment: review.comment ?? "",
    awardBadge: review.award_badge,
    timestamp: new Date(review.created_at),
  }));

  const studentBadges = rows.verifiedBadges.map<VerifiedBadge>(badge => ({
    id: badge.id,
    studentName: badge.student_name,
    rating: badge.rating,
    comment: badge.comment ?? "",
    awardedAt: new Date(badge.awarded_at),
    link: badge.link,
  }));

  return { groups, reports, materialsByGroupId, lecturerStudentReviews, studentBadges };
}

async function selectOrThrow<T>(query: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? ([] as T);
}

export async function loadPersistedTeamSnapshot(): Promise<PersistedTeamSnapshot> {
  const groups = await selectOrThrow<DbGroup[]>(
    supabase.from("groups").select("id,project_name").order("created_at", { ascending: true }),
  );
  const members = await selectOrThrow<DbMember[]>(
    supabase.from("group_members").select("group_id,student_id,users:student_id(id,full_name,role)"),
  );
  const tasks = await selectOrThrow<DbTask[]>(
    supabase
      .from("tasks")
      .select("id,group_id,title,description,assignee_id,status,weight,contribution_percent,approved,deadline,priority,evidence"),
  );
  const activityLogs = await selectOrThrow<DbActivityLog[]>(
    supabase.from("activity_logs").select("id,group_id,description,created_at").order("created_at", { ascending: false }),
  );
  const reports = await selectOrThrow<DbStudentReport[]>(
    supabase
      .from("student_reports")
      .select("id,group_id,from_name,to_name,reason,notes,reviewed,created_at")
      .order("created_at", { ascending: false }),
  );
  const materials = await selectOrThrow<DbMaterial[]>(
    supabase
      .from("materials")
      .select("id,group_id,file_name,file_size,uploaded_by_name,created_at")
      .order("created_at", { ascending: false }),
  );
  const lecturerStudentReviews = await selectOrThrow<DbLecturerStudentReview[]>(
    supabase
      .from("lecturer_student_reviews")
      .select("id,group_id,student_name,rating,comment,award_badge,created_at")
      .order("created_at", { ascending: false }),
  );
  const verifiedBadges = await selectOrThrow<DbVerifiedBadge[]>(
    supabase
      .from("verified_badges")
      .select("id,group_id,student_name,rating,comment,awarded_at,link")
      .order("awarded_at", { ascending: false }),
  );
  const lecturerScores = await selectOrThrow<DbLecturerScore[]>(
    supabase.from("lecturer_scores").select("group_id,student_name,score"),
  );

  return mapTeamRowsToSnapshot({
    groups,
    members,
    tasks,
    activityLogs,
    reports,
    materials,
    lecturerStudentReviews,
    verifiedBadges,
    lecturerScores,
  });
}

export async function insertActivityLog(groupId: string, description: string): Promise<void> {
  const { error } = await supabase.from("activity_logs").insert({ group_id: groupId, description });
  if (error) throw new Error(error.message);
}

export async function insertTask(group: Group, task: Omit<Task, "id" | "status" | "approved">): Promise<void> {
  const fullTask = {
    ...task,
    assigneeId: group.members.find(m => m.name === task.assignedTo)?.id,
    status: "Todo" as const,
    approved: false,
  };
  const { error } = await supabase.from("tasks").insert(buildTaskInsert(group.id, fullTask));
  if (error) throw new Error(error.message);
  await insertActivityLog(group.id, `Task "${task.name}" được tạo và giao cho ${task.assignedTo}`);
}

export async function deletePersistedTask(groupId: string, task: Task | undefined): Promise<void> {
  if (!task) return;
  const { error } = await supabase.from("tasks").delete().eq("id", task.id);
  if (error) throw new Error(error.message);
  await insertActivityLog(groupId, `Task "${task.name}" đã bị xóa`);
}

export async function updatePersistedTaskStatus(
  groupId: string,
  task: Task | undefined,
  status: Task["status"],
  actor: string,
): Promise<void> {
  if (!task) return;
  const { error } = await supabase.from("tasks").update({ status: taskStatusToDb(status) }).eq("id", task.id);
  if (error) throw new Error(error.message);
  const statusLabel = status === "In Progress" ? "bắt đầu" : "hoàn thành";
  await insertActivityLog(groupId, `${actor} đã ${statusLabel} task "${task.name}"`);
}

export async function approvePersistedTask(groupId: string, task: Task | undefined): Promise<void> {
  if (!task) return;
  const { error } = await supabase.from("tasks").update({ approved: true }).eq("id", task.id);
  if (error) throw new Error(error.message);
  await insertActivityLog(groupId, `Task "${task.name}" đã được duyệt`);
}

export async function updatePersistedTask(taskId: string, updates: Partial<Task>, groupMembers: Group["members"]): Promise<void> {
  const payload = buildTaskUpdate(updates, groupMembers);
  if (Object.keys(payload).length === 0) return;
  const { error } = await supabase.from("tasks").update(payload).eq("id", taskId);
  if (error) throw new Error(error.message);
}

export async function upsertLecturerScore(groupId: string, studentName: string, score: number): Promise<void> {
  const { error } = await supabase
    .from("lecturer_scores")
    .upsert({ group_id: groupId, student_name: studentName, score }, { onConflict: "group_id,student_name" });
  if (error) throw new Error(error.message);
}

export async function insertStudentReport(groupId: string, report: Omit<StudentReport, "id" | "timestamp" | "reviewed">): Promise<void> {
  const { error } = await supabase.from("student_reports").insert({
    group_id: groupId,
    from_name: report.from,
    to_name: report.to,
    reason: report.reason,
    notes: report.notes || null,
  });
  if (error) throw new Error(error.message);
}

export async function markStudentReportReviewed(id: string): Promise<void> {
  const { error } = await supabase.from("student_reports").update({ reviewed: true }).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertMaterial(groupId: string, file: Omit<MaterialFile, "id" | "uploadTime">): Promise<void> {
  const { error } = await supabase.from("materials").insert({
    group_id: groupId,
    file_name: file.fileName,
    file_size: file.size,
    uploaded_by_name: file.uploadedBy,
  });
  if (error) throw new Error(error.message);
}

export async function deletePersistedMaterial(id: string): Promise<void> {
  const { error } = await supabase.from("materials").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function insertLecturerStudentEvaluation(
  groupId: string,
  input: Omit<LecturerStudentReview, "id" | "timestamp" | "lecturer">,
): Promise<void> {
  const { error } = await supabase.from("lecturer_student_reviews").insert({
    group_id: groupId,
    student_name: input.studentName,
    rating: input.rating,
    comment: input.comment || null,
    award_badge: input.awardBadge,
  });
  if (error) throw new Error(error.message);

  if (!input.awardBadge) return;
  const { error: badgeError } = await supabase.from("verified_badges").insert({
    group_id: groupId,
    student_name: input.studentName,
    rating: input.rating,
    comment: input.comment || null,
    link: "https://www.linkedin.com/",
  });
  if (badgeError) throw new Error(badgeError.message);
}
