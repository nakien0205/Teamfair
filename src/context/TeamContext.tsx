import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';

import { isSupabaseConfigured, supabase } from '@/lib/supabaseClient';
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
  insertCalendarEvent,
  updatePersistedCalendarEvent,
  deletePersistedCalendarEvent,
  createPersistedGroup,
  joinPersistedGroup,
  deletePersistedGroup,
  createProjectInvite,
  getProjectInvites,
  revokeProjectInvite,
  createJoinRequest,
  getJoinRequests,
  processJoinRequest,
  validateInviteCode,
} from '@/lib/teamPersistence';
import type { WorkspaceSnapshotJson } from '@/lib/workspaceSnapshot';
import { deserializeSnapshotToTeamState } from '@/lib/workspaceSnapshot';

export type EventType = 'Meeting' | 'Task Deadline' | 'Milestone';

export interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  date: string; // YYYY-MM-DD
  time: string;
  description: string;
  createdBy: string;
}

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
  globalRole?: 'student' | 'lecturer' | 'admin';
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

export interface ProjectInvite {
  id: string;
  group_id: string;
  created_by: string;
  expires_at: string | null;
  max_uses: number | null;
  uses_count: number;
  approval_mode: 'auto' | 'requires_approval';
  created_at: string;
}

export interface JoinRequest {
  id: string;
  group_id: string;
  invite_id: string;
  user_id: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  users?: {
    full_name: string;
    email: string;
  } | {
    full_name: string;
    email: string;
  }[] | null;
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
  calendarEvents: CalendarEvent[];
  addCalendarEvent: (event: Omit<CalendarEvent, 'id' | 'createdBy'>) => void;
  updateCalendarEvent: (id: string, updates: Partial<CalendarEvent>) => void;
  deleteCalendarEvent: (id: string) => void;
  createProject: (projectName: string) => Promise<string>;
  joinProject: (inviteCode: string) => Promise<{ groupIndex?: number; groupName: string; status: "success" | "pending_approval" }>;
  deleteProject: (id: string) => Promise<void>;
  currentUserName: string;
  connectionError: boolean;
  dataLoading: boolean;
  loadPersistedState: () => Promise<void>;

  // Invites and requests
  activeInvites: ProjectInvite[];
  pendingJoinRequests: JoinRequest[];
  generateInviteCode: (expiresAt: Date | null, maxUses: number | null, approvalMode: "auto" | "requires_approval") => Promise<ProjectInvite>;
  fetchActiveInvites: () => Promise<ProjectInvite[]>;
  revokeInvite: (inviteId: string) => Promise<void>;
  fetchPendingJoinRequests: () => Promise<JoinRequest[]>;
  approveJoinRequest: (requestId: string) => Promise<void>;
  rejectJoinRequest: (requestId: string) => Promise<void>;
}



const TeamContext = createContext<TeamContextType | null>(null);

export const useTeam = () => {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be inside TeamProvider');
  return ctx;
};

