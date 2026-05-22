import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { isDemoSession } from '@/lib/demoSession';
import { isSupabaseConfigured } from '@/lib/supabaseClient';
import {
  approvePersistedTask,
  deletePersistedMaterial,
  deletePersistedTask,
  insertLecturerStudentEvaluation,
  insertMaterial,
  insertStudentReport,
  insertTask,
  loadPersistedTeamSnapshot,
  markStudentReportReviewed,
  updatePersistedTask,
  updatePersistedTaskStatus,
  upsertLecturerScore,
  writeBackAgentSnapshot,
} from '@/lib/teamPersistence';
import type { WorkspaceSnapshotJson } from '@/lib/workspaceSnapshot';
import { deserializeSnapshotToTeamState } from '@/lib/workspaceSnapshot';

export interface Task {
  id: string;
  name: string;
  assignedTo: string;
  assigneeId?: string;
  status: 'Todo' | 'In Progress' | 'Done';
  contributionPercent: number;
  approved: boolean;
  deadline: string;
  description?: string;
  priority?: 'Low' | 'Medium' | 'High';
  evidence?: { fileName: string; uploadTime: Date }[];
}

export interface MemberStat {
  id?: string;
  name: string;
  role: string;
  completedTasks: number;
  contributionPercent: number;
  lecturerScore: number | null;
}

export interface ActivityLogEntry {
  timestamp: Date;
  description: string;
}

export interface StudentReport {
  id: string;
  from: string;
  to: string;
  reason: string;
  notes: string;
  timestamp: Date;
  reviewed: boolean;
}

export interface MaterialFile {
  id: string;
  fileName: string;
  size: number;
  uploadedBy: string;
  uploadTime: Date;
}

export type BadgeAwarder = "lecturer";

export interface LecturerStudentReview {
  id: string;
  lecturer: BadgeAwarder;
  studentName: string;
  rating: number;
  comment: string;
  awardBadge: boolean;
  timestamp: Date;
}

export interface VerifiedBadge {
  id: string;
  studentName: string;
  rating: number;
  comment: string;
  awardedAt: Date;
  link: string;
}

export interface Group {
  id: string;
  name: string;
  members: MemberStat[];
  tasks: Task[];
  activityLog: ActivityLogEntry[];
}

