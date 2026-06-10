import type {
  ActivityLogEntry,
  Group,
  LecturerStudentReview,
  MaterialFile,
  StudentReport,
  Task,
  VerifiedBadge,
} from "@/context/TeamContext";

/** JSON body for `POST /chat` — matches Python `WorkspaceSnapshot`. */
export type WorkspaceSnapshotJson = {
  current_group_index: number;
  groups: SerializedGroup[];
  reports: SerializedStudentReport[];
  materials: SerializedMaterialFile[];
  lecturer_student_reviews: SerializedLecturerReview[];
  student_badges: SerializedVerifiedBadge[];
  calendar_events: unknown[];
};

type SerializedGroup = {
  id: string;
  name: string;
  members: Group["members"];
  tasks: SerializedTask[];
  activityLog: SerializedActivityLogEntry[];
};

type SerializedTask = Omit<Task, "evidence"> & {
  evidence?: {
    fileName: string;
    uploadTime: string;
    storagePath?: string;
    storageBucket?: "evidence";
    size?: number;
    uploadedById?: string;
  }[];
};

type SerializedActivityLogEntry = {
  timestamp: string;
  description: string;
};

type SerializedStudentReport = {
  id: string;
  groupId?: string;
  from: string;
  to: string;
  reason: string;
  notes: string;
  timestamp: string;
  reviewed: boolean;
};

type SerializedMaterialFile = {
  id: string;
  fileName: string;
  size: number;
  uploadedBy: string;
  uploadTime: string;
  storagePath?: string;
  storageBucket?: "materials";
  uploadedById?: string;
};

type SerializedLecturerReview = {
  id: string;
  lecturer: string;
  studentName: string;
  rating: number;
  comment: string;
  awardBadge: boolean;
  timestamp: string;
};

type SerializedVerifiedBadge = {
  id: string;
  studentName: string;
  rating: number;
  comment: string;
  awardedAt: string;
  link: string;
};

function serializeTask(t: Task): SerializedTask {
  const { evidence, ...rest } = t;
  const out: SerializedTask = { ...rest };
  if (evidence?.length) {
    out.evidence = evidence.map(e => ({
      fileName: e.fileName,
      uploadTime: e.uploadTime instanceof Date ? e.uploadTime.toISOString() : String(e.uploadTime),
      storagePath: e.storagePath,
      storageBucket: e.storageBucket,
      size: e.size,
      uploadedById: e.uploadedById,
    }));
  }
  return out;
}

function serializeGroup(g: Group): SerializedGroup {
  return {
    id: g.id,
    name: g.name,
    members: g.members,
    tasks: g.tasks.map(serializeTask),
    activityLog: g.activityLog.map((e: ActivityLogEntry) => ({
      timestamp: e.timestamp instanceof Date ? e.timestamp.toISOString() : String(e.timestamp),
      description: e.description,
    })),
  };
}

function serializeReport(r: StudentReport): SerializedStudentReport {
  return {
    id: r.id,
    groupId: r.groupId,
    from: r.from,
    to: r.to,
    reason: r.reason,
    notes: r.notes,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
    reviewed: r.reviewed,
  };
}

function serializeMaterial(m: MaterialFile): SerializedMaterialFile {
  return {
    id: m.id,
    fileName: m.fileName,
    size: m.size,
    uploadedBy: m.uploadedBy,
    uploadTime: m.uploadTime instanceof Date ? m.uploadTime.toISOString() : String(m.uploadTime),
    storagePath: m.storagePath,
    storageBucket: m.storageBucket,
    uploadedById: m.uploadedById,
  };
}

function serializeReview(r: LecturerStudentReview): SerializedLecturerReview {
  return {
    id: r.id,
    lecturer: r.lecturer,
    studentName: r.studentName,
    rating: r.rating,
    comment: r.comment,
    awardBadge: r.awardBadge,
    timestamp: r.timestamp instanceof Date ? r.timestamp.toISOString() : String(r.timestamp),
  };
}

function serializeBadge(b: VerifiedBadge): SerializedVerifiedBadge {
  return {
    id: b.id,
    studentName: b.studentName,
    rating: b.rating,
    comment: b.comment,
    awardedAt: b.awardedAt instanceof Date ? b.awardedAt.toISOString() : String(b.awardedAt),
    link: b.link,
  };
}

export function buildWorkspaceSnapshotFromTeam(input: {
  groups: Group[];
  currentGroupIndex: number;
  reports: StudentReport[];
  materials: MaterialFile[];
  lecturerStudentReviews: LecturerStudentReview[];
  studentBadges: VerifiedBadge[];
}): WorkspaceSnapshotJson {
  return {
    current_group_index: input.currentGroupIndex,
    groups: input.groups.map(serializeGroup),
    reports: input.reports.map(serializeReport),
    materials: input.materials.map(serializeMaterial),
    lecturer_student_reviews: input.lecturerStudentReviews.map(serializeReview),
    student_badges: input.studentBadges.map(serializeBadge),
    calendar_events: [],
  };
}

/* ---------- Deserialization (agent snapshot → TeamContext state) ---------- */

function toDate(v: unknown): Date {
  if (v instanceof Date) return v;
  if (typeof v === "string" && v) return new Date(v);
  return new Date();
}

function deserializeTask(s: SerializedTask): Task {
  return {
    ...s,
    evidence: s.evidence?.map(e => ({
      fileName: e.fileName,
      uploadTime: toDate(e.uploadTime),
      storagePath: e.storagePath,
      storageBucket: e.storageBucket,
      size: e.size,
      uploadedById: e.uploadedById,
    })),
  };
}

function deserializeGroup(s: SerializedGroup): Group {
  return {
    id: s.id,
    name: s.name,
    members: s.members,
    tasks: s.tasks.map(deserializeTask),
    activityLog: s.activityLog.map(e => ({ timestamp: toDate(e.timestamp), description: e.description })),
  };
}

function deserializeReport(s: SerializedStudentReport): StudentReport {
  return { ...s, timestamp: toDate(s.timestamp) };
}

function deserializeMaterial(s: SerializedMaterialFile): MaterialFile {
  return { ...s, uploadTime: toDate(s.uploadTime) };
}

function deserializeReview(s: SerializedLecturerReview): LecturerStudentReview {
  return { ...s, lecturer: s.lecturer as "lecturer", timestamp: toDate(s.timestamp) };
}

function deserializeBadge(s: SerializedVerifiedBadge): VerifiedBadge {
  return { ...s, awardedAt: toDate(s.awardedAt) };
}

export interface DeserializedTeamState {
  groups: Group[];
  reports: StudentReport[];
  materials: MaterialFile[];
  lecturerStudentReviews: LecturerStudentReview[];
  studentBadges: VerifiedBadge[];
}

export function deserializeSnapshotToTeamState(snap: WorkspaceSnapshotJson): DeserializedTeamState {
  return {
    groups: snap.groups.map(deserializeGroup),
    reports: snap.reports.map(deserializeReport),
    materials: snap.materials.map(deserializeMaterial),
    lecturerStudentReviews: snap.lecturer_student_reviews.map(deserializeReview),
    studentBadges: snap.student_badges.map(deserializeBadge),
  };
}
