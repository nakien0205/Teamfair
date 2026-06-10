import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  Copy,
  Crown,
  Download,
  Filter,
  Layers3,
  Mail,
  MailPlus,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
  UserMinus,
  UserPlus,
  Users,
  AlertTriangle,
  CheckCircle2,
  Clock3,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useNotifications } from "@/context/NotificationContext";
import { useTeam } from "@/context/TeamContext";
import { useToast } from "@/hooks/use-toast";
import { tr } from "@/lib/i18n";
import { fetchGradesForGroups, fetchRubricSummaries, type RubricGradeListRow, type RubricSummary } from "@/lib/rubricPersistence";
import { supabase } from "@/lib/supabaseClient";
import {
  assignGroupLeader,
  createGroupEmailInvite,
  listGroupEmailInvites,
  removeGroupMember,
  revokeGroupEmailInvite,
  sendGroupEmailInviteEmail,
  type GroupEmailInvite,
} from "@/lib/teamPersistence";
import {
  dedupeLecturerMemberImportRows,
  parseLecturerMemberImport,
  parseLecturerMemberImportFile,
} from "@/lib/lecturerGroupImport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationItem, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { SearchableGroupSelect } from "@/components/SearchableGroupSelect";

const GROUP_TYPES = {
  class: { label: "Lớp học" },
  course: { label: "Môn học" },
  project: { label: "Project" },
} as const;

type GroupTypeKey = keyof typeof GROUP_TYPES;
type LecturerGroupsTab = "setup" | "invites" | "members" | "scores";
type GroupStatusFilter = "all" | "active" | "attention" | "no_leader" | "ungraded" | "draft" | "submitted" | "locked";
type GroupSortOption = "newest" | "name_asc" | "progress_desc" | "attention_first";
type GroupRubricStatus = "missing_rubric" | "ungraded" | "draft" | "submitted" | "locked";

const INVITE_PAGE_SIZE = 6;
const MEMBER_PAGE_SIZE = 8;