interface TeamContextType {
  groups: Group[];
  currentGroupIndex: number;
  setCurrentGroupIndex: (i: number) => void;
  tasks: Task[];
  members: MemberStat[];
  activityLog: ActivityLogEntry[];
  addTask: (task: Omit<Task, 'id' | 'status' | 'approved'>) => void;
  deleteTask: (id: string) => void;
  updateTaskStatus: (id: string, status: Task['status'], actor: string) => void;
  approveTask: (id: string) => void;
  addLog: (description: string) => void;
  updateLecturerScore: (memberName: string, score: number, groupIdx: number) => void;
  studentRole: 'Leader' | 'Member';
  setStudentRole: (r: 'Leader' | 'Member') => void;
  reports: StudentReport[];
  addReport: (report: Omit<StudentReport, 'id' | 'timestamp' | 'reviewed'>) => void;
  markReportReviewed: (id: string) => void;
  materials: MaterialFile[];
  addMaterial: (file: Omit<MaterialFile, 'id' | 'uploadTime'>) => void;
  deleteMaterial: (id: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  lecturerStudentReviews: LecturerStudentReview[];
  studentBadges: VerifiedBadge[];
  addLecturerStudentEvaluation: (input: Omit<LecturerStudentReview, "id" | "timestamp" | "lecturer">) => void;
  applyAgentSnapshot: (snapshot: WorkspaceSnapshotJson) => void;
}

const initialMembers: MemberStat[] = [
  { name: 'Nguyễn Văn A', role: 'Leader', completedTasks: 0, contributionPercent: 0, lecturerScore: null },
  { name: 'Trần Thị B', role: 'Member', completedTasks: 0, contributionPercent: 0, lecturerScore: null },
  { name: 'Lê Văn C', role: 'Member', completedTasks: 0, contributionPercent: 0, lecturerScore: null },
  { name: 'Phạm Thị D', role: 'Member', completedTasks: 0, contributionPercent: 0, lecturerScore: null },
];

const initialTasks: Task[] = [
  { id: '1', name: 'Thiết kế giao diện', assignedTo: 'Trần Thị B', status: 'Todo', contributionPercent: 25, approved: false, deadline: '2026-03-15' },
  { id: '2', name: 'Viết báo cáo', assignedTo: 'Lê Văn C', status: 'Todo', contributionPercent: 20, approved: false, deadline: '2026-03-20' },
  { id: '3', name: 'Nghiên cứu tài liệu', assignedTo: 'Phạm Thị D', status: 'In Progress', contributionPercent: 15, approved: false, deadline: '2026-03-10' },
];

const initialLog: ActivityLogEntry[] = [
  { timestamp: new Date(Date.now() - 86400000), description: 'Nhóm được tạo' },
  { timestamp: new Date(Date.now() - 3600000), description: 'Task "Thiết kế giao diện" được giao cho Trần Thị B' },
];

const initialMaterials: MaterialFile[] = [
  { id: 'demo-1', fileName: 'ProjectGuidelines.pdf', size: 245760, uploadedBy: 'Lecturer', uploadTime: new Date(Date.now() - 86400000) },
  { id: 'demo-2', fileName: 'TeamworkRubric.docx', size: 102400, uploadedBy: 'Lecturer', uploadTime: new Date(Date.now() - 43200000) },
];

const makeGroups = (): Group[] => [
  {
    id: 'g1', name: 'Nhóm 1 - Dự án Web',
    members: structuredClone(initialMembers),
    tasks: structuredClone(initialTasks),
    activityLog: structuredClone(initialLog),
  },
  {
    id: 'g2', name: 'Nhóm 2 - Dự án Mobile',
    members: [
      { name: 'Hoàng Văn E', role: 'Leader', completedTasks: 1, contributionPercent: 30, lecturerScore: null },
      { name: 'Đỗ Thị F', role: 'Member', completedTasks: 2, contributionPercent: 40, lecturerScore: null },
      { name: 'Vũ Văn G', role: 'Member', completedTasks: 0, contributionPercent: 10, lecturerScore: null },
    ],
    tasks: [
      { id: 'g2-1', name: 'Thiết kế UI Mobile', assignedTo: 'Đỗ Thị F', status: 'Done', contributionPercent: 30, approved: true, deadline: '2026-03-12' },
      { id: 'g2-2', name: 'Backend API', assignedTo: 'Hoàng Văn E', status: 'In Progress', contributionPercent: 30, approved: false, deadline: '2026-03-18' },
    ],
    activityLog: [
      { timestamp: new Date(Date.now() - 172800000), description: 'Nhóm được tạo' },
      { timestamp: new Date(Date.now() - 7200000), description: 'Đỗ Thị F hoàn thành "Thiết kế UI Mobile"' },
    ],
  },
  {
    id: 'g3', name: 'Nhóm 3 - Dự án AI',
    members: [
      { name: 'Ngô Văn H', role: 'Leader', completedTasks: 0, contributionPercent: 0, lecturerScore: null },
      { name: 'Bùi Thị I', role: 'Member', completedTasks: 0, contributionPercent: 0, lecturerScore: null },
    ],
    tasks: [],
    activityLog: [
      { timestamp: new Date(Date.now() - 3600000), description: 'Nhóm được tạo' },
    ],
  },
];

const TeamContext = createContext<TeamContextType | null>(null);

export const useTeam = () => {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be inside TeamProvider');
  return ctx;
};

export const TeamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [groups, setGroups] = useState<Group[]>(makeGroups);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [studentRole, setStudentRole] = useState<'Leader' | 'Member'>('Leader');
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [materialsByGroupId, setMaterialsByGroupId] = useState<Record<string, MaterialFile[]>>({ g1: initialMaterials });
  const [lecturerStudentReviews, setLecturerStudentReviews] = useState<LecturerStudentReview[]>([]);
  const [studentBadges, setStudentBadges] = useState<VerifiedBadge[]>([]);
  const [dataSource, setDataSource] = useState<'demo' | 'supabase'>('demo');

