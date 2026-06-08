import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/context/TeamContext";
import { tr } from "@/lib/i18n";
import { canManageRubric } from "@/lib/rubricModel";
import { getAccessibleRubricProjects } from "@/lib/rubricProjectAccess";
import {
  deleteRubric,
  duplicateRubric,
  fetchRubricSummaries,
  updateRubricArchiveState,
  type RubricSummary,
} from "@/lib/rubricPersistence";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import DuplicateRubricDialog from "@/components/rubrics/DuplicateRubricDialog";
import LecturerGradingWorkspace from "./LecturerGradingWorkspace";
import {
  Archive,
  ArchiveRestore,
  Copy,
  Eye,
  FileSpreadsheet,
  Loader2,
  MoreVertical,
  PencilLine,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  Upload,
} from "lucide-react";

type RubricWorkspaceTab = "templates" | "grading";
type StatusFilter = "all" | "active" | "archived";
type UsageFilter = "all" | "unused" | "used";
type DuplicateMode = "duplicate" | "apply";

function buildRubricWorkspaceSearchParams(tab: RubricWorkspaceTab, projectId: string) {
  const nextSearchParams = new URLSearchParams();
  if (tab === "grading") {
    nextSearchParams.set("tab", "grading");
  }
  if (projectId) {
    nextSearchParams.set("projectId", projectId);
  }
  return nextSearchParams;
}