function getScaledRubricScore(grade: RubricGradeListRow | null) {
  if (!grade || !grade.max_total_score) return null;
  return Math.round(((grade.total_score / grade.max_total_score) * 10) * 10) / 10;
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function inviteStatusLabel(status: GroupEmailInvite["status"]) {
  switch (status) {
    case "accepted":
      return "Đã chấp nhận";
    case "rejected":
      return "Đã từ chối";
    case "revoked":
      return "Đã thu hồi";
    case "pending":
      return "Chờ xử lý";
    default:
      return "Đã gửi";
  }
}

function splitGroupLabel(groupName: string) {
  const [prefix, ...rest] = groupName.split(":");
  if (rest.length === 0) {
    return { category: "Nhóm", title: groupName };
  }
  return {
    category: prefix.trim(),
    title: rest.join(":").trim(),
  };
}

function getLatestGroupTimestamp(group: { activityLog: { timestamp: Date }[] }) {
  if (!group.activityLog.length) return 0;
  return Math.max(...group.activityLog.map(entry => entry.timestamp.getTime()));
}

function getOverdueTaskCount(group: { tasks: { deadline: string; status: string; approved: boolean }[] }) {
  const now = new Date();
  return group.tasks.filter(task => {
    if (!task.deadline) return false;
    const deadline = new Date(task.deadline);
    if (Number.isNaN(deadline.getTime())) return false;
    return deadline.getTime() < now.getTime() && task.status !== "Done" && !task.approved;
  }).length;
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "NA";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function getProgressTone(progressPercent: number) {
  if (progressPercent >= 80) return "bg-emerald-500";
  if (progressPercent >= 50) return "bg-indigo-500";
  if (progressPercent > 0) return "bg-amber-500";
  return "bg-slate-300";
}

function PaginationControls({
  label,
  page,
  totalPages,
  onChange,
}: {
  label: string;
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const prevDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <Pagination className="justify-end">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            href="#"
            aria-disabled={prevDisabled}
            onClick={(event) => {
              event.preventDefault();
              if (!prevDisabled) onChange(page - 1);
            }}
          />
        </PaginationItem>
        <PaginationItem>
          <span className="flex h-9 items-center px-3 text-sm text-muted-foreground">
            {label} {page}/{totalPages}
          </span>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext
            href="#"
            aria-disabled={nextDisabled}
            onClick={(event) => {
              event.preventDefault();
              if (!nextDisabled) onChange(page + 1);
            }}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}

const LecturerGroupsPage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const { profile, user, loading: authLoading } = useAuth();
  const { sendNotification } = useNotifications();
  const {
    groups,
    currentGroupIndex,
    setCurrentGroupIndex,
    createProject,
    deleteProject,
    dataLoading,
    loadPersistedState,
  } = useTeam();

  const [activeTab, setActiveTab] = useState<LecturerGroupsTab>("setup");
  const [groupType, setGroupType] = useState<GroupTypeKey>("project");
  const [groupName, setGroupName] = useState("");
  const [memberImportRows, setMemberImportRows] = useState<string[]>([]);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupPage, setGroupPage] = useState(1);
  const [groupRowsPerPage, setGroupRowsPerPage] = useState(6);
  const [invitePage, setInvitePage] = useState(1);
  const [memberPage, setMemberPage] = useState(1);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteNote, setInviteNote] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<GroupStatusFilter>("all");
  const [sortBy, setSortBy] = useState<GroupSortOption>("newest");
  const [inviteRows, setInviteRows] = useState<GroupEmailInvite[]>([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteReloading, setInviteReloading] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState<string | null>(null);
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null);
  const [detailGroupId, setDetailGroupId] = useState<string | null>(null);
  const [resolvedNamesById, setResolvedNamesById] = useState<Record<string, string>>({});
  const [rubricSummaries, setRubricSummaries] = useState<RubricSummary[]>([]);
  const [rubricGrades, setRubricGrades] = useState<RubricGradeListRow[]>([]);
  const [gradingLoading, setGradingLoading] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedGroup = useMemo(() => {
    if (!groups.length) return null;
    return groups.find(group => group.id === selectedGroupId) ?? groups[currentGroupIndex] ?? groups[0] ?? null;
  }, [groups, currentGroupIndex, selectedGroupId]);

  const totalInvitePages = Math.max(1, Math.ceil(inviteRows.length / INVITE_PAGE_SIZE));
  const totalMemberPages = Math.max(1, Math.ceil((selectedGroup?.members.length ?? 0) / MEMBER_PAGE_SIZE));

  const paginatedInvites = useMemo(() => {
    const start = (invitePage - 1) * INVITE_PAGE_SIZE;
    return inviteRows.slice(start, start + INVITE_PAGE_SIZE);
  }, [inviteRows, invitePage]);

  const paginatedMembers = useMemo(() => {
    if (!selectedGroup) return [];
    const start = (memberPage - 1) * MEMBER_PAGE_SIZE;
    return selectedGroup.members.slice(start, start + MEMBER_PAGE_SIZE);
  }, [memberPage, selectedGroup]);

  const detailGroup = useMemo(
    () => groups.find(group => group.id === detailGroupId) ?? null,
    [detailGroupId, groups],
  );

  const selectedGroupAverage = useMemo(() => {
    if (!selectedGroup) return null;
    const values = selectedGroup.members
      .map(member => member.lecturerScore)
      .filter((score): score is number => typeof score === "number");
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, [selectedGroup]);

  const importPreview = useMemo(() => {
    const rows = dedupeLecturerMemberImportRows(parseLecturerMemberImport(memberImportRows.join("\n")));
    return rows;
  }, [memberImportRows]);

  const totalMembers = useMemo(() => groups.reduce((sum, group) => sum + group.members.length, 0), [groups]);
  const totalTasks = useMemo(() => groups.reduce((sum, group) => sum + group.tasks.length, 0), [groups]);
  const totalSubmittedGrades = useMemo(
    () => rubricGrades.filter((grade) => grade.status === "submitted" || grade.status === "locked").length,
    [rubricGrades],
  );
  const projectOptions = useMemo(() => ["all", ...groups.map(group => group.name)], [groups]);

  useEffect(() => {
    const memberIds = Array.from(
      new Set(
        groups
          .flatMap(group => group.members.map(member => member.id))
          .filter((id): id is string => Boolean(id) && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)),
      ),
    );

    if (memberIds.length === 0) {
      setResolvedNamesById({});
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id,full_name")
        .in("id", memberIds);

      if (cancelled) return;
      if (error) {
        console.warn("Failed to resolve group member names:", error);
        return;
      }

      const nextMap: Record<string, string> = {};
      for (const row of data ?? []) {
        if (row?.id && typeof row.full_name === "string" && row.full_name.trim()) {
          nextMap[row.id] = row.full_name.trim();
        }
      }
      setResolvedNamesById(nextMap);
    })();

    return () => {
      cancelled = true;
    };
  }, [groups]);

  useEffect(() => {
    if (!groups.length) {
      setRubricSummaries([]);
      setRubricGrades([]);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setGradingLoading(true);
        const [summaries, grades] = await Promise.all([
          fetchRubricSummaries(),
          fetchGradesForGroups(groups.map((group) => group.id)),
        ]);

        if (cancelled) return;

        setRubricSummaries(summaries);
        setRubricGrades(grades);
      } catch (error) {
        if (cancelled) return;
        console.warn("Failed to load rubric grading data:", error);
        setRubricSummaries([]);
        setRubricGrades([]);
      } finally {
        if (!cancelled) setGradingLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [groups]);

  const resolveMemberName = useCallback((member: typeof groups[number]["members"][number]) => {
    const key = member.id ?? "";
    return (key && resolvedNamesById[key]) || member.name;
  }, [resolvedNamesById]);

  const rubricSummariesByGroupId = useMemo(() => {
    return rubricSummaries.reduce<Record<string, RubricSummary[]>>((accumulator, summary) => {
      const groupId = summary.rubric.project_id;
      if (!accumulator[groupId]) accumulator[groupId] = [];
      accumulator[groupId].push(summary);
      return accumulator;
    }, {});
  }, [rubricSummaries]);

  const latestRubricGradeByGroupId = useMemo(() => {
    return rubricGrades.reduce<Record<string, RubricGradeListRow>>((accumulator, grade) => {
      const existing = accumulator[grade.group_id];
      if (!existing || new Date(grade.updated_at).getTime() > new Date(existing.updated_at).getTime()) {
        accumulator[grade.group_id] = grade;
      }
      return accumulator;
    }, {});
  }, [rubricGrades]);

  const getGroupRubrics = useCallback((groupId: string) => {
    return rubricSummariesByGroupId[groupId] ?? [];
  }, [rubricSummariesByGroupId]);

  const getLatestRubricGrade = useCallback((groupId: string) => {
    return latestRubricGradeByGroupId[groupId] ?? null;
  }, [latestRubricGradeByGroupId]);

  const selectedGroupRubrics = useMemo(
    () => (selectedGroup ? getGroupRubrics(selectedGroup.id) : []),
    [getGroupRubrics, selectedGroup],
  );
  const selectedGroupActiveRubrics = useMemo(
    () => selectedGroupRubrics.filter((summary) => summary.rubric.status === "active"),
    [selectedGroupRubrics],
  );
  const selectedGroupLatestGrade = useMemo(
    () => (selectedGroup ? getLatestRubricGrade(selectedGroup.id) : null),
    [getLatestRubricGrade, selectedGroup],
  );
  const selectedGroupRubricScore = useMemo(
    () => getScaledRubricScore(selectedGroupLatestGrade),
    [selectedGroupLatestGrade],
  );
  const selectedGroupGradingStatus = useMemo<GroupRubricStatus>(() => {
    if (!selectedGroup) return "ungraded";
    if (selectedGroupActiveRubrics.length === 0) return "missing_rubric";
    if (selectedGroupLatestGrade?.status === "locked") return "locked";
    if (selectedGroupLatestGrade?.status === "submitted") return "submitted";
    if (selectedGroupLatestGrade?.status === "draft") return "draft";
    return "ungraded";
  }, [selectedGroup, selectedGroupActiveRubrics.length, selectedGroupLatestGrade]);

  const openGroupGrading = useCallback((groupId: string) => {
    const activeRubrics = getGroupRubrics(groupId).filter((summary) => summary.rubric.status === "active");
    if (activeRubrics.length === 0) {
      navigate(`/lecturer/rubrics/upload?projectId=${groupId}`);
      return;
    }

    navigate(`/lecturer/grading/projects/${groupId}/groups/${groupId}`);
  }, [getGroupRubrics, navigate]);

  const getGroupLeaderName = useCallback(
    (group: typeof groups[number]) => {
      const leader = group.members.find(member => member.role === "Leader");
      return leader ? resolveMemberName(leader) : tr(language, "Chưa cập nhật", "Not set");
    },
    [language, resolveMemberName],
  );

  const getGroupAverage = useCallback((group: typeof groups[number]) => {
    const values = group.members
      .map(member => member.lecturerScore)
      .filter((score): score is number => typeof score === "number");
    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }, []);

  const getGroupMetrics = useCallback((group: typeof groups[number]) => {
    const leaderName = getGroupLeaderName(group);
    const completedTasks = group.tasks.filter(task => task.status === "Done" || task.approved).length;
    const totalTaskCount = group.tasks.length;
    const progressPercent = totalTaskCount > 0 ? Math.round((completedTasks / totalTaskCount) * 100) : 0;
    const overdueTasks = getOverdueTaskCount(group);
    const rubrics = getGroupRubrics(group.id);
    const activeRubrics = rubrics.filter((summary) => summary.rubric.status === "active");
    const latestGrade = getLatestRubricGrade(group.id);
    const groupScore = getScaledRubricScore(latestGrade);
    const hasLeader = leaderName !== tr(language, "Chưa cập nhật", "Not set");
    const gradingStatus: GroupRubricStatus =
      activeRubrics.length === 0
        ? "missing_rubric"
        : latestGrade?.status === "locked"
          ? "locked"
          : latestGrade?.status === "submitted"
            ? "submitted"
            : latestGrade?.status === "draft"
              ? "draft"
              : "ungraded";
    const needsAttention =
      overdueTasks > 0
      || !hasLeader
      || activeRubrics.length === 0
      || gradingStatus === "draft"
      || (totalTaskCount > 0 && progressPercent < 50);

    return {
      leaderName,
      completedTasks,
      totalTaskCount,
      progressPercent,
      overdueTasks,
      activeRubricCount: activeRubrics.length,
      latestRubricName: latestGrade?.rubrics?.name ?? activeRubrics[0]?.rubric.name ?? null,
      groupScore,
      latestGrade,
      hasLeader,
      gradingStatus,
      needsAttention,
      latestTimestamp: getLatestGroupTimestamp(group),
    };
  }, [getGroupLeaderName, getGroupRubrics, getLatestRubricGrade, language]);

  const getGradingMeta = useCallback((status: GroupRubricStatus) => {
    if (status === "submitted") {
      return {
        label: tr(language, "Đã gửi", "Submitted"),
        dot: "bg-emerald-500",
        badge: "bg-emerald-50 text-emerald-700",
      };
    }
    if (status === "locked") {
      return {
        label: tr(language, "Đã khóa", "Locked"),
        dot: "bg-slate-500",
        badge: "bg-slate-200 text-slate-700",
      };
    }
    if (status === "draft") {
      return {
        label: tr(language, "Bản nháp", "Draft"),
        dot: "bg-indigo-500",
        badge: "bg-indigo-50 text-indigo-700",
      };
    }
    if (status === "missing_rubric") {
      return {
        label: tr(language, "Chưa có rubric", "No rubric"),
        dot: "bg-amber-500",
        badge: "bg-amber-50 text-amber-700",
      };
    }
    return {
      label: tr(language, "Chưa chấm", "Ungraded"),
      dot: "bg-amber-500",
      badge: "bg-amber-50 text-amber-700",
    };
  }, [language]);

  const detailGroupMetrics = useMemo(
    () => (detailGroup ? getGroupMetrics(detailGroup) : null),
    [detailGroup, getGroupMetrics],
  );

  const filteredGroups = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const filtered = groups.filter(group => {
      const metrics = getGroupMetrics(group);
      const code = `#${group.id.slice(0, 8)}`.toLowerCase();
      const matchesSearch = !normalizedSearch
        || group.name.toLowerCase().includes(normalizedSearch)
        || code.includes(normalizedSearch)
        || metrics.leaderName.toLowerCase().includes(normalizedSearch);

      const matchesProject = projectFilter === "all" || group.name === projectFilter;
      const matchesStatus = statusFilter === "all"
        || (statusFilter === "active" && !metrics.needsAttention && metrics.hasLeader)
        || (statusFilter === "attention" && metrics.needsAttention)
        || (statusFilter === "no_leader" && !metrics.hasLeader)
        || (statusFilter === "locked" && metrics.gradingStatus === "locked")
        || (statusFilter === "ungraded" && (metrics.gradingStatus === "ungraded" || metrics.gradingStatus === "missing_rubric"))
        || statusFilter === metrics.gradingStatus;

      return matchesSearch && matchesProject && matchesStatus;
    });

    return [...filtered].sort((left, right) => {
      const leftMetrics = getGroupMetrics(left);
      const rightMetrics = getGroupMetrics(right);

      switch (sortBy) {
        case "name_asc":
          return left.name.localeCompare(right.name);
        case "progress_desc":
          return rightMetrics.progressPercent - leftMetrics.progressPercent;
        case "attention_first":
          return Number(rightMetrics.needsAttention) - Number(leftMetrics.needsAttention)
            || rightMetrics.overdueTasks - leftMetrics.overdueTasks;
        case "newest":
        default:
          return rightMetrics.latestTimestamp - leftMetrics.latestTimestamp;
      }
    });
  }, [getGroupMetrics, groups, projectFilter, searchQuery, sortBy, statusFilter]);

  const totalGroupPages = Math.max(1, Math.ceil(filteredGroups.length / groupRowsPerPage));
  const paginatedGroups = useMemo(() => {
    const start = (groupPage - 1) * groupRowsPerPage;
    return filteredGroups.slice(start, start + groupRowsPerPage);
  }, [filteredGroups, groupPage, groupRowsPerPage]);
  const attentionGroupCount = useMemo(() => groups.filter(group => getGroupMetrics(group).needsAttention).length, [getGroupMetrics, groups]);

  useEffect(() => {
    if (authLoading) return;
    if (profile?.role === "student") {
      navigate("/student/dashboard", { replace: true });
    }
  }, [authLoading, navigate, profile?.role]);

  useEffect(() => {
    if (groups.length === 0) {
      setSelectedGroupId("");
      return;
    }

    if (selectedGroupId && groups.some(group => group.id === selectedGroupId)) return;

    const fallbackGroup = groups[currentGroupIndex] ?? groups[0];
    if (fallbackGroup) {
      setSelectedGroupId(fallbackGroup.id);
      const fallbackIndex = groups.findIndex(group => group.id === fallbackGroup.id);
      if (fallbackIndex !== -1) {
        setGroupPage(Math.floor(fallbackIndex / groupRowsPerPage) + 1);
      }
    }
  }, [currentGroupIndex, groupRowsPerPage, groups, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroup) return;
    const index = groups.findIndex(group => group.id === selectedGroup.id);
    if (index !== -1 && index !== currentGroupIndex) {
      setCurrentGroupIndex(index);
    }
    setMemberPage(1);
    setInvitePage(1);
  }, [currentGroupIndex, groups, selectedGroup, setCurrentGroupIndex]);

  useEffect(() => {
    if (!selectedGroup?.id) {
      setInviteRows([]);
      return;
    }

    let cancelled = false;
    setInviteReloading(true);
    void listGroupEmailInvites(selectedGroup.id)
      .then(rows => {
        if (!cancelled) setInviteRows(rows);
      })
      .catch(error => {
        if (!cancelled) {
          console.error("Failed to load invites:", error);
          toast({
            title: tr(language, "KhÃ´ng táº£i Ä‘Æ°á»£c lá»i má»i", "Could not load invites"),
            description: error instanceof Error ? error.message : String(error),
            variant: "destructive",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setInviteReloading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [language, selectedGroup?.id, toast]);

  useEffect(() => {
    if (groupPage > totalGroupPages) setGroupPage(totalGroupPages);
  }, [groupPage, totalGroupPages]);

  useEffect(() => {
    if (invitePage > totalInvitePages) setInvitePage(totalInvitePages);
  }, [invitePage, totalInvitePages]);

  useEffect(() => {
    if (memberPage > totalMemberPages) setMemberPage(totalMemberPages);
  }, [memberPage, totalMemberPages]);

  const handleSelectGroup = (groupId: string) => {
    const index = groups.findIndex(group => group.id === groupId);
    if (index === -1) return;
    setSelectedGroupId(groupId);
    setCurrentGroupIndex(index);
    setGroupPage(Math.floor(index / groupRowsPerPage) + 1);
  };

  const handleCreateGroup = async () => {
    const name = groupName.trim();
    if (!name) {
      toast({
        title: tr(language, "Thiáº¿u tÃªn nhÃ³m", "Missing group name"),
        description: tr(language, "Nháº­p tÃªn lá»›p, mÃ´n há»c hoáº·c project trÆ°á»›c khi táº¡o.", "Enter a class, course, or project name before creating."),
        variant: "destructive",
      });
      return;
    }

    setCreateLoading(true);
    try {
      const displayName = `${GROUP_TYPES[groupType].label}: ${name}`;
      const newId = await createProject(displayName);
      setGroupName("");
      setSelectedGroupId(newId);
      setImportDialogOpen(false);
      setActiveTab("invites");
      toast({
        title: tr(language, "ÄÃ£ táº¡o nhÃ³m", "Group created"),
        description: tr(language, `${displayName} da san sang de moi thanh vien.`, `${displayName} is ready for invitations.`),
      });
    } catch (error) {
      console.error("Create group failed:", error);
      toast({
        title: tr(language, "KhÃ´ng táº¡o Ä‘Æ°á»£c nhÃ³m", "Could not create group"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const handlePickImportFile = () => {
    importFileInputRef.current?.click();
  };

  const handleImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setBulkLoading(true);
    try {
      const rows = await parseLecturerMemberImportFile(file);
      if (!rows.length) {
        toast({
          title: tr(language, "File trá»‘ng", "Empty file"),
          description: tr(language, "KhÃ´ng tÃ¬m tháº¥y email thÃ nh viÃªn há»£p lá»‡ trong file.", "No valid member emails were found in the file."),
          variant: "destructive",
        });
        return;
      }

      const lines = rows.map(row => row.note ? `${row.email} | ${row.note}` : row.email);
      setMemberImportRows(prev => [...prev, ...lines]);
      toast({
        title: tr(language, "ÄÃ£ náº¡p file", "File loaded"),
        description: tr(language, `${rows.length} thanh vien da duoc them vao danh sach cho import.`, `${rows.length} members were added to the import queue.`),
      });
    } catch (error) {
      console.error("Import file failed:", error);
      toast({
        title: tr(language, "KhÃ´ng Ä‘á»c Ä‘Æ°á»£c file", "Could not read file"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkImport = async () => {
    const rows = importPreview;
    if (!rows.length) {
      toast({
        title: tr(language, "Danh sÃ¡ch trá»‘ng", "Empty list"),
        description: tr(language, "Táº£i file .xlsx danh sÃ¡ch thÃ nh viÃªn trÆ°á»›c khi import.", "Upload a member .xlsx file before importing."),
        variant: "destructive",
      });
      return;
    }

    if (!selectedGroup) {
      toast({
        title: tr(language, "Chá»n nhÃ³m trÆ°á»›c", "Select a group first"),
        description: tr(language, "Báº¡n cáº§n chá»n má»™t nhÃ³m Ä‘Ã­ch Ä‘á»ƒ import thÃ nh viÃªn.", "You need to choose a target group before importing members."),
        variant: "destructive",
      });
      return;
    }

    setBulkLoading(true);
    try {
      let successCount = 0;
      const failedRows: string[] = [];

      for (const row of rows) {
        try {
          const { invite, recipient } = await createGroupEmailInvite(selectedGroup.id, row.email, row.note);

          try {
            await sendGroupEmailInviteEmail({
              recipientEmail: row.email,
              senderName: profile?.full_name || profile?.email || "Lecturer",
              groupName: selectedGroup.name,
              inviteCode: invite.invite_code,
              note: row.note ?? null,
            });
          } catch (emailError) {
            console.warn("Bulk email delivery failed:", emailError);
          }

          if (recipient) {
            await sendNotification(
              recipient.id,
              profile?.full_name || profile?.email || "Lecturer",
              `Ban duoc moi vao nhom "${selectedGroup.name}". Ma tham gia: ${invite.invite_code}.`,
            );
          }

          successCount += 1;
        } catch (rowError) {
          console.warn("Bulk member import row failed:", rowError);
          failedRows.push(row.note ? `${row.email} | ${row.note}` : row.email);
        }
      }

      setMemberImportRows(failedRows);
      await loadPersistedState();
      await listGroupEmailInvites(selectedGroup.id).then(setInviteRows);

      if (successCount > 0) {
        setImportDialogOpen(failedRows.length > 0);
        setActiveTab("invites");
      }

      toast({
        title: failedRows.length > 0
          ? tr(language, "Import thÃ nh viÃªn cÃ³ lá»—i", "Member import completed with errors")
          : tr(language, "ÄÃ£ import thÃ nh viÃªn", "Members imported"),
        description: failedRows.length > 0
          ? tr(language, `${successCount} thanh vien da duoc moi, ${failedRows.length} dong can kiem tra lai.`, `${successCount} members were invited, ${failedRows.length} rows need review.`)
          : tr(language, `${successCount} thanh vien da duoc moi vao nhom.`, `${successCount} members were invited to the group.`),
      });
    } catch (error) {
      console.error("Bulk import failed:", error);
      toast({
        title: tr(language, "KhÃ´ng import Ä‘Æ°á»£c", "Import failed"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const handleInviteByEmail = async () => {
    if (!selectedGroup) {
      toast({
        title: tr(language, "Chá»n nhÃ³m trÆ°á»›c", "Select a group first"),
        description: tr(language, "Báº¡n cáº§n chá»n má»™t nhÃ³m Ä‘á»ƒ má»i thÃ nh viÃªn.", "You need to choose a group before inviting members."),
        variant: "destructive",
      });
      return;
    }

    const email = inviteEmail.trim();
    if (!isValidEmail(email)) {
      toast({
        title: tr(language, "Email khÃ´ng há»£p lá»‡", "Invalid email"),
        description: tr(language, "Nháº­p Ä‘Ãºng Ä‘á»‹nh dáº¡ng email.", "Enter a valid email address."),
        variant: "destructive",
      });
      return;
    }

    setInviteLoading(true);
    try {
      const { invite, recipient } = await createGroupEmailInvite(selectedGroup.id, email, inviteNote.trim() || null);

      let emailStatus: "sent" | "skipped" | "failed" = "sent";
      try {
        const delivery = await sendGroupEmailInviteEmail({
          recipientEmail: email,
          senderName: profile?.full_name || profile?.email || "Lecturer",
          groupName: selectedGroup.name,
          inviteCode: invite.invite_code,
          note: inviteNote.trim() || null,
        });
        if (delivery.skipped) {
          emailStatus = "skipped";
        }
      } catch (emailError) {
        emailStatus = "failed";
        console.warn("Email delivery failed:", emailError);
      }

      if (recipient) {
        await sendNotification(
          recipient.id,
          profile?.full_name || profile?.email || "Lecturer",
          `Bạn được mời vào nhóm "${selectedGroup.name}". Mã tham gia: ${invite.invite_code}.`,
        );
      }

      await loadPersistedState();
      await listGroupEmailInvites(selectedGroup.id).then(setInviteRows);
      setInviteEmail("");
      setInviteNote("");

      toast({
        title: tr(language, "Đã gửi lời mời", "Invite sent"),
        description: emailStatus === "sent"
          ? tr(language, "Email đã được gửi và lời mời đã được lưu.", "The email was sent and the invite was saved.")
          : emailStatus === "skipped"
            ? tr(language, "Lời mời đã được lưu, nhưng dịch vụ email chưa được cấu hình.", "The invite was saved, but the email service is not configured yet.")
            : tr(language, "Lời mời đã được lưu, nhưng bước gửi email gặp lỗi.", "The invite was saved, but email delivery hit an error."),
      });
    } catch (error) {
      console.error("Invite by email failed:", error);
      toast({
        title: tr(language, "KhÃ´ng gá»­i Ä‘Æ°á»£c lá»i má»i", "Could not send invite"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCopyInviteText = async (invite: GroupEmailInvite) => {
    const groupNameText = selectedGroup?.name || "nhÃ³m";
    const inviteText = [
      `Bạn được mời vào nhóm: ${groupNameText}`,
      `Mã tham gia: ${invite.invite_code}`,
      `Mở /student/my-group để xem lời mời và chấp nhận hoặc từ chối`,
      invite.note ? `Ghi chú: ${invite.note}` : null,
    ].filter(Boolean).join("\n");

    await navigator.clipboard.writeText(inviteText);
    toast({
      title: tr(language, "Đã sao chép nội dung", "Invite text copied"),
      description: tr(language, "Bạn có thể dán nội dung này vào email thủ công.", "You can paste this into a manual email."),
    });
  };

  const handleCopyInviteCode = async (inviteCode: string) => {
    await navigator.clipboard.writeText(inviteCode);
    toast({
      title: tr(language, "Đã sao chép mã", "Invite code copied"),
      description: tr(language, "Mã tham gia đã được đưa vào clipboard.", "The join code is now on your clipboard."),
    });
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await revokeGroupEmailInvite(inviteId);
      if (selectedGroup?.id) {
        await listGroupEmailInvites(selectedGroup.id).then(setInviteRows);
      }
      toast({
        title: tr(language, "ÄÃ£ thu há»“i", "Invite revoked"),
        description: tr(language, "Lá»i má»i email Ä‘Ã£ bá»‹ thu há»“i.", "The email invite has been revoked."),
      });
    } catch (error) {
      console.error("Revoke invite failed:", error);
      toast({
        title: tr(language, "KhÃ´ng thá»ƒ thu há»“i", "Could not revoke"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const handleAssignLeader = async (memberId: string) => {
    if (!selectedGroup) return;
    setMemberActionLoading(memberId);
    try {
      await assignGroupLeader(selectedGroup.id, memberId);
      await loadPersistedState();
      toast({
        title: tr(language, "ÄÃ£ Ä‘á»•i nhÃ³m trÆ°á»Ÿng", "Leader assigned"),
        description: tr(language, "ThÃ nh viÃªn Ä‘Ã£ Ä‘Æ°á»£c chuyá»ƒn thÃ nh nhÃ³m trÆ°á»Ÿng.", "The member is now the group leader."),
      });
    } catch (error) {
      console.error("Assign leader failed:", error);
      toast({
        title: tr(language, "KhÃ´ng thá»ƒ Ä‘á»•i nhÃ³m trÆ°á»Ÿng", "Could not assign leader"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setMemberActionLoading(null);
    }
  };

  const handleKickMember = async (memberId: string, memberName: string) => {
    if (!selectedGroup) return;
    setMemberActionLoading(memberId);
    try {
      await removeGroupMember(selectedGroup.id, memberId);
      await loadPersistedState();
      toast({
        title: tr(language, "ÄÃ£ xÃ³a thÃ nh viÃªn", "Member removed"),
        description: tr(language, `${memberName} Ä‘Ã£ bá»‹ kick khá»i nhÃ³m.`, `${memberName} was removed from the group.`),
      });
    } catch (error) {
      console.error("Kick member failed:", error);
      toast({
        title: tr(language, "KhÃ´ng thá»ƒ kick thÃ nh viÃªn", "Could not remove member"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setMemberActionLoading(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteGroupId) return;
    try {
      await deleteProject(deleteGroupId);
      setDeleteGroupId(null);
      if (selectedGroup?.id === deleteGroupId && groups.length > 1) {
        const nextGroup = groups.find(group => group.id !== deleteGroupId);
        if (nextGroup) handleSelectGroup(nextGroup.id);
      }
      toast({
        title: tr(language, "ÄÃ£ xoÃ¡ nhÃ³m", "Group deleted"),
        description: tr(language, "NhÃ³m vÃ  dá»¯ liá»‡u liÃªn quan Ä‘Ã£ Ä‘Æ°á»£c xoÃ¡.", "The group and related data were removed."),
      });
    } catch (error) {
      console.error("Delete group failed:", error);
      toast({
        title: tr(language, "KhÃ´ng thá»ƒ xoÃ¡", "Delete failed"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const gradedRatio = groups.length > 0 ? Math.round((totalSubmittedGrades / groups.length) * 100) : 0;
  const visibleGroupStart = filteredGroups.length === 0 ? 0 : (groupPage - 1) * groupRowsPerPage + 1;
  const visibleGroupEnd = Math.min(groupPage * groupRowsPerPage, filteredGroups.length);
  const selectedGroupGradingMeta = getGradingMeta(selectedGroupGradingStatus);
  const kpiCards = [
    {
      label: tr(language, "Tổng nhóm", "Total groups"),
      value: groups.length,
      description: tr(language, "Nhóm đang quản lý", "Groups under management"),
      icon: Layers3,
      accent: "bg-indigo-50 text-indigo-700",
    },
    {
      label: tr(language, "Tổng thành viên", "Total members"),
      value: totalMembers,
      description: tr(language, `${totalTasks} task đang theo dõi`, `${totalTasks} tracked tasks`),
      icon: Users,
      accent: "bg-emerald-50 text-emerald-700",
    },
    {
      label: tr(language, "Nhóm đã chấm", "Graded groups"),
      value: `${totalSubmittedGrades}/${groups.length}`,
      description: tr(language, "Đã gửi hoặc khóa rubric", "Submitted or locked rubric grades"),
      icon: ClipboardList,
      accent: "bg-sky-50 text-sky-700",
      progress: gradedRatio,
    },
    {
      label: tr(language, "Cần chú ý", "Needs attention"),
      value: attentionGroupCount,
      description: tr(language, "Nhóm cần theo dõi", "Groups to follow up"),
      icon: AlertTriangle,
      accent: attentionGroupCount > 0 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-700",
    },
  ] as const;

  if (dataLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-8 w-56 rounded-xl" />
            <Skeleton className="h-4 w-[min(100%,42rem)] rounded-xl" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-14 w-56 rounded-2xl" />
            <Skeleton className="h-11 w-32 rounded-2xl" />
            <Skeleton className="h-11 w-36 rounded-2xl" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="rounded-[24px] border-border/60 shadow-sm">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24 rounded-full" />
                    <Skeleton className="h-8 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-12 w-12 rounded-2xl" />
                </div>
                <Skeleton className="h-3 w-32 rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="rounded-[28px] border-border/60 shadow-card">
          <CardHeader className="space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-2">
                <Skeleton className="h-6 w-40 rounded-full" />
                <Skeleton className="h-4 w-[min(100%,32rem)] rounded-full" />
              </div>
              <div className="flex flex-wrap gap-3">
                <Skeleton className="h-11 w-72 rounded-2xl" />
                <Skeleton className="h-11 w-44 rounded-2xl" />
                <Skeleton className="h-11 w-44 rounded-2xl" />
                <Skeleton className="h-11 w-44 rounded-2xl" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-20 rounded-2xl" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1480px] space-y-5">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map(card => (
          <Card key={card.label} className="rounded-[20px] border-slate-200/80 bg-white shadow-sm">
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-slate-500">{card.label}</p>
                  <p className="text-[1.7rem] font-semibold leading-none tracking-tight text-slate-950">{card.value}</p>
                </div>
                <div className={cn("rounded-xl p-2.5", card.accent)}>
                  <card.icon className="h-4 w-4" />
                </div>
              </div>
              <p className="text-xs text-slate-500">{card.description}</p>
              {"progress" in card ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{tr(language, "Tiến độ chấm", "Grading progress")}</span>
                    <span>{card.progress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${card.progress}%` }} />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as LecturerGroupsTab)} className="space-y-5">
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          <TabsList className="flex flex-nowrap gap-2 overflow-x-auto rounded-full border border-white/60 bg-white/70 p-1 shadow-[0_18px_50px_-28px_rgba(15,23,42,0.35)] backdrop-blur-2xl">
            <TabsTrigger value="setup" className="whitespace-nowrap rounded-full border border-transparent px-4 py-2 transition-all duration-300 ease-out data-[state=active]:animate-liquid-pop data-[state=active]:border-white/70 data-[state=active]:bg-gradient-to-br data-[state=active]:from-white data-[state=active]:to-indigo-50 data-[state=active]:text-indigo-900 data-[state=active]:shadow-[0_10px_28px_-18px_rgba(79,70,229,0.45)] hover:-translate-y-0.5">
              {tr(language, "Nhóm", "Groups")}
            </TabsTrigger>
            <TabsTrigger value="invites" className="whitespace-nowrap rounded-full border border-transparent px-4 py-2 transition-all duration-300 ease-out data-[state=active]:animate-liquid-pop data-[state=active]:border-white/70 data-[state=active]:bg-gradient-to-br data-[state=active]:from-white data-[state=active]:to-indigo-50 data-[state=active]:text-indigo-900 data-[state=active]:shadow-[0_10px_28px_-18px_rgba(79,70,229,0.45)] hover:-translate-y-0.5">
              {tr(language, "Lời mời", "Invites")}
            </TabsTrigger>
            <TabsTrigger value="members" className="whitespace-nowrap rounded-full border border-transparent px-4 py-2 transition-all duration-300 ease-out data-[state=active]:animate-liquid-pop data-[state=active]:border-white/70 data-[state=active]:bg-gradient-to-br data-[state=active]:from-white data-[state=active]:to-indigo-50 data-[state=active]:text-indigo-900 data-[state=active]:shadow-[0_10px_28px_-18px_rgba(79,70,229,0.45)] hover:-translate-y-0.5">
              {tr(language, "Thành viên", "Members")}
            </TabsTrigger>
            <TabsTrigger value="scores" className="whitespace-nowrap rounded-full border border-transparent px-4 py-2 transition-all duration-300 ease-out data-[state=active]:animate-liquid-pop data-[state=active]:border-white/70 data-[state=active]:bg-gradient-to-br data-[state=active]:from-white data-[state=active]:to-indigo-50 data-[state=active]:text-indigo-900 data-[state=active]:shadow-[0_10px_28px_-18px_rgba(79,70,229,0.45)] hover:-translate-y-0.5">
              {tr(language, "Điểm", "Scores")}
            </TabsTrigger>
          </TabsList>

          <Button
            className="h-10 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-blue-500"
            onClick={() => setImportDialogOpen(true)}
          >
            <Plus className="mr-2 h-4 w-4" />
            {tr(language, "Tạo nhóm", "Create group")}
          </Button>
        </div>

        <TabsContent value="setup" className="space-y-6 animate-liquid-rise">
          <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
            <DialogContent className="sm:max-w-xl">
              <DialogHeader>
                <DialogTitle>{tr(language, "Tạo nhóm mới", "Create a new group")}</DialogTitle>
                <DialogDescription>
                  {tr(language, "Tạo lớp, môn học hoặc project trước. Sau đó bạn có thể import thành viên hoặc gửi lời mời ngay tại trang nhóm.", "Create the class, course, or project first. Then you can import members or send invitations directly on the groups page.")}
                </DialogDescription>
              </DialogHeader>
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle>{tr(language, "Tạo lớp / môn / project", "Create a class / course / project")}</CardTitle>
                  <CardDescription>
                    {tr(language, "Đặt tên theo đúng ngữ cảnh để sau này mời và quản lý nhóm dễ hơn.", "Use a clear name so invitations and management stay organized.")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="group-type">{tr(language, "Loại nhóm", "Group type")}</Label>
                    <Select value={groupType} onValueChange={(value) => setGroupType(value as GroupTypeKey)}>
                      <SelectTrigger id="group-type">
                        <SelectValue placeholder={tr(language, "Chọn loại", "Choose a type")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="class">{GROUP_TYPES.class.label}</SelectItem>
                        <SelectItem value="course">{GROUP_TYPES.course.label}</SelectItem>
                        <SelectItem value="project">{GROUP_TYPES.project.label}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="group-name">{tr(language, "Tên hiển thị", "Display name")}</Label>
                    <Input
                      id="group-name"
                      value={groupName}
                      onChange={(event) => setGroupName(event.target.value)}
                      placeholder="SE401 - Capstone"
                    />
                  </div>

                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                    {tr(
                      language,
                      `Tên sẽ được lưu theo dạng "${GROUP_TYPES[groupType].label}: tên bạn nhập".`,
                      `The stored name will look like "${GROUP_TYPES[groupType].label}: your name".`,
                    )}
                  </div>

                  <Button onClick={() => void handleCreateGroup()} disabled={createLoading} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />
                    {createLoading ? tr(language, "Đang tạo...", "Creating...") : tr(language, "Tạo nhóm mới", "Create group")}
                  </Button>
                </CardContent>
              </Card>

              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  {tr(language, "Đóng", "Close")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Card className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-sm">
            <CardHeader className="space-y-5 border-b border-slate-200/80 pb-5">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-[1.75rem] font-semibold tracking-tight text-slate-950">
                    {tr(language, "Danh sách nhóm", "Group list")}
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-500">
                    {tr(language, "So sánh tiến độ, leader, lời mời và trạng thái chấm điểm trên cùng một màn hình.", "Compare progress, leaders, invites, and grading status from one place.")}
                  </CardDescription>
                </div>
              </div>

              <div className="grid gap-3 lg:grid-cols-[1.2fr_0.85fr_0.85fr_0.85fr]">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        setGroupPage(1);
                      }}
                      placeholder={tr(language, "Tìm kiếm nhóm, mã nhóm, leader...", "Search groups, code, leader...")}
                      className="h-11 rounded-2xl border-slate-200 bg-slate-50 pl-10"
                    />
                </div>

                <Select value={projectFilter} onValueChange={(value) => { setProjectFilter(value); setGroupPage(1); }}>
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white shadow-sm">
                    <SelectValue placeholder={tr(language, "Tất cả dự án", "All projects")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr(language, "Tất cả dự án", "All projects")}</SelectItem>
                    {projectOptions.slice(1).map(projectName => (
                      <SelectItem key={projectName} value={projectName}>
                        {projectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value as GroupStatusFilter); setGroupPage(1); }}>
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white shadow-sm">
                    <Filter className="mr-2 h-4 w-4 text-slate-400" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr(language, "Tất cả", "All")}</SelectItem>
                    <SelectItem value="active">{tr(language, "Đang hoạt động", "Active")}</SelectItem>
                    <SelectItem value="attention">{tr(language, "Cần chú ý", "Needs attention")}</SelectItem>
                    <SelectItem value="no_leader">{tr(language, "Chưa có leader", "No leader")}</SelectItem>
                    <SelectItem value="ungraded">{tr(language, "Chưa chấm", "Ungraded")}</SelectItem>
                    <SelectItem value="draft">{tr(language, "Bản nháp", "Draft")}</SelectItem>
                    <SelectItem value="submitted">{tr(language, "Đã gửi", "Submitted")}</SelectItem>
                    <SelectItem value="locked">{tr(language, "Đã khóa", "Locked")}</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(value) => { setSortBy(value as GroupSortOption); setGroupPage(1); }}>
                  <SelectTrigger className="h-11 rounded-2xl border-slate-200 bg-white shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">{tr(language, "Mới nhất", "Newest")}</SelectItem>
                    <SelectItem value="name_asc">{tr(language, "Tên nhóm A-Z", "Group name A-Z")}</SelectItem>
                    <SelectItem value="progress_desc">{tr(language, "Tiến độ cao nhất", "Highest progress")}</SelectItem>
                    <SelectItem value="attention_first">{tr(language, "Cần chú ý trước", "Attention first")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 p-0">
              {groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
                  <div className="rounded-3xl bg-slate-100 p-4 text-slate-600">
                    <Users className="h-7 w-7" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-slate-950">{tr(language, "Chưa có nhóm sinh viên", "No student groups yet")}</h3>
                    <p className="max-w-xl text-sm leading-6 text-slate-500">
                      {tr(language, "Tạo nhóm đầu tiên hoặc mời sinh viên tham gia dự án để bắt đầu quản lý tiến độ.", "Create your first group or invite students into a project to start managing progress.")}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button
                      className="rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:from-indigo-500 hover:to-blue-500"
                      onClick={() => setImportDialogOpen(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {tr(language, "Tạo nhóm", "Create group")}
                    </Button>
                    <Button variant="outline" className="rounded-2xl" onClick={() => setActiveTab("invites")}>
                      <MailPlus className="mr-2 h-4 w-4" />
                      {tr(language, "Mời sinh viên", "Invite students")}
                    </Button>
                  </div>
                </div>
              ) : filteredGroups.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-slate-500">
                  {tr(language, "Không tìm thấy nhóm phù hợp với bộ lọc.", "No groups match the current filters.")}
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1480px] text-sm">
                      <thead className="bg-slate-50/95 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                        <tr>
                          <th className="whitespace-nowrap px-6 py-4 text-left font-medium">{tr(language, "Nhóm", "Group")}</th>
                          <th className="whitespace-nowrap px-4 py-4 text-left font-medium">{tr(language, "Nhóm trưởng", "Leader")}</th>
                          <th className="whitespace-nowrap px-4 py-4 text-left font-medium">{tr(language, "Thành viên", "Members")}</th>
                          <th className="whitespace-nowrap px-4 py-4 text-left font-medium">{tr(language, "Task hoàn thành", "Tasks completed")}</th>
                          <th className="whitespace-nowrap px-4 py-4 text-left font-medium">{tr(language, "Trễ hạn", "Overdue")}</th>
                          <th className="whitespace-nowrap px-4 py-4 text-left font-medium">{tr(language, "Trạng thái chấm", "Grading status")}</th>
                          <th className="whitespace-nowrap px-4 py-4 text-left font-medium">{tr(language, "Điểm nhóm", "Group score")}</th>
                          <th className="whitespace-nowrap px-4 py-4 text-left font-medium">{tr(language, "Cần chú ý", "Attention")}</th>
                          <th className="sticky right-0 z-20 whitespace-nowrap bg-slate-50/95 px-6 py-4 text-right font-medium shadow-[-18px_0_24px_-20px_rgba(15,23,42,0.22)]">{tr(language, "Hành động", "Actions")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedGroups.map(group => {
                          const groupMeta = splitGroupLabel(group.name);
                          const metrics = getGroupMetrics(group);
                          const isSelected = group.id === selectedGroup?.id;
                          const gradingMeta = getGradingMeta(metrics.gradingStatus);

                          return (
                            <tr
                              key={group.id}
                              role="link"
                              tabIndex={0}
                              className={cn(
                                "cursor-pointer border-t border-slate-200/80 transition-colors hover:bg-indigo-50/30 focus-visible:bg-indigo-50/40 focus-visible:outline-none",
                                isSelected && "bg-indigo-50/60",
                              )}
                              onClick={() => navigate(`/lecturer/groups/${group.id}`)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                  event.preventDefault();
                                  navigate(`/lecturer/groups/${group.id}`);
                                }
                              }}
                            >
                              <td className="px-6 py-4 align-top">
                                <div className="space-y-1">
                                  {isSelected ? (
                                    <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">
                                      {tr(language, "Đang chọn", "Selected")}
                                    </Badge>
                                  ) : null}
                                  <div className="text-[15px] font-semibold text-slate-950">{groupMeta.title}</div>
                                </div>
                              </td>

                              <td className="px-4 py-4 align-top">
                                {metrics.hasLeader ? (
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                                      {getInitials(metrics.leaderName)}
                                    </div>
                                    <div className="space-y-1">
                                      <div className="font-medium text-slate-900">{metrics.leaderName}</div>
                                      <Badge className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50">
                                        {tr(language, "Nhóm trưởng", "Leader")}
                                      </Badge>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start gap-3 text-amber-700">
                                    <div className="mt-0.5 rounded-full bg-amber-100 p-2">
                                      <AlertTriangle className="h-4 w-4" />
                                    </div>
                                    <div>
                                      <div className="font-medium">{tr(language, "Chưa có nhóm trưởng", "No leader assigned")}</div>
                                      <div className="text-xs text-amber-600">{tr(language, "Cần chỉ định người phụ trách nhóm", "Assign a leader to keep this group moving")}</div>
                                    </div>
                                  </div>
                                )}
                              </td>

                              <td className="px-4 py-4 align-top">
                                <div className="flex items-center gap-3">
                                  <div className="flex -space-x-2">
                                    {group.members.slice(0, 3).map(member => (
                                      <div
                                        key={member.id ?? member.name}
                                        className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-200 text-[11px] font-semibold text-slate-700"
                                      >
                                      {getInitials(resolveMemberName(member))}
                                      </div>
                                    ))}
                                    {group.members.length > 3 ? (
                                      <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-[11px] font-semibold text-white">
                                        +{group.members.length - 3}
                                      </div>
                                    ) : null}
                                  </div>
                                  <div className="text-sm font-medium text-slate-700">
                                    {group.members.length} {tr(language, "thành viên", "members")}
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-4 align-top">
                                <div className="min-w-[160px] space-y-2">
                                  <div className="flex items-center justify-between text-sm">
                                    <span className="font-medium text-slate-900">{metrics.completedTasks} / {metrics.totalTaskCount}</span>
                                    <span className="text-slate-500">{metrics.progressPercent}%</span>
                                  </div>
                                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                    <div
                                      className={cn("h-full rounded-full transition-all", getProgressTone(metrics.progressPercent))}
                                      style={{ width: `${metrics.progressPercent}%` }}
                                    />
                                  </div>
                                </div>
                              </td>

                              <td className="px-4 py-4 align-top">
                                <div className={cn("font-medium", metrics.overdueTasks > 0 ? "text-rose-600" : "text-slate-500")}>
                                  {metrics.overdueTasks > 0
                                    ? `${metrics.overdueTasks} ${tr(language, "task trễ hạn", "overdue tasks")}`
                                    : "0"}
                                </div>
                              </td>

                              <td className="px-4 py-4 align-top">
                                <div className={cn("inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium", gradingMeta.badge)}>
                                  <span className={cn("h-2 w-2 rounded-full", gradingMeta.dot)} />
                                  {gradingMeta.label}
                                </div>
                              </td>

                              <td className="px-4 py-4 align-top">
                                <div className="font-semibold text-slate-950">
                                  {metrics.groupScore !== null ? `${metrics.groupScore.toFixed(1)} / 10` : "—"}
                                </div>
                                <div className="mt-1 text-xs text-slate-500">
                                  {metrics.latestRubricName || tr(language, "Chưa chọn rubric", "No rubric selected")}
                                </div>
                              </td>

                              <td className="px-4 py-4 align-top">
                                {metrics.needsAttention ? (
                                  <span className={cn(
                                    "inline-block h-2.5 w-2.5 rounded-full",
                                    metrics.overdueTasks > 0 ? "bg-rose-500" : "bg-amber-400",
                                  )}
                                  />
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              <td
                                className="sticky right-0 z-10 bg-white px-6 py-4 align-top shadow-[-18px_0_24px_-20px_rgba(15,23,42,0.18)]"
                                onClick={(event) => event.stopPropagation()}
                                onKeyDown={(event) => event.stopPropagation()}
                              >
                                <div className="flex items-center justify-end gap-2">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-9 w-9 rounded-xl border border-slate-200"
                                        onClick={(event) => event.stopPropagation()}
                                      >
                                        <MoreHorizontal className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48">
                                      <DropdownMenuItem onClick={(event) => { event.stopPropagation(); openGroupGrading(group.id); }}>
                                        <ClipboardList className="mr-2 h-4 w-4" />
                                        {metrics.activeRubricCount > 0
                                          ? tr(language, "Mở workspace chấm", "Open grading workspace")
                                          : tr(language, "Tạo rubric để chấm", "Create rubric to grade")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(event) => { event.stopPropagation(); handleSelectGroup(group.id); setActiveTab("members"); }}>
                                        <Users className="mr-2 h-4 w-4" />
                                        {tr(language, "Thành viên", "Members")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(event) => { event.stopPropagation(); handleSelectGroup(group.id); setActiveTab("invites"); }}>
                                        <MailPlus className="mr-2 h-4 w-4" />
                                        {tr(language, "Mời email", "Invite email")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={(event) => { event.stopPropagation(); setDetailGroupId(group.id); }}>
                                        <Clock3 className="mr-2 h-4 w-4" />
                                        {tr(language, "Nhật ký hoạt động", "Activity log")}
                                      </DropdownMenuItem>
                                      <DropdownMenuItem className="text-rose-600 focus:text-rose-600" onClick={(event) => { event.stopPropagation(); setDeleteGroupId(group.id); }}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        {tr(language, "Xóa", "Delete")}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-col gap-4 border-t border-slate-200/80 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-500">
                      {tr(language, "Hiển thị", "Showing")} {visibleGroupStart}-{visibleGroupEnd} {tr(language, "trong", "of")} {filteredGroups.length} {tr(language, "nhóm", "groups")}
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      <Select
                        value={String(groupRowsPerPage)}
                        onValueChange={(value) => {
                          setGroupRowsPerPage(Number(value));
                          setGroupPage(1);
                        }}
                      >
                        <SelectTrigger className="h-9 w-[110px] rounded-xl border-slate-200 bg-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6">{tr(language, "6 / trang", "6 / page")}</SelectItem>
                          <SelectItem value="10">{tr(language, "10 / trang", "10 / page")}</SelectItem>
                          <SelectItem value="20">{tr(language, "20 / trang", "20 / page")}</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="rounded-full border border-slate-200 bg-white px-2 py-1 shadow-sm">
                        <PaginationControls
                          label={tr(language, "Trang", "Page")}
                          page={groupPage}
                          totalPages={totalGroupPages}
                          onChange={setGroupPage}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Dialog open={detailGroup !== null} onOpenChange={(open) => !open && setDetailGroupId(null)}>
            <DialogContent className="sm:max-w-4xl">
              {detailGroup ? (
                <>
                  <DialogHeader>
                    <DialogTitle>{detailGroup.name}</DialogTitle>
                    <DialogDescription>
                      {tr(language, "Xem nhanh toàn bộ thông tin nhóm và đi thẳng tới tác vụ bạn cần quản lý.", "Review the full group snapshot and jump directly into the management task you need.")}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                    <div className="space-y-4">
                      <div className="rounded-3xl border border-border/60 bg-muted/20 p-5">
                        <h3 className="text-2xl font-semibold">{splitGroupLabel(detailGroup.name).title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {tr(language, "Leader", "Leader")}: <span className="font-medium text-foreground">{getGroupLeaderName(detailGroup)}</span>
                        </p>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-border/60 bg-background p-4">
                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Thành viên", "Members")}</div>
                            <div className="mt-2 text-2xl font-semibold">{detailGroup.members.length}</div>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-background p-4">
                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Task", "Tasks")}</div>
                            <div className="mt-2 text-2xl font-semibold">{detailGroup.tasks.length}</div>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-background p-4">
                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Rubric hoạt động", "Active rubrics")}</div>
                            <div className="mt-2 text-2xl font-semibold">{detailGroupMetrics?.activeRubricCount ?? 0}</div>
                          </div>
                          <div className="rounded-2xl border border-border/60 bg-background p-4">
                            <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Điểm nhóm", "Group score")}</div>
                            <div className="mt-2 text-2xl font-semibold">{detailGroupMetrics?.groupScore !== null && detailGroupMetrics?.groupScore !== undefined ? `${detailGroupMetrics.groupScore.toFixed(1)} / 10` : "—"}</div>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-border/60 p-5">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold">{tr(language, "Thành viên hiện tại", "Current members")}</h4>
                          <span className="text-xs text-muted-foreground">{detailGroup.members.length}</span>
                        </div>
                        <div className="mt-4 space-y-3">
                          {detailGroup.members.length > 0 ? (
                            detailGroup.members.slice(0, 6).map(member => (
                              <div key={member.id ?? member.name} className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3">
                                <div>
                                  <div className="font-medium">{resolveMemberName(member)}</div>
                                  <div className="text-xs text-muted-foreground">{member.role}</div>
                                </div>
                                <div className="text-right text-xs text-muted-foreground">
                                  <div>{member.completedTasks} {tr(language, "task", "tasks")}</div>
                                  <div>{member.contributionPercent}%</div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                              {tr(language, "Nhóm này chưa có thành viên nào ngoài leader mặc định.", "This group has no members beyond the default leader yet.")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-3xl border border-border/60 p-5">
                        <h4 className="text-sm font-semibold">{tr(language, "Đi tắt quản lý", "Management shortcuts")}</h4>
                        <div className="mt-4 grid gap-2">
                          <Button
                            variant="outline"
                            className="justify-start"
                            onClick={() => {
                              handleSelectGroup(detailGroup.id);
                              setActiveTab("invites");
                              setDetailGroupId(null);
                            }}
                          >
                            <MailPlus className="mr-2 h-4 w-4" />
                            {tr(language, "Má»Ÿ lá»i má»i email", "Open email invites")}
                          </Button>
                          <Button
                            variant="outline"
                            className="justify-start"
                            onClick={() => {
                              handleSelectGroup(detailGroup.id);
                              setActiveTab("members");
                              setDetailGroupId(null);
                            }}
                          >
                            <Users className="mr-2 h-4 w-4" />
                            {tr(language, "Mở quản lý thành viên", "Open member management")}
                          </Button>
                          <Button
                            variant="outline"
                            className="justify-start"
                            onClick={() => {
                              openGroupGrading(detailGroup.id);
                              setDetailGroupId(null);
                            }}
                          >
                            <ClipboardList className="mr-2 h-4 w-4" />
                            {tr(language, "Mở chấm điểm", "Open grading")}
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-3xl border border-border/60 p-5">
                        <h4 className="text-sm font-semibold">{tr(language, "Hoạt động gần đây", "Recent activity")}</h4>
                        <div className="mt-4 space-y-3">
                          {detailGroup.activityLog.length > 0 ? (
                            detailGroup.activityLog.slice(0, 5).map((entry, index) => (
                              <div key={`${entry.description}-${index}`} className="rounded-2xl border border-border/60 px-4 py-3">
                                <div className="text-sm">{entry.description}</div>
                                <div className="mt-1 text-xs text-muted-foreground">{entry.timestamp.toLocaleString()}</div>
                              </div>
                            ))
                          ) : (
                            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground">
                              {tr(language, "Chưa có hoạt động nào được ghi nhận.", "No activity has been recorded yet.")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="invites" className="space-y-6 animate-liquid-rise">
          <Card className="border-border/60 shadow-card">
            <CardHeader>
              <CardTitle>{tr(language, "Import thành viên từ file", "Import members from file")}</CardTitle>
              <CardDescription>
                {tr(language, "Sau khi tạo nhóm, bạn có thể import danh sách thành viên bằng Excel hoặc tiếp tục mời từng người qua email ngay bên dưới.", "After creating a group, you can import member lists from Excel or continue inviting people one by one just below.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(event) => void handleImportFileChange(event)}
              />

              <div className="space-y-2">
                  <Label>{tr(language, "Nhóm đích", "Target group")}</Label>
                  <SearchableGroupSelect
                    groups={groups}
                    value={selectedGroup?.id ?? ""}
                    onChange={handleSelectGroup}
                    placeholder={tr(language, "Chọn nhóm để import thành viên", "Choose a group for member import")}
                    searchPlaceholder={tr(language, "Tìm nhóm để import...", "Search a group to import...")}
                    emptyText={tr(language, "Không tìm thấy nhóm nào.", "No group found.")}
                  />
                </div>

              <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{tr(language, "Định dạng file .xlsx chấp nhận", "Accepted .xlsx format")}</p>
                    <p className="text-sm text-muted-foreground">
                      {tr(language, "Sheet mẫu cần 2 cột: `Email` và `Ghi chu`.", "The template sheet needs 2 columns: `Email` and `Ghi chu`.")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {tr(language, "Mỗi dòng là một thành viên được mời. Cột `Ghi chu` là tùy chọn.", "Each row is one invited member. The `Ghi chu` column is optional.")}
                    </p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="shrink-0">
                    <a href="/templates/lecturer-member-import-template.xlsx" download>
                      <Download className="mr-2 h-4 w-4" />
                      {tr(language, "Tải file mẫu", "Download template")}
                    </a>
                  </Button>
                </div>
                <div className="mt-4 overflow-hidden rounded-xl border border-border/70 bg-background">
                  <div className="grid grid-cols-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-xs font-medium text-foreground">
                    <span>Email</span>
                    <span>Ghi chu</span>
                  </div>
                  {[
                    ["student1@example.edu", "Nhóm tuần 1"],
                    ["student2@example.edu", "Team mobile"],
                    ["student3@example.edu", ""],
                  ].map(([email, note]) => (
                    <div key={`${email}-${note}`} className="grid grid-cols-2 px-3 py-2 text-xs text-muted-foreground [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border/60">
                      <span>{email}</span>
                      <span>{note || "-"}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={handlePickImportFile} disabled={bulkLoading || !selectedGroup}>
                  <Upload className="mr-2 h-4 w-4" />
                  {bulkLoading ? tr(language, "Đang đọc file...", "Reading file...") : tr(language, "Chọn file .xlsx", "Choose .xlsx file")}
                </Button>
                <Button variant="ghost" onClick={() => setMemberImportRows([])} disabled={memberImportRows.length === 0}>
                  {tr(language, "Xoá danh sách", "Clear list")}
                </Button>
              </div>

              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-medium">{tr(language, "Danh sách thành viên chờ import", "Member import queue")}</p>
                  <span className="text-xs text-muted-foreground">
                    {importPreview.length} {tr(language, "email há»£p lá»‡", "valid emails")}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {importPreview.length > 0 ? (
                    importPreview.slice(0, 8).map(row => (
                      <Badge key={`${row.index}-${row.normalizedEmail}`} variant="secondary">
                        {row.email}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">{tr(language, "Chưa có thành viên nào trong danh sách.", "No members in the queue yet.")}</span>
                  )}
                </div>
              </div>

              <Button onClick={() => void handleBulkImport()} disabled={bulkLoading || importPreview.length === 0 || !selectedGroup} className="w-full">
                <Upload className="mr-2 h-4 w-4" />
                {bulkLoading ? tr(language, "Đang import...", "Importing...") : tr(language, "Import thành viên", "Import members")}
              </Button>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="border-border/60 shadow-card">
              <CardHeader>
                <CardTitle>{tr(language, "Mời người dùng qua email", "Invite users by email")}</CardTitle>
                <CardDescription>
                  {tr(
                    language,
                    "Nhập email người dùng, hệ thống tạo mã tham gia riêng cho lời mời này và lưu lịch sử để bạn quản lý sau đó.",
                    "Enter the user email; the system generates a dedicated join code and stores the invitation for later tracking.",
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{tr(language, "Nhóm đích", "Target group")}</Label>
                  <SearchableGroupSelect
                    groups={groups}
                    value={selectedGroup?.id ?? ""}
                    onChange={handleSelectGroup}
                    placeholder={tr(language, "Chọn nhóm", "Choose a group")}
                    searchPlaceholder={tr(language, "Tìm nhóm để mời...", "Search a group to invite...")}
                    emptyText={tr(language, "Không tìm thấy nhóm nào.", "No group found.")}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-email">{tr(language, "Email người được mời", "Invitee email")}</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="student@example.edu"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="invite-note">{tr(language, "Ghi chú", "Note")}</Label>
                  <Textarea
                    id="invite-note"
                    value={inviteNote}
                    onChange={(event) => setInviteNote(event.target.value)}
                    placeholder={tr(language, "Ví dụ: Mời vào nhóm dự án tuần này", "Example: Please join this week's project group")}
                  />
                </div>

                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground">
                  {tr(
                    language,
                    "Nếu email trùng với tài khoản Teamfair, hệ thống sẽ gửi thêm thông báo nội bộ. Mỗi lời mời vẫn có mã riêng để bạn copy dán vào email.",
                    "If the email matches a Teamfair account, the system also sends an in-app notification. Every invite still gets a dedicated code you can paste into email.",
                  )}
                </div>

                <Button onClick={() => void handleInviteByEmail()} disabled={inviteLoading || !selectedGroup} className="w-full">
                  <Send className="mr-2 h-4 w-4" />
                  {inviteLoading ? tr(language, "Đang gửi...", "Sending...") : tr(language, "Gửi lời mời", "Send invite")}
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/60 shadow-card">
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>{tr(language, "Mã tham gia và lịch sử", "Join codes and history")}</CardTitle>
                  <CardDescription>
                    {tr(language, "Copy nội dung lời mời để gửi email thủ công hoặc thu hồi khi cần.", "Copy the invite text for manual email delivery or revoke it when needed.")}
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={() => selectedGroup?.id && void listGroupEmailInvites(selectedGroup.id).then(setInviteRows)}>
                  <RefreshCw className={`mr-2 h-4 w-4 ${inviteReloading ? "animate-spin" : ""}`} />
                  {tr(language, "Làm mới", "Refresh")}
                </Button>
              </CardHeader>
              <CardContent>
                {!selectedGroup ? (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    {tr(language, "Chọn một nhóm để xem lời mời email.", "Select a group to view email invites.")}
                  </div>
                ) : inviteRows.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 p-8 text-center text-sm text-muted-foreground">
                    {tr(language, "Chưa có lời mời nào cho nhóm này.", "No invites for this group yet.")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {paginatedInvites.map(invite => (
                      <div key={invite.id} className="rounded-2xl border border-border/60 bg-background p-4">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                          <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">{invite.invited_email}</Badge>
                              <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100">{inviteStatusLabel(invite.status)}</Badge>
                              {invite.invited_user_id ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">{tr(language, "Đã gắn tài khoản", "Linked account")}</Badge>
                              ) : (
                                <Badge variant="outline">{tr(language, "Chưa có account", "No account yet")}</Badge>
                              )}
                            </div>
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                <span className="font-mono text-xs">{invite.invite_code}</span>
                              </div>
                              {invite.note ? <p className="text-muted-foreground">{invite.note}</p> : null}
                              <p className="text-xs text-muted-foreground">
                                {tr(language, "Tạo lúc", "Created")} {new Date(invite.created_at).toLocaleString()}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => void handleCopyInviteCode(invite.invite_code)}>
                              <Copy className="mr-2 h-3.5 w-3.5" />
                              {tr(language, "Sao chép mã", "Copy code")}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => void handleCopyInviteText(invite)}>
                              <MailPlus className="mr-2 h-3.5 w-3.5" />
                              {tr(language, "Copy email", "Copy email")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                              onClick={() => void handleRevokeInvite(invite.id)}
                              disabled={invite.status === "revoked" || invite.status === "accepted"}
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" />
                              {tr(language, "Thu hồi", "Revoke")}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <PaginationControls
                  label={tr(language, "Trang", "Page")}
                  page={invitePage}
                  totalPages={totalInvitePages}
                  onChange={setInvitePage}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-6 animate-liquid-rise">
          <Card className="border-border/60 shadow-card">
            <CardHeader>
              <CardTitle>{tr(language, "Quản lý thành viên", "Member management")}</CardTitle>
              <CardDescription>
                {tr(language, "Đổi nhóm trưởng trước, sau đó có thể kick thành viên khỏi nhóm.", "Assign a new leader first, then you can remove members from the group.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                <div className="space-y-2">
                  <Label>{tr(language, "Nhóm", "Group")}</Label>
                  <SearchableGroupSelect
                    groups={groups}
                    value={selectedGroup?.id ?? ""}
                    onChange={handleSelectGroup}
                    placeholder={tr(language, "Chọn nhóm", "Choose group")}
                    searchPlaceholder={tr(language, "Tìm nhóm để quản lý thành viên...", "Search a group to manage members...")}
                    emptyText={tr(language, "Không tìm thấy nhóm nào.", "No group found.")}
                  />
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  {selectedGroup ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="secondary">{selectedGroup.members.length} {tr(language, "thành viên", "members")}</Badge>
                      <Badge variant="secondary">{selectedGroup.tasks.length} {tr(language, "task", "tasks")}</Badge>
                      <Badge variant="secondary">
                        {tr(language, "Điểm TB", "Average")} {selectedGroupAverage !== null ? selectedGroupAverage.toFixed(1) : "â€”"}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{tr(language, "Chưa có nhóm nào được chọn.", "No group selected.")}</p>
                  )}
                </div>
              </div>

              {selectedGroup ? (
                <div className="overflow-hidden rounded-2xl border border-border/60">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/60 text-muted-foreground">
                        <tr>
                          <th className="px-4 py-3 text-left font-medium">{tr(language, "Thành viên", "Member")}</th>
                          <th className="px-4 py-3 text-left font-medium">{tr(language, "Vai trò", "Role")}</th>
                          <th className="px-4 py-3 text-center font-medium">{tr(language, "Task xong", "Done")}</th>
                          <th className="px-4 py-3 text-center font-medium">{tr(language, "Đóng góp", "Contribution")}</th>
                          <th className="px-4 py-3 text-center font-medium">{tr(language, "Nhóm trưởng", "Leader")}</th>
                          <th className="px-4 py-3 text-center font-medium"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedMembers.map(member => {
                          const id = member.id ?? member.name;
                          const isLeader = member.role === "Leader";
                          return (
                            <tr key={id} className="border-t border-border/60">
                              <td className="px-4 py-3 font-medium">{resolveMemberName(member)}</td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {isLeader ? (
                                  <span className="inline-flex items-center gap-1 text-amber-700">
                                    <Crown className="h-3.5 w-3.5" />
                                    {tr(language, "Nhóm trưởng", "Leader")}
                                  </span>
                                ) : (
                                  tr(language, "Thành viên", "Member")
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">{member.completedTasks}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 justify-center">
                                  <Progress value={member.contributionPercent} className="h-2 w-20" />
                                  <span className="w-10 text-right text-xs">{member.contributionPercent}%</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {isLeader ? (
                                  <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">{tr(language, "Hiện tại", "Current")}</Badge>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => void handleAssignLeader(id)} disabled={memberActionLoading === id}>
                                    <UserPlus className="mr-2 h-3.5 w-3.5" />
                                    {tr(language, "Đặt làm trưởng", "Make leader")}
                                  </Button>
                                )}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                                  onClick={() => void handleKickMember(id, member.name)}
                                  disabled={memberActionLoading === id || isLeader}
                                >
                                  <UserMinus className="mr-2 h-3.5 w-3.5" />
                                  {tr(language, "Kick", "Kick")}
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-border/70 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                  {tr(language, "Chọn nhóm để quản lý thành viên.", "Select a group to manage its members.")}
                </div>
              )}

              <PaginationControls
                label={tr(language, "Trang", "Page")}
                page={memberPage}
                totalPages={totalMemberPages}
                onChange={setMemberPage}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scores" className="space-y-6 animate-liquid-rise">
          <Card className="border-border/60 shadow-card">
            <CardHeader>
              <CardTitle>{tr(language, "Chấm điểm theo rubric", "Rubric-based grading")}</CardTitle>
              <CardDescription>
                {tr(language, "Chọn nhóm, kiểm tra rubric đang dùng rồi mở workspace chấm điểm chính thức.", "Choose a group, review the active rubric, then open the formal grading workspace.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
                <div className="space-y-2">
                  <Label>{tr(language, "Nhóm", "Group")}</Label>
                  <SearchableGroupSelect
                    groups={groups}
                    value={selectedGroup?.id ?? ""}
                    onChange={handleSelectGroup}
                    placeholder={tr(language, "Chọn nhóm", "Choose group")}
                    searchPlaceholder={tr(language, "Tìm nhóm để chấm điểm...", "Search a group to grade...")}
                    emptyText={tr(language, "Không tìm thấy nhóm nào.", "No group found.")}
                  />
                </div>
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  {selectedGroup ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge variant="secondary">{selectedGroup.members.length} {tr(language, "thành viên", "members")}</Badge>
                      <Badge variant="secondary">{selectedGroup.tasks.length} {tr(language, "task", "tasks")}</Badge>
                      <Badge variant="secondary">{selectedGroupActiveRubrics.length} {tr(language, "rubric hoạt động", "active rubrics")}</Badge>
                      {gradingLoading ? <Badge variant="secondary">{tr(language, "Đang tải dữ liệu chấm", "Loading grading data")}</Badge> : null}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{tr(language, "Chưa có nhóm nào được chọn.", "No group selected.")}</p>
                  )}
                </div>
              </div>

              {selectedGroup ? (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Trạng thái", "Status")}</div>
                      <div className={cn("mt-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium", selectedGroupGradingMeta.badge)}>
                        <span className={cn("h-2 w-2 rounded-full", selectedGroupGradingMeta.dot)} />
                        {selectedGroupGradingMeta.label}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Điểm nhóm", "Group score")}</div>
                      <div className="mt-2 text-2xl font-semibold">
                        {selectedGroupRubricScore !== null ? `${selectedGroupRubricScore.toFixed(1)} / 10` : "—"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                      <div className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{tr(language, "Cập nhật lần cuối", "Last updated")}</div>
                      <div className="mt-2 text-sm font-medium">
                        {selectedGroupLatestGrade?.updated_at
                          ? new Date(selectedGroupLatestGrade.updated_at).toLocaleString(language === "vi" ? "vi-VN" : "en-US")
                          : tr(language, "Chưa có dữ liệu", "No grading data yet")}
                      </div>
                    </div>
                  </div>

                  {selectedGroupActiveRubrics.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-amber-300 bg-amber-50/60 p-8">
                      <div className="space-y-3">
                        <h3 className="text-lg font-semibold text-slate-900">{tr(language, "Nhóm này chưa có rubric hoạt động", "This group has no active rubric")}</h3>
                        <p className="max-w-2xl text-sm text-slate-600">
                          {tr(language, "Muốn chấm điểm hợp lý thì cần tạo hoặc upload rubric trước. Sau đó hệ thống sẽ đưa bạn vào workspace chấm chính thức cho nhóm này.", "A sensible grading flow starts with an active rubric. Create or upload one first, then open the grading workspace for this group.")}
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <Button className="rounded-2xl" onClick={() => navigate(`/lecturer/rubrics/upload?projectId=${selectedGroup.id}`)}>
                            <ClipboardList className="mr-2 h-4 w-4" />
                            {tr(language, "Tạo rubric cho nhóm này", "Create rubric for this group")}
                          </Button>
                          <Button variant="outline" className="rounded-2xl" onClick={() => navigate(`/lecturer/rubrics?projectId=${selectedGroup.id}`)}>
                            {tr(language, "Xem thư viện rubric", "View rubric library")}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-background p-4">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-slate-900">
                            {selectedGroupLatestGrade?.rubrics?.name || selectedGroupActiveRubrics[0]?.rubric.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {selectedGroupLatestGrade
                              ? tr(language, "Bạn có thể tiếp tục trên rubric đã dùng gần nhất hoặc đổi sang rubric khác.", "Continue with the most recently used rubric, or switch to another rubric.")
                              : tr(language, "Nhóm đã sẵn sàng để bắt đầu chấm điểm theo rubric.", "This group is ready to start rubric-based grading.")}
                          </div>
                        </div>
                        <Button className="rounded-2xl" onClick={() => openGroupGrading(selectedGroup.id)}>
                          <ClipboardList className="mr-2 h-4 w-4" />
                          {selectedGroupGradingStatus === "draft"
                            ? tr(language, "Tiếp tục chấm điểm", "Continue grading")
                            : selectedGroupGradingStatus === "submitted" || selectedGroupGradingStatus === "locked"
                              ? tr(language, "Xem bài chấm", "View grade sheet")
                              : tr(language, "Bắt đầu chấm điểm", "Start grading")}
                        </Button>
                      </div>

                      <div className="overflow-hidden rounded-2xl border border-border/60">
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[760px] text-sm">
                            <thead className="bg-muted/60 text-muted-foreground">
                              <tr>
                                <th className="px-4 py-3 text-left font-medium">{tr(language, "Rubric", "Rubric")}</th>
                                <th className="px-4 py-3 text-left font-medium">{tr(language, "Trạng thái", "Status")}</th>
                                <th className="px-4 py-3 text-left font-medium">{tr(language, "Số tiêu chí", "Criteria rows")}</th>
                                <th className="px-4 py-3 text-left font-medium">{tr(language, "Đã dùng", "Usage")}</th>
                                <th className="px-4 py-3 text-right font-medium">{tr(language, "Hành động", "Action")}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedGroupRubrics.map((summary) => (
                                <tr key={summary.rubric.id} className="border-t border-border/60">
                                  <td className="px-4 py-3">
                                    <div className="font-medium text-slate-900">{summary.rubric.name}</div>
                                    <div className="text-xs text-muted-foreground">{summary.rubric.original_file_name || tr(language, "Mẫu mặc định", "Default template")}</div>
                                  </td>
                                  <td className="px-4 py-3">
                                    <Badge className={summary.rubric.status === "active" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-50" : "bg-slate-200 text-slate-700 hover:bg-slate-200"}>
                                      {summary.rubric.status === "active" ? tr(language, "Đang dùng", "Active") : tr(language, "Lưu trữ", "Archived")}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 text-slate-700">{summary.rowCount}</td>
                                  <td className="px-4 py-3 text-slate-700">{summary.usageCount}</td>
                                  <td className="px-4 py-3 text-right">
                                    <Button
                                      size="sm"
                                      variant={summary.rubric.status === "active" ? "default" : "outline"}
                                      className="rounded-xl"
                                      onClick={() => navigate(`/lecturer/grading/projects/${selectedGroup.id}/groups/${selectedGroup.id}/rubrics/${summary.rubric.id}`)}
                                    >
                                      {summary.rubric.status === "active" ? tr(language, "Dùng để chấm", "Use for grading") : tr(language, "Xem rubric", "View rubric")}
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-border/70 bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                  {tr(language, "Chọn nhóm để bắt đầu chấm điểm.", "Select a group to start grading.")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={deleteGroupId !== null} onOpenChange={(open) => !open && setDeleteGroupId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tr(language, "Xác nhận xoá nhóm", "Confirm delete group")}</DialogTitle>
            <DialogDescription>
              {tr(language, "Thao tác này sẽ xoá nhóm và toàn bộ dữ liệu liên quan.", "This will delete the group and all related data.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setDeleteGroupId(null)}>
              {tr(language, "Huá»·", "Cancel")}
            </Button>
            <Button variant="destructive" onClick={() => void handleDeleteGroup()}>
              {tr(language, "Xoá nhóm", "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LecturerGroupsPage;