export const TeamProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, profile, loading: authLoading } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [studentRole, setStudentRole] = useState<'Leader' | 'Member'>('Leader');
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [materialsByGroupId, setMaterialsByGroupId] = useState<Record<string, MaterialFile[]>>({});
  const [calendarEventsByGroupId, setCalendarEventsByGroupId] = useState<Record<string, CalendarEvent[]>>({});
  const [lecturerStudentReviews, setLecturerStudentReviews] = useState<LecturerStudentReview[]>([]);
  const [studentBadges, setStudentBadges] = useState<VerifiedBadge[]>([]);
  const [dataSource, setDataSource] = useState<'demo' | 'supabase'>('supabase');

  const [activeInvites, setActiveInvites] = useState<ProjectInvite[]>([]);
  const [pendingJoinRequests, setPendingJoinRequests] = useState<JoinRequest[]>([]);

  const [connectionError, setConnectionError] = useState(false);
  const [dataLoading, setDataLoading] = useState<boolean>(true);

  const updateGroup = useCallback((idx: number, updater: (g: Group) => Group) => {
    setGroups(prev => prev.map((g, i) => i === idx ? updater({ ...g }) : g));
  }, []);

  const group = groups[currentGroupIndex] || groups[0];
  const tasks = group?.tasks ?? [];
  const members = group?.members ?? [];
  const activityLog = group?.activityLog ?? [];
  const materials = useMemo(() => group ? (materialsByGroupId[group.id] ?? []) : [], [group, materialsByGroupId]);
  const calendarEvents = useMemo(() => group ? (calendarEventsByGroupId[group.id] ?? []) : [], [group, calendarEventsByGroupId]);

  const canPersist = dataSource === 'supabase' && isSupabaseConfigured && Boolean(user?.id);

  const resolvedStudentRole = useMemo(() => {
    if (canPersist && user?.id) {
      const currentUserMember = members.find(m => m.id === user.id);
      if (currentUserMember?.role) {
        return (currentUserMember.role === 'Leader' ? 'Leader' : 'Member') as 'Leader' | 'Member';
      }
    }
    return studentRole;
  }, [canPersist, user?.id, members, studentRole]);

  const currentUserName = useMemo(() => {
    if (isSupabaseConfigured && profile?.full_name) {
      return profile.full_name;
    }
    const isLeader = resolvedStudentRole === 'Leader';
    return isLeader ? (members[0]?.name || 'Nguyễn Văn A') : 'Trần Thị B';
  }, [profile, resolvedStudentRole, members]);

  const handleSetCurrentGroupIndex = useCallback((idx: number) => {
    setCurrentGroupIndex(idx);
    if (user?.id && groups[idx]?.id) {
      localStorage.setItem(`teamfair_last_project_${user.id}`, groups[idx].id);
    }
  }, [user?.id, groups]);

  const resetDemoState = useCallback(() => {
    setGroups([]);
    setReports([]);
    setMaterialsByGroupId({});
    setCalendarEventsByGroupId({});
    setLecturerStudentReviews([]);
    setStudentBadges([]);
    setCurrentGroupIndex(0);
    setDataSource('supabase');
  }, []);

  const loadPersistedState = useCallback(async () => {
    try {
      setDataLoading(true);
      const snapshot = await loadPersistedTeamSnapshot();
      if (user?.id) {
        setGroups(snapshot.groups);
        setReports(snapshot.reports);
        setMaterialsByGroupId(snapshot.materialsByGroupId);
        setCalendarEventsByGroupId(snapshot.calendarEventsByGroupId || {});
        setLecturerStudentReviews(snapshot.lecturerStudentReviews);
        setStudentBadges(snapshot.studentBadges);
        
        let targetIndex = 0;
        const lastProjId = localStorage.getItem(`teamfair_last_project_${user.id}`);
        if (lastProjId) {
          const foundIdx = snapshot.groups.findIndex(g => g.id === lastProjId);
          if (foundIdx !== -1) targetIndex = foundIdx;
        }
        setCurrentGroupIndex(targetIndex);
        setDataSource('supabase');
        setConnectionError(false);
        return;
      }
      if (snapshot.groups.length === 0) {
        resetDemoState();
        return;
      }
      setGroups(snapshot.groups);
      setReports(snapshot.reports);
      setMaterialsByGroupId(snapshot.materialsByGroupId);
      setCalendarEventsByGroupId(snapshot.calendarEventsByGroupId || {});
      setLecturerStudentReviews(snapshot.lecturerStudentReviews);
      setStudentBadges(snapshot.studentBadges);
      setCurrentGroupIndex(0);
      setDataSource('supabase');
      setConnectionError(false);
    } catch (err) {
      console.warn('Supabase load failed:', err);
      setConnectionError(true);
      setGroups([]);
      setDataSource('supabase');
    } finally {
      setDataLoading(false);
    }
  }, [resetDemoState, user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      resetDemoState();
      setDataLoading(false);
      return;
    }

    if (authLoading) {
      setDataLoading(true);
      return;
    }

    if (!user?.id) {
      resetDemoState();
      setDataLoading(false);
      return;
    }

    let cancelled = false;
    setDataLoading(true);
    loadPersistedTeamSnapshot()
      .then(snapshot => {
        if (cancelled) return;
        setGroups(snapshot.groups);
        setReports(snapshot.reports);
        setMaterialsByGroupId(snapshot.materialsByGroupId);
        setCalendarEventsByGroupId(snapshot.calendarEventsByGroupId || {});
        setLecturerStudentReviews(snapshot.lecturerStudentReviews);
        setStudentBadges(snapshot.studentBadges);
        
        let targetIndex = 0;
        const lastProjId = localStorage.getItem(`teamfair_last_project_${user.id}`);
        if (lastProjId) {
          const foundIdx = snapshot.groups.findIndex(g => g.id === lastProjId);
          if (foundIdx !== -1) targetIndex = foundIdx;
        }
        setCurrentGroupIndex(targetIndex);
        setDataSource('supabase');
        setConnectionError(false);
        setDataLoading(false);
      })
      .catch(error => {
        console.warn('Supabase load failed:', error);
        if (!cancelled) {
          setConnectionError(true);
          setGroups([]);
          setDataSource('supabase');
          setDataLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, resetDemoState, user?.id]);

  const fetchActiveInvites = useCallback(async (): Promise<ProjectInvite[]> => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup) return [];

    if (canPersist) {
      try {
        const data = await getProjectInvites(currentGroup.id);
        setActiveInvites(data);
        return data;
      } catch (err) {
        console.error("Failed to fetch project invites:", err);
        return [];
      }
    } else {
      return activeInvites;
    }
  }, [groups, currentGroupIndex, canPersist, activeInvites]);

  const generateInviteCode = useCallback(async (
    expiresAt: Date | null,
    maxUses: number | null,
    approvalMode: "auto" | "requires_approval"
  ): Promise<ProjectInvite> => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup) throw new Error("No active group selected");

    if (canPersist) {
      const invite = await createProjectInvite(currentGroup.id, expiresAt, maxUses, approvalMode);
      setActiveInvites(prev => [invite, ...prev]);
      return invite;
    } else {
      const mockInvite: ProjectInvite = {
        id: `IV-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
        group_id: currentGroup.id,
        created_by: user?.id || "mock-user",
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        max_uses: maxUses,
        uses_count: 0,
        approval_mode: approvalMode,
        created_at: new Date().toISOString(),
      };
      setActiveInvites(prev => [mockInvite, ...prev]);
      return mockInvite;
    }
  }, [groups, currentGroupIndex, canPersist, user?.id]);

  const revokeInvite = useCallback(async (inviteId: string): Promise<void> => {
    setActiveInvites(prev => prev.filter(inv => inv.id !== inviteId));

    if (canPersist) {
      await revokeProjectInvite(inviteId);
    }
  }, [canPersist]);

  const fetchPendingJoinRequests = useCallback(async (): Promise<JoinRequest[]> => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup) return [];

    if (canPersist) {
      try {
        const data = await getJoinRequests(currentGroup.id);
        setPendingJoinRequests(data);
        return data;
      } catch (err) {
        console.error("Failed to fetch join requests:", err);
        return [];
      }
    } else {
      return pendingJoinRequests;
    }
  }, [groups, currentGroupIndex, canPersist, pendingJoinRequests]);

  const approveJoinRequest = useCallback(async (requestId: string): Promise<void> => {
    const request = pendingJoinRequests.find(r => r.id === requestId);
    if (!request) return;

    setPendingJoinRequests(prev => prev.filter(r => r.id !== requestId));

    if (canPersist) {
      try {
        await processJoinRequest(requestId, "approved");
        await loadPersistedState();
      } catch (err) {
        console.error("Failed to approve join request:", err);
        void fetchPendingJoinRequests();
      }
    } else {
      const currentGroup = groups[currentGroupIndex];
      if (currentGroup) {
        const applicantName = request.users && !Array.isArray(request.users)
          ? request.users.full_name
          : "Thành viên mới";
        
        updateGroup(currentGroupIndex, g => ({
          ...g,
          members: [
            ...g.members,
            {
              id: request.user_id,
              name: applicantName,
              role: "Member",
              completedTasks: 0,
              contributionPercent: 0,
              lecturerScore: null,
            }
          ],
          activityLog: [
            { timestamp: new Date(), description: `${applicantName} đã tham gia dự án` },
            ...g.activityLog
          ]
        }));
      }
    }
  }, [pendingJoinRequests, canPersist, groups, currentGroupIndex, updateGroup, loadPersistedState, fetchPendingJoinRequests]);

  const rejectJoinRequest = useCallback(async (requestId: string): Promise<void> => {
    setPendingJoinRequests(prev => prev.filter(r => r.id !== requestId));

    if (canPersist) {
      try {
        await processJoinRequest(requestId, "rejected");
      } catch (err) {
        console.error("Failed to reject join request:", err);
        void fetchPendingJoinRequests();
      }
    }
  }, [canPersist, fetchPendingJoinRequests]);

  useEffect(() => {
    if (canPersist && group?.id) {
      void fetchActiveInvites();
      void fetchPendingJoinRequests();
    }
  }, [group?.id, canPersist, fetchActiveInvites, fetchPendingJoinRequests]);

  const persist = useCallback((operation: () => Promise<void>) => {
    if (!canPersist) return;
    void operation()
      .then(loadPersistedState)
      .catch(error => {
        console.warn('Supabase team data persistence failed:', error);
      });
  }, [canPersist, loadPersistedState]);

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

  const addCalendarEvent = useCallback((event: Omit<CalendarEvent, 'id' | 'createdBy'>) => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup) return;
    const newEvent: CalendarEvent = {
      ...event,
      id: Date.now().toString(),
      createdBy: resolvedStudentRole === 'Leader' ? 'Leader' : 'Member',
    };
    setCalendarEventsByGroupId(prev => ({
      ...prev,
      [currentGroup.id]: [...(prev[currentGroup.id] ?? []), newEvent],
    }));
    persist(() => insertCalendarEvent(currentGroup.id, newEvent));
  }, [currentGroupIndex, groups, persist, resolvedStudentRole]);

  const updateCalendarEvent = useCallback((id: string, updates: Partial<CalendarEvent>) => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup) return;
    setCalendarEventsByGroupId(prev => ({
      ...prev,
      [currentGroup.id]: (prev[currentGroup.id] ?? []).map(e => e.id === id ? { ...e, ...updates } : e),
    }));
    persist(() => updatePersistedCalendarEvent(id, updates));
  }, [currentGroupIndex, groups, persist]);

  const deleteCalendarEvent = useCallback((id: string) => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup) return;
    setCalendarEventsByGroupId(prev => ({
      ...prev,
      [currentGroup.id]: (prev[currentGroup.id] ?? []).filter(e => e.id !== id),
    }));
    persist(() => deletePersistedCalendarEvent(id));
  }, [currentGroupIndex, groups, persist]);

  const createProject = useCallback(async (projectName: string) => {
    if (canPersist && user?.id) {
      const newId = await createPersistedGroup(projectName, user.id);
      localStorage.setItem(`teamfair_last_project_${user.id}`, newId);
      await loadPersistedState();
      return newId;
    } else {
      const mockId = `mock-${Date.now()}`;
      const mockG: Group = {
        id: mockId,
        name: projectName,
        members: [
          {
            id: 'demo-user-id',
            name: currentUserName || 'Nguyễn Văn A',
            role: 'Leader',
            completedTasks: 0,
            contributionPercent: 0,
            lecturerScore: null,
          },
        ],
        tasks: [],
        activityLog: [
          { timestamp: new Date(), description: 'Nhóm được tạo' },
        ],
      };
      setGroups(prev => [...prev, mockG]);
      return mockId;
    }
  }, [canPersist, user?.id, loadPersistedState, currentUserName]);

  const joinProject = useCallback(async (inviteCode: string): Promise<{ groupIndex?: number; groupName: string; status: "success" | "pending_approval" }> => {
    if (canPersist && user?.id) {
      const { group_id, approval_mode, group_name } = await validateInviteCode(inviteCode);

      if (approval_mode === "auto") {
        await joinPersistedGroup(group_id, user.id, "Member");
        localStorage.setItem(`teamfair_last_project_${user.id}`, group_id);
        
        const snapshot = await loadPersistedTeamSnapshot();
        setGroups(snapshot.groups);
        setReports(snapshot.reports);
        setMaterialsByGroupId(snapshot.materialsByGroupId);
        setCalendarEventsByGroupId(snapshot.calendarEventsByGroupId || {});
        setLecturerStudentReviews(snapshot.lecturerStudentReviews);
        setStudentBadges(snapshot.studentBadges);
        
        const foundIdx = snapshot.groups.findIndex(g => g.id === group_id);
        const targetIndex = foundIdx !== -1 ? foundIdx : 0;
        setCurrentGroupIndex(targetIndex);
        setDataSource('supabase');
        setConnectionError(false);
        
        const joinedGroup = snapshot.groups[targetIndex];
        return { status: "success", groupIndex: targetIndex, groupName: joinedGroup?.name || group_name };
      } else {
        await createJoinRequest(group_id, inviteCode, user.id);

        const senderName = profile?.full_name || user.email || "Hệ thống";
        const notificationContent = `Sinh viên ${senderName} đang yêu cầu tham gia dự án "${group_name}".`;

        const { data: groupData } = await supabase
          .from("groups")
          .select("lecturer_id")
          .eq("id", group_id)
          .single();

        const { data: leaderData } = await supabase
          .from("group_members")
          .select("student_id")
          .eq("group_id", group_id)
          .eq("role", "Leader")
          .maybeSingle();

        if (groupData?.lecturer_id) {
          await supabase.from("notifications").insert({
            recipient_id: groupData.lecturer_id,
            sender_name: senderName,
            content: notificationContent,
            is_read: false,
          });
        }
        if (leaderData?.student_id && leaderData.student_id !== groupData?.lecturer_id) {
          await supabase.from("notifications").insert({
            recipient_id: leaderData.student_id,
            sender_name: senderName,
            content: notificationContent,
            is_read: false,
          });
        }

        return { status: "pending_approval", groupName: group_name };
      }
    } else {
      if (inviteCode.endsWith("-REQ") || inviteCode.includes("APPROVAL")) {
        return { status: "pending_approval", groupName: `Dự án Yêu cầu Duyệt - ${inviteCode}` };
      }

      const mockG: Group = {
        id: inviteCode,
        name: `Dự án Joined - ${inviteCode}`,
        members: [
          {
            id: 'demo-user-id',
            name: currentUserName || 'Nguyễn Văn A',
            role: 'Member',
            completedTasks: 0,
            contributionPercent: 0,
            lecturerScore: null,
          },
        ],
        tasks: [],
        activityLog: [
          { timestamp: new Date(), description: 'Bạn đã tham gia dự án' },
        ],
      };
      let newIdx = 0;
      let newName = mockG.name;
      setGroups(prev => {
        const existingIdx = prev.findIndex(g => g.id === inviteCode);
        if (existingIdx !== -1) {
          newIdx = existingIdx;
          newName = prev[existingIdx].name;
          return prev;
        }
        newIdx = prev.length;
        return [...prev, mockG];
      });
      setCurrentGroupIndex(newIdx);
      return { status: "success", groupIndex: newIdx, groupName: newName };
    }
  }, [canPersist, user?.id, profile?.full_name, currentUserName]);

  const deleteProject = useCallback(async (projectId: string) => {
    if (canPersist && user?.id) {
      await deletePersistedGroup(projectId);
      const lastProjId = localStorage.getItem(`teamfair_last_project_${user.id}`);
      if (lastProjId === projectId) {
        localStorage.removeItem(`teamfair_last_project_${user.id}`);
      }
      await loadPersistedState();
    } else {
      setGroups(prev => prev.filter(g => g.id !== projectId));
      setCurrentGroupIndex(0);
    }
  }, [canPersist, user?.id, loadPersistedState]);

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
        calendarEventsByGroupId,
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
    calendarEventsByGroupId,
    loadPersistedState,
  ]);

  const value = useMemo(
    () => ({
      groups,
      currentGroupIndex,
      setCurrentGroupIndex: handleSetCurrentGroupIndex,
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
      studentRole: resolvedStudentRole,
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
      calendarEvents,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      createProject,
      joinProject,
      deleteProject,
      currentUserName,
      connectionError,
      dataLoading,
      loadPersistedState,
      activeInvites,
      pendingJoinRequests,
      generateInviteCode,
      fetchActiveInvites,
      revokeInvite,
      fetchPendingJoinRequests,
      approveJoinRequest,
      rejectJoinRequest,
    }),
    [
      groups,
      currentGroupIndex,
      handleSetCurrentGroupIndex,
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
      resolvedStudentRole,
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
      calendarEvents,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      createProject,
      joinProject,
      deleteProject,
      currentUserName,
      connectionError,
      dataLoading,
      loadPersistedState,
      activeInvites,
      pendingJoinRequests,
      generateInviteCode,
      fetchActiveInvites,
      revokeInvite,
      fetchPendingJoinRequests,
      approveJoinRequest,
      rejectJoinRequest,
    ],
  );

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
};