const LecturerRubricsList = () => {
  const { language } = useLanguage();
  const { profile, user } = useAuth();
  const { groups } = useTeam();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const currentRole =
    profile?.role ||
    ((user?.user_metadata?.app_role ||
      user?.app_metadata?.role ||
      user?.user_metadata?.role) as "student" | "lecturer" | "admin" | undefined);
  const actorId = profile?.id || user?.id || null;

  const activeTab: RubricWorkspaceTab = searchParams.get("tab") === "grading" ? "grading" : "templates";
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [usageFilter, setUsageFilter] = useState<UsageFilter>("all");
  
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [rubricToDelete, setRubricToDelete] = useState<RubricSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateMode, setDuplicateMode] = useState<DuplicateMode>("duplicate");
  const [rubricToDuplicate, setRubricToDuplicate] = useState<RubricSummary | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const projects = useMemo(
    () => getAccessibleRubricProjects(groups, user?.id, currentRole).map((group) => ({ id: group.id, name: group.name })),
    [currentRole, groups, user?.id],
  );
  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const { data: rubrics = [], isLoading: loading, error: queryError, refetch: loadRubrics } = useQuery({
    queryKey: ["rubricSummaries"],
    queryFn: fetchRubricSummaries,
    staleTime: 5 * 60 * 1000,
  });

  const loadError = queryError instanceof Error ? queryError.message : (queryError ? String(queryError) : null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, usageFilter, selectedProjectId]);

  useEffect(() => {
    if (projects.length === 0) return;
    const projectIdFromQuery = searchParams.get("projectId");
    
    if (projectIdFromQuery === "all") {
      if (selectedProjectId !== "all") {
        setSelectedProjectId("all");
      }
      return;
    }

    if (projectIdFromQuery && projects.some((project) => project.id === projectIdFromQuery)) {
      if (selectedProjectId !== projectIdFromQuery) {
        setSelectedProjectId(projectIdFromQuery);
      }
      return;
    }

    if (!selectedProjectId || (selectedProjectId !== "all" && !projects.some((project) => project.id === selectedProjectId))) {
      setSelectedProjectId("all");
    }
  }, [projects, searchParams, selectedProjectId]);

  const handleProjectSelection = (projectId: string) => {
    setSelectedProjectId(projectId);
    setSearchParams(buildRubricWorkspaceSearchParams(activeTab, projectId), { replace: true });
  };

  const filteredRubrics = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();

    return rubrics.filter((summary) => {
      if (selectedProjectId && selectedProjectId !== "all" && summary.rubric.project_id !== selectedProjectId) return false;
      if (projects.length > 0 && !projects.some((project) => project.id === summary.rubric.project_id)) return false;

      const matchesSearch =
        !normalizedQuery ||
        summary.rubric.name.toLowerCase().includes(normalizedQuery) ||
        summary.projectName.toLowerCase().includes(normalizedQuery) ||
        summary.createdByName.toLowerCase().includes(normalizedQuery) ||
        (summary.rubric.original_file_name || "").toLowerCase().includes(normalizedQuery);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && summary.rubric.status === "active") ||
        (statusFilter === "archived" && summary.rubric.status === "archived");

      const matchesUsage =
        usageFilter === "all" ||
        (usageFilter === "unused" && summary.usageCount === 0) ||
        (usageFilter === "used" && summary.usageCount > 0);

      return matchesSearch && matchesStatus && matchesUsage;
    });
  }, [projects, rubrics, searchQuery, selectedProjectId, statusFilter, usageFilter]);

  const totalPages = Math.ceil(filteredRubrics.length / ITEMS_PER_PAGE);
  const paginatedRubrics = useMemo(() => {
    return filteredRubrics.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredRubrics, currentPage, ITEMS_PER_PAGE]);

  const openDuplicateDialog = (rubric: RubricSummary, mode: DuplicateMode) => {
    setRubricToDuplicate(rubric);
    setDuplicateMode(mode);
    setDuplicateDialogOpen(true);
  };

  const handleDuplicateSubmit = async ({ targetProjectId, newName }: { targetProjectId: string; newName: string }) => {
    if (!actorId || !rubricToDuplicate) return;
    const rubric = rubricToDuplicate;

    try {
      setIsDuplicating(true);
      await duplicateRubric({
        rubricId: rubricToDuplicate.rubric.id,
        userId: actorId,
        targetProjectId,
        newName,
      });
      toast({
        title: tr(language, "Đã nhân bản rubric", "Rubric duplicated"),
        description: tr(
          language,
          `Bản sao của "${rubric.rubric.name}" đã được tạo.`,
          `A copy of "${rubric.rubric.name}" has been created.`,
        ),
      });
      setDuplicateDialogOpen(false);
      setRubricToDuplicate(null);
      handleProjectSelection(targetProjectId);
      await loadRubrics();
    } catch (error) {
      toast({
        title: tr(language, "Không thể nhân bản", "Unable to duplicate"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleArchiveToggle = async (rubric: RubricSummary) => {
    if (!actorId) return;

    const canManage = canManageRubric({
      currentUserId: actorId,
      currentUserRole: currentRole,
      createdBy: rubric.rubric.created_by,
    });

    if (!canManage) {
      toast({
        title: tr(language, "Không có quyền cập nhật rubric", "Unable to update rubric"),
        description: tr(
          language,
          "Chỉ người tạo rubric hoặc quản trị viên mới có thể lưu trữ hoặc khôi phục.",
          "Only the rubric owner or an admin can archive or restore it.",
        ),
        variant: "destructive",
      });
      return;
    }

    const isCurrentlyArchived = rubric.rubric.status === "archived";
    try {
      await updateRubricArchiveState(rubric.rubric.id, !isCurrentlyArchived, actorId);
      toast({
        title: isCurrentlyArchived
          ? tr(language, "Đã khôi phục rubric", "Rubric restored")
          : tr(language, "Đã lưu trữ rubric", "Rubric archived"),
        description: tr(
          language,
          `"${rubric.rubric.name}" đã được ${isCurrentlyArchived ? "khôi phục" : "lưu trữ"}.`,
          `"${rubric.rubric.name}" has been ${isCurrentlyArchived ? "restored" : "archived"}.`,
        ),
      });
      await loadRubrics();
    } catch (error) {
      toast({
        title: tr(language, "Thao tác thất bại", "Operation failed"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    }
  };

  const openDeleteDialog = (rubric: RubricSummary) => {
    const canManage = canManageRubric({
      currentUserId: actorId,
      currentUserRole: currentRole,
      createdBy: rubric.rubric.created_by,
    });

    if (!canManage) {
      toast({
        title: tr(language, "Không có quyền xóa rubric", "Unable to delete"),
        description: tr(
          language,
          "Chỉ người tạo rubric hoặc quản trị viên mới có thể xóa.",
          "Only the rubric owner or an admin can delete it.",
        ),
        variant: "destructive",
      });
      return;
    }

    setRubricToDelete(rubric);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!rubricToDelete || !actorId) return;

    setIsDeleting(true);
    try {
      await deleteRubric(rubricToDelete.rubric.id, actorId);
      toast({
        title: tr(language, "Đã xóa rubric", "Rubric deleted"),
        description: tr(
          language,
          `"${rubricToDelete.rubric.name}" đã được xóa vĩnh viễn.`,
          `"${rubricToDelete.rubric.name}" has been permanently deleted.`,
        ),
      });
      await loadRubrics();
    } catch (error) {
      toast({
        title: tr(language, "Không thể xóa", "Unable to delete"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setRubricToDelete(null);
    }
  };

  const renderManagementPanel = () => {
    if (projects.length === 0) {
      return (
        <Card className="rounded-3xl border-slate-200 p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <TriangleAlert className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            {tr(language, "Chưa có dự án được phân công", "No assigned projects")}
          </h3>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
            {tr(
              language,
              "Bạn chưa được phân công dự án nào nên chưa thể tạo rubric.",
              "You have not been assigned to any project yet, so rubric creation is unavailable.",
            )}
          </p>
        </Card>
      );
    }

    if (loading) {
      return (
        <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm animate-pulse">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {[...Array(9)].map((_, i) => (
                    <th key={i} className="px-3 py-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    <td className="px-3 py-4"><div className="h-5 w-32 bg-slate-200 rounded mb-2"></div><div className="h-3 w-48 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4"><div className="h-6 w-20 bg-slate-200 rounded-full"></div></td>
                    <td className="px-3 py-4"><div className="h-4 w-16 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                    <td className="px-3 py-4"><div className="h-4 w-24 bg-slate-200 rounded"></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      );
    }

    if (loadError) {
      return (
        <Card className="rounded-3xl border-red-200 p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <TriangleAlert className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            {tr(language, "Không thể tải danh sách rubric", "Unable to load rubrics")}
          </h3>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">{loadError}</p>
          <Button className="mt-6 rounded-xl" onClick={() => void loadRubrics()}>
            {tr(language, "Thử lại", "Retry")}
          </Button>
        </Card>
      );
    }

    return (
      <>
        <Card className="rounded-3xl border-slate-200 p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-5 md:grid-cols-2">
            <Select
              value={selectedProjectId || "all"}
              onValueChange={(value) => handleProjectSelection(value)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={tr(language, "Tất cả dự án", "All projects")} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">{tr(language, "Tất cả dự án", "All projects")}</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative xl:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr(language, "Tìm kiếm rubric...", "Search rubrics...")}
                className="rounded-xl pl-9"
                disabled={!selectedProjectId}
              />
            </div>

            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)} disabled={!selectedProjectId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={tr(language, "Trạng thái", "Status")} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="active">Đang dùng</SelectItem>
                <SelectItem value="archived">Đã lưu trữ</SelectItem>
              </SelectContent>
            </Select>

            <Select value={usageFilter} onValueChange={(value) => setUsageFilter(value as UsageFilter)} disabled={!selectedProjectId}>
              <SelectTrigger className="rounded-xl">
                <SelectValue placeholder={tr(language, "Mức sử dụng", "Usage")} />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all">Tất cả</SelectItem>
                <SelectItem value="unused">Chưa dùng để chấm</SelectItem>
                <SelectItem value="used">Đã dùng để chấm</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {!selectedProjectId ? (
          <Card className="rounded-3xl border-slate-200 p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <Search className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Vui lòng chọn dự án.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              Chọn dự án trước để tải lên hoặc xem danh sách mẫu rubric.
            </p>
          </Card>
        ) : filteredRubrics.length === 0 ? (
          <Card className="rounded-3xl border-slate-200 p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <FileSpreadsheet className="h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {searchQuery || statusFilter !== "all" || usageFilter !== "all"
                ? tr(language, "Không tìm thấy rubric", "No rubrics found")
                : tr(language, "Chưa có rubric nào cho dự án này.", "No rubrics yet for this project.")}
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
              {searchQuery || statusFilter !== "all" || usageFilter !== "all"
                ? tr(language, "Thử đổi bộ lọc hoặc từ khóa tìm kiếm.", "Try changing filters or search keywords.")
                : tr(language, "Tải lên file để tạo mẫu rubric đầu tiên cho dự án này.", "Upload a file to create the first rubric template for this project.")}
            </p>
          </Card>
        ) : (
          <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-3 py-3 font-medium">Tên rubric</th>
                    <th className="px-3 py-3 font-medium">Dự án</th>
                    <th className="px-3 py-3 font-medium">File gốc</th>
                    <th className="px-3 py-3 font-medium">Sheet</th>
                    <th className="px-3 py-3 font-medium">Số dòng/cột</th>
                    <th className="px-3 py-3 font-medium">Trạng thái</th>
                    <th className="px-3 py-3 font-medium">Đã dùng</th>
                    <th className="px-3 py-3 font-medium">Người tạo</th>
                    <th className="px-3 py-3 font-medium">Ngày tạo</th>
                    <th className="px-3 py-3 text-right font-medium">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRubrics.map((summary) => {
                    const isArchived = summary.rubric.status === "archived";
                    const hasUsage = summary.usageCount > 0;
                    const canManage = canManageRubric({
                      currentUserId: actorId,
                      currentUserRole: currentRole,
                      createdBy: summary.rubric.created_by,
                    });

                    return (
                      <tr key={summary.rubric.id} className="hover:bg-slate-50/60">
                        <td className="px-3 py-4">
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => navigate(`/lecturer/rubrics/${summary.rubric.id}`)}
                              className="text-left font-semibold text-slate-900 hover:text-indigo-600"
                            >
                              {summary.rubric.name}
                            </button>
                            {summary.rubric.description ? (
                              <p className="line-clamp-1 text-xs text-slate-500">{summary.rubric.description}</p>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-slate-700">{summary.projectName}</td>
                        <td className="px-3 py-4 text-slate-700">
                          <div className="max-w-[120px] truncate" title={summary.rubric.original_file_name || "-"}>
                            {summary.rubric.original_file_name || "-"}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-slate-700">
                          <div className="max-w-[80px] truncate" title={summary.selectedSheetName || "-"}>
                            {summary.selectedSheetName || "-"}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-slate-700">{summary.rowCount} / {summary.columnCount}</td>
                        <td className="px-3 py-4">
                          {isArchived ? (
                            <Badge className="border-none bg-slate-200 text-slate-700 hover:bg-slate-200">Đã lưu trữ</Badge>
                          ) : (
                            <Badge className="border-none bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Đang dùng</Badge>
                          )}
                        </td>
                        <td className="px-3 py-4 text-slate-700">{hasUsage ? `${summary.usageCount} nhóm` : "Chưa dùng"}</td>
                        <td className="px-3 py-4 text-slate-700">
                          <div className="max-w-[80px] truncate" title={summary.createdByName}>
                            {summary.createdByName}
                          </div>
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {new Date(summary.rubric.created_at).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")}
                        </td>
                        <td className="px-3 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-600 hover:bg-slate-100">
                                  <MoreVertical className="h-4 w-4" />
                                  <span className="sr-only">{tr(language, "Hành động", "Actions")}</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                                <DropdownMenuItem
                                  onClick={() => navigate(`/lecturer/rubrics/${summary.rubric.id}`)}
                                  className="cursor-pointer rounded-lg"
                                >
                                  <Eye className="mr-2 h-4 w-4" />
                                  {tr(language, "Xem chi tiết", "View details")}
                                </DropdownMenuItem>



                                <DropdownMenuItem
                                  onClick={() => openDuplicateDialog(summary, "duplicate")}
                                  className="cursor-pointer rounded-lg"
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  {tr(language, "Nhân bản", "Duplicate")}
                                </DropdownMenuItem>

                                <DropdownMenuItem
                                  onClick={() => openDuplicateDialog(summary, "apply")}
                                  className="cursor-pointer rounded-lg"
                                >
                                  <Copy className="mr-2 h-4 w-4" />
                                  {tr(language, "Áp dụng cho dự án khác", "Apply to another project")}
                                </DropdownMenuItem>

                                {canManage ? (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => void handleArchiveToggle(summary)}
                                      className="cursor-pointer rounded-lg"
                                    >
                                      {isArchived ? (
                                        <>
                                          <ArchiveRestore className="mr-2 h-4 w-4" />
                                          {tr(language, "Khôi phục", "Restore")}
                                        </>
                                      ) : (
                                        <>
                                          <Archive className="mr-2 h-4 w-4" />
                                          {tr(language, "Lưu trữ", "Archive")}
                                        </>
                                      )}
                                    </DropdownMenuItem>

                                    {!hasUsage ? (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          onClick={() => openDeleteDialog(summary)}
                                          className="cursor-pointer rounded-lg text-red-600 focus:bg-red-50 focus:text-red-600"
                                        >
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          {tr(language, "Xóa vĩnh viễn", "Delete permanently")}
                                        </DropdownMenuItem>
                                      </>
                                    ) : null}
                                  </>
                                ) : null}
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
          </Card>
        )}

        {totalPages > 1 && !loading && filteredRubrics.length > 0 && (
          <div className="flex items-center justify-center gap-4 pt-6 pb-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => {
                setCurrentPage((p) => Math.max(1, p - 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={currentPage === 1}
            >
              Trang trước
            </Button>
            <span className="text-sm font-medium text-slate-600">
              Trang {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => {
                setCurrentPage((p) => Math.min(totalPages, p + 1));
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              disabled={currentPage === totalPages}
            >
              Trang sau
            </Button>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
            <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
            {tr(language, "Thang chấm điểm", "Rubrics")}
          </h1>
          <p className="text-sm text-slate-500">
            {tr(
              language,
              "Tạo và quản lý mẫu rubric theo dự án, sau đó dùng lại để chấm điểm nhóm sinh viên.",
              "Create reusable rubric templates per project, then use them to grade student groups.",
            )}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            className="rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500"
            onClick={() => {
              const url = (!selectedProjectId || selectedProjectId === "all") 
                ? "/lecturer/rubrics/upload" 
                : `/lecturer/rubrics/upload?projectId=${selectedProjectId}`;
              navigate(url);
            }}
          >
            <Upload className="mr-2 h-4 w-4" />
            {tr(language, "Tải lên Rubric", "Upload rubric")}
          </Button>
        </div>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setSearchParams(buildRubricWorkspaceSearchParams(value as RubricWorkspaceTab, selectedProjectId), { replace: true })
        }
        className="space-y-4"
      >
        <TabsList className="h-auto rounded-2xl bg-slate-100 p-1">
          <TabsTrigger value="templates" className="rounded-xl px-4 py-2 data-[state=active]:bg-white">
            {tr(language, "Mẫu Rubric", "Rubric Templates")}
          </TabsTrigger>
          <TabsTrigger value="grading" className="rounded-xl px-4 py-2 data-[state=active]:bg-white">
            {tr(language, "Chấm điểm nhóm", "Group Grading")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="mt-0 space-y-6">
          {renderManagementPanel()}
        </TabsContent>

        <TabsContent value="grading" className="mt-0 space-y-6">
          <LecturerGradingWorkspace />
        </TabsContent>
      </Tabs>

      <DuplicateRubricDialog
        open={duplicateDialogOpen}
        onOpenChange={(open) => {
          setDuplicateDialogOpen(open);
          if (!open) {
            setRubricToDuplicate(null);
          }
        }}
        sourceRubric={rubricToDuplicate}
        projects={projects}
        language={language}
        mode={duplicateMode}
        isSubmitting={isDuplicating}
        onSubmit={handleDuplicateSubmit}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {tr(language, "Xác nhận xóa rubric", "Confirm rubric deletion")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {rubricToDelete
                ? tr(
                    language,
                    `Bạn có chắc chắn muốn xóa vĩnh viễn rubric "${rubricToDelete.rubric.name}"? Hành động này không thể hoàn tác.`,
                    `Are you sure you want to permanently delete the rubric "${rubricToDelete.rubric.name}"? This action cannot be undone.`,
                  )
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl" disabled={isDeleting}>
              {tr(language, "Hủy", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-red-600 hover:bg-red-500"
              onClick={(e) => {
                e.preventDefault();
                void confirmDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {tr(language, "Đang xóa...", "Deleting...")}
                </>
              ) : (
                tr(language, "Xóa vĩnh viễn", "Delete permanently")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default LecturerRubricsList;
