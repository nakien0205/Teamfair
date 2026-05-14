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
  evidence?: { fileName: string; uploadTime: string }[];
};

type SerializedActivityLogEntry = {
  timestamp: string;
  description: string;
};

type SerializedStudentReport = {
  id: string;
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
