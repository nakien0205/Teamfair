import React, { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';

import { isSupabaseConfigured } from '@/lib/supabaseClient';
import { useRealtimeSubscription } from '@/hooks/useRealtimeSubscription';
import {
  approvePersistedTask,
  claimGroupEmailInvitesForCurrentUser,
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
  insertActivityLog,
  updatePersistedCalendarEvent,
  deletePersistedCalendarEvent,
  createPersistedGroup,
  deletePersistedGroup,
  createProjectInvite,
  getProjectInvites,
  revokeProjectInvite,
  scopePersistedTeamSnapshotForUser,
  getJoinRequests,
  processJoinRequest,
  validateInviteCode,
} from '@/lib/teamPersistence';
import type { WorkspaceSnapshotJson } from '@/lib/workspaceSnapshot';
import { deserializeSnapshotToTeamState } from '@/lib/workspaceSnapshot';
import { deleteStorageFile } from '@/lib/storage';
import { trackEvent } from '@/lib/analytics';

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

export interface TaskEvidence {
  fileName: string;
  uploadTime: Date;
  fileSize?: number;
  mimeType?: string;
  storagePath?: string;
  publicUrl?: string;
  storageBucket?: 'evidence';
  size?: number;
  uploadedById?: string;
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
  evidence?: TaskEvidence[];
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
  groupId?: string;
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
  storagePath?: string;
  storageBucket?: 'materials' | null;
  uploadedById?: string;
  description?: string;
  previewImg?: string;
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
  lecturers?: MemberStat[];
  tasks: Task[];
  activityLog: ActivityLogEntry[];
  lecturer_id?: string;
  owner_id?: string;
}

export function nextGroupIndexAfterDeletion(currentIndex: number, deletedIndex: number, groupCount: number): number {
  const remainingCount = Math.max(groupCount - 1, 0);
  if (remainingCount === 0) return 0;
  if (deletedIndex >= 0 && deletedIndex < currentIndex) return currentIndex - 1;
  return Math.min(currentIndex, remainingCount - 1);
}

export function clearLastProjectAfterDeletion(userId: string, projectId: string): void {
  const key = `teamfair_last_project_${userId}`;
  if (localStorage.getItem(key) === projectId) localStorage.removeItem(key);
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
  addTask: (task: Omit<Task, 'id' | 'status' | 'approved'>) => Promise<Task>;
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
  addStoredMaterial: (file: Omit<MaterialFile, 'id' | 'uploadTime'>) => Promise<void>;
  deleteStoredMaterial: (file: MaterialFile) => Promise<void>;
  appendTaskEvidence: (taskId: string, evidence: TaskEvidence) => Promise<void>;
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
  createProjects: (projectNames: string[]) => Promise<Array<{ id: string; name: string }>>;
  joinProject: (inviteCode: string) => Promise<{ groupIndex?: number; groupName: string; status: "success" | "pending_approval" }>;
  deleteProject: (id: string, confirmationName: string) => Promise<void>;
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
  const teamRealtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teamRefreshInFlightRef = useRef(false);
  const teamRefreshPendingRef = useRef(false);
  const runRealtimeTeamRefreshRef = useRef<() => void>(() => undefined);
  const joinRequestsRealtimeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchPendingJoinRequestsRef = useRef<() => Promise<JoinRequest[]>>(async () => []);

  const updateGroup = useCallback((idx: number, updater: (g: Group) => Group) => {
    setGroups(prev => prev.map((g, i) => i === idx ? updater({ ...g }) : g));
  }, []);

  const group = groups[currentGroupIndex] || groups[0];
  const tasks = useMemo(() => group?.tasks ?? [], [group?.tasks]);
  const members = useMemo(() => group?.members ?? [], [group?.members]);
  const activityLog = useMemo(() => group?.activityLog ?? [], [group?.activityLog]);
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

  const scopeSnapshotForCurrentUser = useCallback((snapshot: Awaited<ReturnType<typeof loadPersistedTeamSnapshot>>) => {
    if (!user?.id) return snapshot;

    const role = profile?.role === 'lecturer' || profile?.role === 'admin'
      ? profile.role
      : 'student';

    return scopePersistedTeamSnapshotForUser(snapshot, {
      userId: user.id,
      role,
    });
  }, [profile?.role, user?.id]);

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
      const scopedSnapshot = scopeSnapshotForCurrentUser(snapshot);
      if (user?.id) {
        setGroups(scopedSnapshot.groups);
        setReports(scopedSnapshot.reports);
        setMaterialsByGroupId(scopedSnapshot.materialsByGroupId);
        setCalendarEventsByGroupId(scopedSnapshot.calendarEventsByGroupId || {});
        setLecturerStudentReviews(scopedSnapshot.lecturerStudentReviews);
        setStudentBadges(scopedSnapshot.studentBadges);
        
        let targetIndex = 0;
        const lastProjId = localStorage.getItem(`teamfair_last_project_${user.id}`);
        if (lastProjId) {
          const foundIdx = scopedSnapshot.groups.findIndex(g => g.id === lastProjId);
          if (foundIdx !== -1) targetIndex = foundIdx;
        }
        setCurrentGroupIndex(targetIndex);
        setDataSource('supabase');
        setConnectionError(false);
        void claimGroupEmailInvitesForCurrentUser().catch(error => {
          console.warn('Failed to claim email invites for current user:', error);
        });
        return;
      }
      if (scopedSnapshot.groups.length === 0) {
        resetDemoState();
        return;
      }
      setGroups(scopedSnapshot.groups);
      setReports(scopedSnapshot.reports);
      setMaterialsByGroupId(scopedSnapshot.materialsByGroupId);
      setCalendarEventsByGroupId(scopedSnapshot.calendarEventsByGroupId || {});
      setLecturerStudentReviews(scopedSnapshot.lecturerStudentReviews);
      setStudentBadges(scopedSnapshot.studentBadges);
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
  }, [resetDemoState, scopeSnapshotForCurrentUser, user?.id]);

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
        const scopedSnapshot = scopeSnapshotForCurrentUser(snapshot);
        setGroups(scopedSnapshot.groups);
        setReports(scopedSnapshot.reports);
        setMaterialsByGroupId(scopedSnapshot.materialsByGroupId);
        setCalendarEventsByGroupId(scopedSnapshot.calendarEventsByGroupId || {});
        setLecturerStudentReviews(scopedSnapshot.lecturerStudentReviews);
        setStudentBadges(scopedSnapshot.studentBadges);
        
        let targetIndex = 0;
        const lastProjId = localStorage.getItem(`teamfair_last_project_${user.id}`);
        if (lastProjId) {
          const foundIdx = scopedSnapshot.groups.findIndex(g => g.id === lastProjId);
          if (foundIdx !== -1) targetIndex = foundIdx;
        }
        setCurrentGroupIndex(targetIndex);
        setDataSource('supabase');
        setConnectionError(false);
        void claimGroupEmailInvitesForCurrentUser().catch(error => {
          console.warn('Failed to claim email invites for current user:', error);
        });
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
  }, [authLoading, resetDemoState, scopeSnapshotForCurrentUser, user?.id]);

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
      return [];
    }
  }, [groups, currentGroupIndex, canPersist]);

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
      return [];
    }
  }, [groups, currentGroupIndex, canPersist]);

  useEffect(() => {
    fetchPendingJoinRequestsRef.current = fetchPendingJoinRequests;
  }, [fetchPendingJoinRequests]);

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
        throw err;
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

  const runRealtimeTeamRefresh = useCallback(() => {
    if (teamRefreshInFlightRef.current) {
      teamRefreshPendingRef.current = true;
      return;
    }

    teamRefreshInFlightRef.current = true;
    void loadPersistedState()
      .catch(error => {
        console.warn("Realtime team refresh failed:", error);
      })
      .finally(() => {
        teamRefreshInFlightRef.current = false;
        if (teamRefreshPendingRef.current) {
          teamRefreshPendingRef.current = false;
          runRealtimeTeamRefreshRef.current();
        }
      });
  }, [loadPersistedState]);

  useEffect(() => {
    runRealtimeTeamRefreshRef.current = runRealtimeTeamRefresh;
  }, [runRealtimeTeamRefresh]);

  const scheduleTeamRealtimeRefresh = useCallback(() => {
    if (teamRealtimeTimerRef.current) {
      clearTimeout(teamRealtimeTimerRef.current);
    }

    teamRealtimeTimerRef.current = setTimeout(() => {
      teamRealtimeTimerRef.current = null;
      runRealtimeTeamRefresh();
    }, 250);
  }, [runRealtimeTeamRefresh]);

  const scheduleJoinRequestsRealtimeRefresh = useCallback(() => {
    if (joinRequestsRealtimeTimerRef.current) {
      clearTimeout(joinRequestsRealtimeTimerRef.current);
    }

    joinRequestsRealtimeTimerRef.current = setTimeout(() => {
      joinRequestsRealtimeTimerRef.current = null;
      void fetchPendingJoinRequestsRef.current();
    }, 250);
  }, []);

  const handleRealtimeStatus = useCallback((table: string, status: string, error?: Error) => {
    if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      console.warn(`Team realtime subscription degraded for ${table}:`, status, error);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (teamRealtimeTimerRef.current) {
        clearTimeout(teamRealtimeTimerRef.current);
        teamRealtimeTimerRef.current = null;
      }
      if (joinRequestsRealtimeTimerRef.current) {
        clearTimeout(joinRequestsRealtimeTimerRef.current);
        joinRequestsRealtimeTimerRef.current = null;
      }
      teamRefreshPendingRef.current = false;
    };
  }, [group?.id, user?.id]);

  const realtimeEnabled = canPersist && Boolean(user?.id && group?.id);
  const realtimeGroupFilter = group?.id ? `group_id=eq.${group.id}` : undefined;

  useRealtimeSubscription({
    enabled: realtimeEnabled,
    table: "tasks",
    filter: realtimeGroupFilter,
    requireFilter: true,
    events: ["*"],
    onPayload: scheduleTeamRealtimeRefresh,
    onStatus: (status, error) => handleRealtimeStatus("tasks", status, error),
  });

  useRealtimeSubscription({
    enabled: realtimeEnabled,
    table: "activity_logs",
    filter: realtimeGroupFilter,
    requireFilter: true,
    events: ["*"],
    onPayload: scheduleTeamRealtimeRefresh,
    onStatus: (status, error) => handleRealtimeStatus("activity_logs", status, error),
  });

  useRealtimeSubscription({
    enabled: realtimeEnabled,
    table: "materials",
    filter: realtimeGroupFilter,
    requireFilter: true,
    events: ["*"],
    onPayload: scheduleTeamRealtimeRefresh,
    onStatus: (status, error) => handleRealtimeStatus("materials", status, error),
  });

  useRealtimeSubscription({
    enabled: realtimeEnabled,
    table: "group_members",
    filter: realtimeGroupFilter,
    requireFilter: true,
    events: ["*"],
    onPayload: scheduleTeamRealtimeRefresh,
    onStatus: (status, error) => handleRealtimeStatus("group_members", status, error),
  });

  useRealtimeSubscription({
    enabled: realtimeEnabled,
    table: "join_requests",
    filter: realtimeGroupFilter,
    requireFilter: true,
    events: ["*"],
    onPayload: scheduleJoinRequestsRealtimeRefresh,
    onStatus: (status, error) => handleRealtimeStatus("join_requests", status, error),
  });

  const persist = useCallback((operation: () => Promise<void>) => {
    if (!canPersist) return;
    void operation()
      .then(loadPersistedState)
      .catch(error => {
        console.warn('Supabase team data persistence failed:', error);
      });
  }, [canPersist, loadPersistedState]);

  const addLog = useCallback((description: string) => {
    const currentGroup = groups[currentGroupIndex];
    updateGroup(currentGroupIndex, g => ({
      ...g,
      activityLog: [{ timestamp: new Date(), description }, ...g.activityLog],
    }));
    if (currentGroup) persist(() => insertActivityLog(currentGroup.id, description));
  }, [currentGroupIndex, groups, persist, updateGroup]);

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

  const addTask = useCallback(async (task: Omit<Task, 'id' | 'status' | 'approved'>): Promise<Task> => {
    const currentGroup = groups[currentGroupIndex];
    const targetGroupId = currentGroup?.id;
    let createdTask: Task;

    if (currentGroup && canPersist) {
      createdTask = await insertTask(currentGroup, task);
    } else {
      const id = crypto.randomUUID();
      createdTask = { ...task, id, status: 'Todo', approved: false };
    }

    if (targetGroupId) {
      const targetIndex = groups.findIndex(g => g.id === targetGroupId);
      if (targetIndex !== -1) {
        updateGroup(targetIndex, g => {
          const existingIdx = g.tasks.findIndex(t => t.id === createdTask.id);
          const newTasks = existingIdx !== -1
            ? g.tasks.map((t, idx) => (idx === existingIdx ? createdTask : t))
            : [...g.tasks, createdTask];
          return {
            ...g,
            tasks: newTasks,
            activityLog: [
              { timestamp: new Date(), description: `Task "${task.name}" được tạo và giao cho ${task.assignedTo}` },
              ...g.activityLog,
            ],
          };
        });
      }
      trackEvent("task_created", {
        group_id: targetGroupId,
        status: "Todo",
      });
    }

    return createdTask;
  }, [canPersist, currentGroupIndex, groups, updateGroup]);

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
    if (currentGroup && persistedTask?.status !== status) {
      trackEvent("task_status_changed", {
        group_id: currentGroup.id,
        from_status: persistedTask?.status,
        to_status: status,
      });
    }
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
    setReports(prev => [
      ...prev,
      {
        ...report,
        groupId: currentGroup?.id,
        id: Date.now().toString(),
        timestamp: new Date(),
        reviewed: false,
      },
    ]);
    if (currentGroup) {
      trackEvent("report_submitted", {
        group_id: currentGroup.id,
      });
    }
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
    trackEvent("material_uploaded", {
      group_id: currentGroup.id,
      file_type: file.fileName.split(".").pop()?.toLowerCase() || "unknown",
    });
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

  const addStoredMaterial = useCallback(async (file: Omit<MaterialFile, 'id' | 'uploadTime'>) => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup) throw new Error("No active group selected");

    if (!canPersist) {
      setMaterialsByGroupId(prev => ({
        ...prev,
        [currentGroup.id]: [...(prev[currentGroup.id] ?? []), { ...file, id: Date.now().toString(), uploadTime: new Date() }],
      }));
      trackEvent("material_uploaded", {
        group_id: currentGroup.id,
        file_type: file.fileName.split(".").pop()?.toLowerCase() || "unknown",
      });
      return;
    }

    await insertMaterial(currentGroup.id, file);
    await loadPersistedState();
    trackEvent("material_uploaded", {
      group_id: currentGroup.id,
      file_type: file.fileName.split(".").pop()?.toLowerCase() || "unknown",
    });
  }, [canPersist, currentGroupIndex, groups, loadPersistedState]);

  const deleteStoredMaterial = useCallback(async (file: MaterialFile) => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup) throw new Error("No active group selected");

    if (canPersist) {
      await deletePersistedMaterial(file.id);
      if (file.storagePath) {
        void deleteStorageFile(file.storageBucket ?? "materials", file.storagePath);
      }
      await loadPersistedState();
      return;
    }

    setMaterialsByGroupId(prev => ({
      ...prev,
      [currentGroup.id]: (prev[currentGroup.id] ?? []).filter(m => m.id !== file.id),
    }));
  }, [canPersist, currentGroupIndex, groups, loadPersistedState]);

  const appendTaskEvidence = useCallback(async (taskId: string, evidence: TaskEvidence) => {
    const currentGroup = groups[currentGroupIndex];
    if (!currentGroup) throw new Error("No active group selected");

    const task = currentGroup.tasks.find(t => t.id === taskId);
    if (!task) throw new Error("Task not found");

    const nextEvidence = [...(task.evidence ?? []), evidence];
    updateGroup(currentGroupIndex, g => ({
      ...g,
      tasks: g.tasks.map(t => t.id === taskId ? { ...t, evidence: nextEvidence } : t),
    }));

    if (!canPersist) return;

    try {
      await updatePersistedTask(taskId, { evidence: nextEvidence }, currentGroup.members);
      await loadPersistedState();
    } catch (error) {
      await loadPersistedState();
      throw error;
    }
  }, [canPersist, currentGroupIndex, groups, loadPersistedState, updateGroup]);

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
        if (currentGroup) {
          trackEvent("badge_awarded", {
            group_id: currentGroup.id,
            badge_type: "verified_contribution",
            rating: input.rating,
          });
        }
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
      const newId = await createPersistedGroup(projectName, user.id, profile?.role);
      localStorage.setItem(`teamfair_last_project_${user.id}`, newId);
      await loadPersistedState();
      trackEvent("group_created", {
        group_id: newId,
        role: profile?.role ?? "student",
      });
      return newId;
    } else {
      const mockId = `mock-${Date.now()}`;
      const isCreatorLecturer = profile?.role === "lecturer" || profile?.role === "admin";
      const mockG: Group = {
        id: mockId,
        name: projectName,
        members: isCreatorLecturer ? [] : [
          {
            id: 'demo-user-id',
            name: currentUserName || 'Nguyễn Văn A',
            role: 'Leader',
            completedTasks: 0,
            contributionPercent: 0,
            lecturerScore: null,
            globalRole: 'student',
          },
        ],
        lecturers: isCreatorLecturer ? [
          {
            id: 'demo-user-id',
            name: currentUserName || 'Nguyễn Văn A',
            role: 'Lecturer',
            completedTasks: 0,
            contributionPercent: 0,
            lecturerScore: null,
            globalRole: profile?.role as 'lecturer' | 'admin',
          }
        ] : [],
        tasks: [],
        activityLog: [
          { timestamp: new Date(), description: 'Nhóm được tạo' },
        ],
      };
      setGroups(prev => [...prev, mockG]);
      trackEvent("group_created", {
        group_id: mockId,
        role: profile?.role ?? "student",
      });
      return mockId;
    }
  }, [canPersist, user?.id, loadPersistedState, currentUserName, profile?.role]);

  const createProjects = useCallback(async (projectNames: string[]) => {
    const normalizedNames = Array.from(
      new Set(
        projectNames
          .map(name => name.trim())
          .filter(Boolean),
      ),
    );

    if (normalizedNames.length === 0) return [];

    if (canPersist && user?.id) {
      const created: Array<{ id: string; name: string }> = [];
      for (const projectName of normalizedNames) {
        const newId = await createPersistedGroup(projectName, user.id, profile?.role);
        created.push({ id: newId, name: projectName });
      }

      if (created[0]) {
        localStorage.setItem(`teamfair_last_project_${user.id}`, created[0].id);
      }
      await loadPersistedState();
      return created;
    }

    const created = normalizedNames.map((projectName, index) => ({
      id: `mock-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`,
      name: projectName,
    }));

    const isCreatorLecturer = profile?.role === "lecturer" || profile?.role === "admin";
    const mockGroups: Group[] = created.map(({ id, name }) => ({
      id,
      name,
      members: isCreatorLecturer ? [] : [
        {
          id: 'demo-user-id',
          name: currentUserName || 'Nguyễn Văn A',
          role: 'Leader',
          completedTasks: 0,
          contributionPercent: 0,
          lecturerScore: null,
          globalRole: 'student',
        },
      ],
      lecturers: isCreatorLecturer ? [
        {
          id: 'demo-user-id',
          name: currentUserName || 'Nguyễn Văn A',
          role: 'Lecturer',
          completedTasks: 0,
          contributionPercent: 0,
          lecturerScore: null,
          globalRole: profile?.role as 'lecturer' | 'admin',
        }
      ] : [],
      tasks: [],
      activityLog: [
        { timestamp: new Date(), description: 'Nhóm được tạo' },
      ],
    }));

    setGroups(prev => [...prev, ...mockGroups]);
    return created;
  }, [canPersist, user?.id, loadPersistedState, currentUserName, profile?.role]);

  const joinProject = useCallback(async (inviteCode: string): Promise<{ groupIndex?: number; groupName: string; status: "success" | "pending_approval" }> => {
    if (canPersist && user?.id) {
      const { group_id, group_name, status } = await validateInviteCode(inviteCode);

      if (status === "success") {
        localStorage.setItem(`teamfair_last_project_${user.id}`, group_id);
        
        const snapshot = await loadPersistedTeamSnapshot();
        const scopedSnapshot = scopeSnapshotForCurrentUser(snapshot);
        setGroups(scopedSnapshot.groups);
        setReports(scopedSnapshot.reports);
        setMaterialsByGroupId(scopedSnapshot.materialsByGroupId);
        setCalendarEventsByGroupId(scopedSnapshot.calendarEventsByGroupId || {});
        setLecturerStudentReviews(scopedSnapshot.lecturerStudentReviews);
        setStudentBadges(scopedSnapshot.studentBadges);

        const foundIdx = scopedSnapshot.groups.findIndex(g => g.id === group_id);
        const targetIndex = foundIdx !== -1 ? foundIdx : 0;
        setCurrentGroupIndex(targetIndex);
        setDataSource('supabase');
        setConnectionError(false);

        const joinedGroup = scopedSnapshot.groups[targetIndex];
        trackEvent("group_joined", {
          group_id,
          method: "invite",
        });
        return { status: "success", groupIndex: targetIndex, groupName: joinedGroup?.name || group_name };
      } else {
        trackEvent("group_join_requested", {
          group_id,
          method: "request",
        });
        return { status: "pending_approval", groupName: group_name };
      }
    } else {
      if (inviteCode.endsWith("-REQ") || inviteCode.includes("APPROVAL")) {
        trackEvent("group_join_requested", {
          group_id: inviteCode,
          method: "request",
        });
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
      trackEvent("group_joined", {
        group_id: inviteCode,
        method: "invite",
      });
      return { status: "success", groupIndex: newIdx, groupName: newName };
    }
  }, [canPersist, currentUserName, scopeSnapshotForCurrentUser, user?.id]);

  const deleteProject = useCallback(async (projectId: string, confirmationName: string) => {
    if (canPersist && user?.id) {
      await deletePersistedGroup(projectId, confirmationName);
      clearLastProjectAfterDeletion(user.id, projectId);
      const deletedIndex = groups.findIndex(group => group.id === projectId);
      setGroups(previousGroups => previousGroups.filter(group => group.id !== projectId));
      setMaterialsByGroupId(previous => {
        const { [projectId]: _deleted, ...remaining } = previous;
        return remaining;
      });
      setCalendarEventsByGroupId(previous => {
        const { [projectId]: _deleted, ...remaining } = previous;
        return remaining;
      });
      setCurrentGroupIndex(currentIndex => nextGroupIndexAfterDeletion(currentIndex, deletedIndex, groups.length));
    } else {
      setGroups(prev => prev.filter(g => g.id !== projectId));
      setCurrentGroupIndex(0);
    }
  }, [canPersist, groups, user?.id]);

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
      addStoredMaterial,
      deleteStoredMaterial,
      appendTaskEvidence,
      lecturerStudentReviews,
      studentBadges,
      addLecturerStudentEvaluation,
      applyAgentSnapshot,
      calendarEvents,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      createProject,
      createProjects,
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
      addStoredMaterial,
      deleteStoredMaterial,
      appendTaskEvidence,
      lecturerStudentReviews,
      studentBadges,
      addLecturerStudentEvaluation,
      applyAgentSnapshot,
      calendarEvents,
      addCalendarEvent,
      updateCalendarEvent,
      deleteCalendarEvent,
      createProject,
      createProjects,
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
