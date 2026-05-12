import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

export interface Task {
  id: string;
  name: string;
  assignedTo: string;
  status: 'Todo' | 'In Progress' | 'Done';
  contributionPercent: number;
  approved: boolean;
  deadline: string;
  description?: string;
  priority?: 'Low' | 'Medium' | 'High';
  evidence?: { fileName: string; uploadTime: Date }[];
}

export interface MemberStat {
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
  const [groups, setGroups] = useState<Group[]>(makeGroups);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [studentRole, setStudentRole] = useState<'Leader' | 'Member'>('Leader');
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [materials, setMaterials] = useState<MaterialFile[]>([
    { id: 'demo-1', fileName: 'ProjectGuidelines.pdf', size: 245760, uploadedBy: 'Lecturer', uploadTime: new Date(Date.now() - 86400000) },
    { id: 'demo-2', fileName: 'TeamworkRubric.docx', size: 102400, uploadedBy: 'Lecturer', uploadTime: new Date(Date.now() - 43200000) },
  ]);
  const [lecturerStudentReviews, setLecturerStudentReviews] = useState<LecturerStudentReview[]>([]);
  const [studentBadges, setStudentBadges] = useState<VerifiedBadge[]>([]);

  const group = groups[currentGroupIndex] || groups[0];
  const tasks = group.tasks;
  const members = group.members;
  const activityLog = group.activityLog;

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
    updateGroup(currentGroupIndex, g => ({
      ...g,
      tasks: [...g.tasks, { ...task, id, status: 'Todo', approved: false }],
      activityLog: [{ timestamp: new Date(), description: `Task "${task.name}" được tạo và giao cho ${task.assignedTo}` }, ...g.activityLog],
    }));
  }, [currentGroupIndex, updateGroup]);

  const deleteTask = useCallback((id: string) => {
    updateGroup(currentGroupIndex, g => {
      const task = g.tasks.find(t => t.id === id);
      const newG = {
        ...g,
        tasks: g.tasks.filter(t => t.id !== id),
        activityLog: [{ timestamp: new Date(), description: `Task "${task?.name}" đã bị xóa` }, ...g.activityLog],
      };
      return recalcContributions(newG);
    });
  }, [currentGroupIndex, updateGroup]);

  const updateTaskStatus = useCallback((id: string, status: Task['status'], actor: string) => {
    updateGroup(currentGroupIndex, g => {
      const task = g.tasks.find(t => t.id === id);
      const statusLabel = status === 'In Progress' ? 'bắt đầu' : 'hoàn thành';
      return {
        ...g,
        tasks: g.tasks.map(t => t.id === id ? { ...t, status } : t),
        activityLog: [{ timestamp: new Date(), description: `${actor} đã ${statusLabel} task "${task?.name}"` }, ...g.activityLog],
      };
    });
  }, [currentGroupIndex, updateGroup]);

  const approveTask = useCallback((id: string) => {
    updateGroup(currentGroupIndex, g => {
      const task = g.tasks.find(t => t.id === id);
      const newG = {
        ...g,
        tasks: g.tasks.map(t => t.id === id ? { ...t, approved: true } : t),
        activityLog: [{ timestamp: new Date(), description: `Task "${task?.name}" đã được duyệt` }, ...g.activityLog],
      };
      return recalcContributions(newG);
    });
  }, [currentGroupIndex, updateGroup]);

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    updateGroup(currentGroupIndex, g => ({
      ...g,
      tasks: g.tasks.map(t => t.id === id ? { ...t, ...updates } : t),
    }));
  }, [currentGroupIndex, updateGroup]);

  const updateLecturerScore = useCallback((memberName: string, score: number, groupIdx: number) => {
    updateGroup(groupIdx, g => ({
      ...g,
      members: g.members.map(m => m.name === memberName ? { ...m, lecturerScore: score } : m),
    }));
  }, [updateGroup]);

  const addReport = useCallback((report: Omit<StudentReport, 'id' | 'timestamp' | 'reviewed'>) => {
    setReports(prev => [...prev, { ...report, id: Date.now().toString(), timestamp: new Date(), reviewed: false }]);
  }, []);

  const markReportReviewed = useCallback((id: string) => {
    setReports(prev => prev.map(r => r.id === id ? { ...r, reviewed: true } : r));
  }, []);

  const addMaterial = useCallback((file: Omit<MaterialFile, 'id' | 'uploadTime'>) => {
    setMaterials(prev => [...prev, { ...file, id: Date.now().toString(), uploadTime: new Date() }]);
  }, []);

  const deleteMaterial = useCallback((id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id));
  }, []);

  const addLecturerStudentEvaluation = useCallback(
    (input: Omit<LecturerStudentReview, "id" | "timestamp" | "lecturer">) => {
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
    },
    [],
  );

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
    ],
  );

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
};