  const group = groups[currentGroupIndex] || groups[0];
  const tasks = group.tasks;
  const members = group.members;
  const activityLog = group.activityLog;
  const materials = useMemo(() => materialsByGroupId[group.id] ?? [], [group.id, materialsByGroupId]);

  const resetDemoState = useCallback(() => {
    setGroups(makeGroups());
    setReports([]);
    setMaterialsByGroupId({ g1: initialMaterials });
    setLecturerStudentReviews([]);
    setStudentBadges([]);
    setCurrentGroupIndex(0);
    setDataSource('demo');
  }, []);

  const loadPersistedState = useCallback(async () => {
    const snapshot = await loadPersistedTeamSnapshot();
    if (snapshot.groups.length === 0) {
      resetDemoState();
      return;
    }
    setGroups(snapshot.groups);
    setReports(snapshot.reports);
    setMaterialsByGroupId(snapshot.materialsByGroupId);
    setLecturerStudentReviews(snapshot.lecturerStudentReviews);
    setStudentBadges(snapshot.studentBadges);
    setCurrentGroupIndex(0);
    setDataSource('supabase');
  }, [resetDemoState]);

  useEffect(() => {
    if (!isSupabaseConfigured || isDemoSession()) {
      resetDemoState();
      return;
    }

    if (authLoading) return;

    if (!user?.id) {
      resetDemoState();
      return;
    }

    let cancelled = false;
    loadPersistedTeamSnapshot()
      .then(snapshot => {
        if (cancelled) return;
        if (snapshot.groups.length === 0) {
          resetDemoState();
          return;
        }
        setGroups(snapshot.groups);
        setReports(snapshot.reports);
        setMaterialsByGroupId(snapshot.materialsByGroupId);
        setLecturerStudentReviews(snapshot.lecturerStudentReviews);
        setStudentBadges(snapshot.studentBadges);
        setCurrentGroupIndex(0);
        setDataSource('supabase');
      })
      .catch(error => {
        console.warn('Falling back to demo team data after Supabase load failed:', error);
        if (!cancelled) resetDemoState();
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, resetDemoState, user?.id]);

  const canPersist = dataSource === 'supabase' && isSupabaseConfigured && Boolean(user?.id) && !isDemoSession();

  const persist = useCallback((operation: () => Promise<void>) => {
    if (!canPersist) return;
    void operation()
      .then(loadPersistedState)
      .catch(error => {
        console.warn('Supabase team data persistence failed:', error);
      });
  }, [canPersist, loadPersistedState]);

  const updateGroup = useCallback((idx: number, updater: (g: Group) => Group) => {
    setGroups(prev => prev.map((g, i) => i === idx ? updater({ ...g }) : g));
  }, []);

  const addLog = useCallback((description: string) => {
    updateGroup(currentGroupIndex, g => ({
      ...g,
      activityLog: [{ timestamp: new Date(), description }, ...g.activityLog],
    }));
  }, [currentGroupIndex, updateGroup]);

  const recalcContributions = (g: Group): Group => {
    const approved = g.tasks.filter(t => t.approved);
    const totalPercent = approved.reduce((s, t) => s + t.contributionPercent, 0);
    const newMembers = g.members.map(m => {
      const memberApproved = approved.filter(t => t.assignedTo === m.name);
      const memberPercent = memberApproved.reduce((s, t) => s + t.contributionPercent, 0);
      return {
        ...m,
        completedTasks: memberApproved.length,
        contributionPercent: totalPercent > 0 ? Math.round((memberPercent / totalPercent) * 100) : 0,
      };
    });
    return { ...g, members: newMembers };
  };

  const addTask = useCallback((task: Omit<Task, 'id' | 'status' | 'approved'>) => {
    const id = Date.now().toString();
    const currentGroup = groups[currentGroupIndex];
    updateGroup(currentGroupIndex, g => ({
      ...g,
      tasks: [...g.tasks, { ...task, id, status: 'Todo', approved: false }],
      activityLog: [{ timestamp: new Date(), description: `Task "${task.name}" được tạo và giao cho ${task.assignedTo}` }, ...g.activityLog],
    }));
    if (currentGroup) persist(() => insertTask(currentGroup, task));
  }, [currentGroupIndex, groups, persist, updateGroup]);

  const deleteTask = useCallback((id: string) => {
    const currentGroup = groups[currentGroupIndex];
    const persistedTask = currentGroup?.tasks.find(t => t.id === id);
    updateGroup(currentGroupIndex, g => {
      const task = g.tasks.find(t => t.id === id);
      const newG = {
        ...g,
        tasks: g.tasks.filter(t => t.id !== id),
        activityLog: [{ timestamp: new Date(), description: `Task "${task?.name}" đã bị xóa` }, ...g.activityLog],
      };
      return recalcContributions(newG);
    });
    if (currentGroup) persist(() => deletePersistedTask(currentGroup.id, persistedTask));
  }, [currentGroupIndex, groups, persist, updateGroup]);

  const updateTaskStatus = useCallback((id: string, status: Task['status'], actor: string) => {
    const currentGroup = groups[currentGroupIndex];
    const persistedTask = currentGroup?.tasks.find(t => t.id === id);
    updateGroup(currentGroupIndex, g => {
      const task = g.tasks.find(t => t.id === id);
      const statusLabel = status === 'In Progress' ? 'bắt đầu' : 'hoàn thành';
      return {
        ...g,
        tasks: g.tasks.map(t => t.id === id ? { ...t, status } : t),
        activityLog: [{ timestamp: new Date(), description: `${actor} đã ${statusLabel} task "${task?.name}"` }, ...g.activityLog],
      };
    });
    if (currentGroup) persist(() => updatePersistedTaskStatus(currentGroup.id, persistedTask, status, actor));
  }, [currentGroupIndex, groups, persist, updateGroup]);

  const approveTask = useCallback((id: string) => {
    const currentGroup = groups[currentGroupIndex];
    const persistedTask = currentGroup?.tasks.find(t => t.id === id);
    updateGroup(currentGroupIndex, g => {
      const task = g.tasks.find(t => t.id === id);
      const newG = {
        ...g,
        tasks: g.tasks.map(t => t.id === id ? { ...t, approved: true } : t),
        activityLog: [{ timestamp: new Date(), description: `Task "${task?.name}" đã được duyệt` }, ...g.activityLog],
      };
      return recalcContributions(newG);
    });
    if (currentGroup) persist(() => approvePersistedTask(currentGroup.id, persistedTask));
  }, [currentGroupIndex, groups, persist, updateGroup]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    const currentGroup = groups[currentGroupIndex];
    updateGroup(currentGroupIndex, g => ({
      ...g,
      tasks: g.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
    }));
    if (currentGroup) persist(() => updatePersistedTask(id, updates, currentGroup.members));
  }, [currentGroupIndex, groups, persist, updateGroup]);

  const updateLecturerScore = useCallback((memberName: string, score: number, groupIdx: number) => {
    const targetGroup = groups[groupIdx];
    updateGroup(groupIdx, g => ({
      ...g,
      members: g.members.map(m => m.name === memberName ? { ...m, lecturerScore: score } : m),
    }));
    if (targetGroup) persist(() => upsertLecturerScore(targetGroup.id, memberName, score));
  }, [groups, persist, updateGroup]);

  const addReport = useCallback((report: Omit<StudentReport, 'id' | 'timestamp' | 'reviewed'>) => {
    const currentGroup = groups[currentGroupIndex];
    setReports(prev => [...prev, { ...report, id: Date.now().toString(), timestamp: new Date(), reviewed: false }]);
    if (currentGroup) persist(() => insertStudentReport(currentGroup.id, report));
  }, [currentGroupIndex, groups, persist]);

  const markReportReviewed = useCallback((id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, reviewed: true } : r));
    persist(() => markStudentReportReviewed(id));
  }, [persist]);

  const addMaterial = useCallback((file: Omit<MaterialFile, 'id' | 'uploadTime'>) => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup) return;
    setMaterialsByGroupId(prev => ({
      ...prev,
      [currentGroup.id]: [...(prev[currentGroup.id] ?? []), { ...file, id: Date.now().toString(), uploadTime: new Date() }],
    }));
    persist(() => insertMaterial(currentGroup.id, file));
  }, [currentGroupIndex, groups, persist]);

  const deleteMaterial = useCallback((id: string) => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup) return;
    setMaterialsByGroupId(prev => ({
      ...prev,
      [currentGroup.id]: (prev[currentGroup.id] ?? []).filter(m => m.id !== id),
    }));
    persist(() => deletePersistedMaterial(id));
  }, [currentGroupIndex, groups, persist]);

  const addLecturerStudentEvaluation = useCallback(
    (input: Omit<LecturerStudentReview, "id" | "timestamp" | "lecturer">) => {
      const currentGroup = groups[currentGroupIndex];
      const timestamp = new Date();
      setLecturerStudentReviews(prev => [
        ...prev,
        {
          id: Date.now().toString(),
          lecturer: "lecturer",
          timestamp,
          ...input,
        },
      ]);

      if (input.awardBadge) {
        setStudentBadges(prev => [
          ...prev,
          {
            id: Date.now().toString(),
            studentName: input.studentName,
            rating: input.rating,
            comment: input.comment,
            awardedAt: timestamp,
            link: "https://www.linkedin.com/",
          },
        ]);
      }
      if (currentGroup) persist(() => insertLecturerStudentEvaluation(currentGroup.id, input));
    },
    [currentGroupIndex, groups, persist],
  );

  const applyAgentSnapshot = useCallback((snapshot: WorkspaceSnapshotJson) => {
    const state = deserializeSnapshotToTeamState(snapshot);
    setGroups(state.groups);
    setReports(state.reports);
    // Materials in the snapshot are flat; assign them to the current group
    const currentGroup = state.groups[currentGroupIndex] ?? state.groups[0];
    if (currentGroup) {
      setMaterialsByGroupId(prev => ({ ...prev, [currentGroup.id]: state.materials }));
    }
    setLecturerStudentReviews(state.lecturerStudentReviews);
    setStudentBadges(state.studentBadges);
    // Re-persist if in supabase mode
    if (canPersist) {
      const currentState = {
        groups,
        reports,
        materialsByGroupId,
        lecturerStudentReviews,
        studentBadges,
      };
      void writeBackAgentSnapshot(state, currentState)
        .then(() => loadPersistedState())
        .catch(err => {
          console.error("Failed to write back snapshot:", err);
        });
    }
  }, [
    canPersist,
    currentGroupIndex,
    groups,
    reports,
    materialsByGroupId,
    lecturerStudentReviews,
    studentBadges,
    loadPersistedState,
  ]);

  const value = useMemo(
    () => ({
      groups,
      currentGroupIndex,
      setCurrentGroupIndex,
      tasks,
      members,
      activityLog,
      addTask,
      deleteTask,
      updateTaskStatus,
      approveTask,
      addLog,
      updateTask,
      updateLecturerScore,
      studentRole,
      setStudentRole,
      reports,
      addReport,
      markReportReviewed,
      materials,
      addMaterial,
      deleteMaterial,
      lecturerStudentReviews,
      studentBadges,
      addLecturerStudentEvaluation,
      applyAgentSnapshot,
    }),
    [
      groups,
      currentGroupIndex,
      setCurrentGroupIndex,
      tasks,
      members,
      activityLog,
      addTask,
      deleteTask,
      updateTaskStatus,
      approveTask,
      addLog,
      updateTask,
      updateLecturerScore,
      studentRole,
      setStudentRole,
      reports,
      addReport,
      markReportReviewed,
      materials,
      addMaterial,
      deleteMaterial,
      lecturerStudentReviews,
      studentBadges,
      addLecturerStudentEvaluation,
      applyAgentSnapshot,
    ],
  );

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
};
