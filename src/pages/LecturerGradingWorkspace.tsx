import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam } from "@/context/TeamContext";
import { tr } from "@/lib/i18n";
import { fetchGradesForGroups, fetchRubricSummaries, type RubricGradeListRow, type RubricSummary } from "@/lib/rubricPersistence";
import { normalizeRubricGradeStatus } from "@/lib/rubricModel";
import { getAccessibleRubricProjects } from "@/lib/rubricProjectAccess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Edit2, Eye, Loader2, PlayCircle, Search, TriangleAlert, Users } from "lucide-react";

type GradeStatusFilter = "all" | "ungraded" | "draft" | "submitted" | "locked";
type RubricUsageFilter = "all" | "active";

const LecturerGradingWorkspace = () => {
  const { groups } = useTeam();
  const { profile, user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const currentRole =
    profile?.role ||
    ((user?.user_metadata?.app_role ||
      user?.app_metadata?.role ||
      user?.user_metadata?.role) as "student" | "lecturer" | "admin" | undefined);

  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [searchGroup, setSearchGroup] = useState("");
  const [statusFilter, setStatusFilter] = useState<GradeStatusFilter>("all");
  const [selectedRubricId, setSelectedRubricId] = useState("all");
  const [rubricFilter, setRubricFilter] = useState<RubricUsageFilter>("active");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 8;

  const availableProjects = useMemo(
    () => getAccessibleRubricProjects(groups, user?.id, currentRole),
    [currentRole, groups, user?.id],
  );

  const projectIdsString = useMemo(() => availableProjects.map((g) => g.id).join(","), [availableProjects]);

  const { data: grades = [], isLoading: isLoadingGrades, error: gradesError } = useQuery({
    queryKey: ["grades", projectIdsString],
    queryFn: () => fetchGradesForGroups(availableProjects.map((group) => group.id)),
    staleTime: 5 * 60 * 1000,
    enabled: availableProjects.length > 0,
  });

  const { data: rubricSummaries = [], isLoading: isLoadingRubrics, error: rubricsError } = useQuery({
    queryKey: ["rubricSummaries"],
    queryFn: fetchRubricSummaries,
    staleTime: 5 * 60 * 1000,
  });

  const loading = isLoadingGrades || isLoadingRubrics;
  const loadError = gradesError || rubricsError ? String(gradesError || rubricsError) : null;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchGroup, statusFilter, selectedRubricId, rubricFilter, selectedProjectId]);

  const selectedProject = useMemo(
    () => availableProjects.find((group) => group.id === selectedProjectId) || null,
    [availableProjects, selectedProjectId],
  );

  const rubricOptions = useMemo(() => {
    const scoped = selectedProjectId
      ? rubricSummaries.filter((summary) => summary.rubric.project_id === selectedProjectId)
      : rubricSummaries.filter((summary) => availableProjects.some((group) => group.id === summary.rubric.project_id));

    if (rubricFilter === "active") {
      return scoped.filter((summary) => summary.rubric.status === "active");
    }

    return scoped;
  }, [availableProjects, rubricFilter, rubricSummaries, selectedProjectId]);

  const projectRows = useMemo(() => {
    if (!selectedProjectId) return availableProjects;
    return availableProjects.filter((group) => group.id === selectedProjectId);
  }, [availableProjects, selectedProjectId]);

  const filteredGroups = useMemo(() => {
    const normalizedSearch = searchGroup.trim().toLowerCase();

    return projectRows.filter((group) => {
      if (normalizedSearch && !group.name.toLowerCase().includes(normalizedSearch)) return false;

      const grade = grades.find((item) => item.group_id === group.id);
      const status = grade ? normalizeRubricGradeStatus(grade.status) : "ungraded";

      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (selectedRubricId !== "all" && grade?.rubric_id !== selectedRubricId) return false;

      return true;
    });
  }, [grades, projectRows, searchGroup, selectedRubricId, statusFilter]);

  const totalPages = Math.ceil(filteredGroups.length / ITEMS_PER_PAGE);
  const paginatedGroups = useMemo(() => {
    return filteredGroups.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  }, [filteredGroups, currentPage, ITEMS_PER_PAGE]);

  const projectSummary = useMemo(
    () =>
      projectRows.reduce(
        (accumulator, group) => {
          const grade = grades.find((item) => item.group_id === group.id);
          const status = grade ? normalizeRubricGradeStatus(grade.status) : "ungraded";

          accumulator.total += 1;
          if (status === "ungraded") accumulator.ungraded += 1;
          if (status === "draft") accumulator.draft += 1;
          if (status === "submitted" || status === "locked") accumulator.submitted += 1;
          return accumulator;
        },
        { total: 0, ungraded: 0, draft: 0, submitted: 0 },
      ),
    [grades, projectRows],
  );

  const resetFilters = () => {
    setSearchGroup("");
    setStatusFilter("all");
    setSelectedRubricId("all");
    setRubricFilter("active");
  };

  const renderStatusBadge = (status: GradeStatusFilter) => {
    if (status === "submitted") {
      return <Badge className="border-none bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Đã gửi</Badge>;
    }
    if (status === "locked") {
      return <Badge className="border-none bg-slate-200 text-slate-700 hover:bg-slate-200">Đã khóa</Badge>;
    }
    if (status === "draft") {
      return <Badge className="border-none bg-amber-100 text-amber-700 hover:bg-amber-100">Bản nháp</Badge>;
    }
    return <Badge className="border-none bg-slate-100 text-slate-700 hover:bg-slate-100">Chưa chấm</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card className="rounded-3xl border-slate-200 p-4 shadow-sm h-[80px] animate-pulse bg-slate-100" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="rounded-3xl border-slate-200 p-5 shadow-sm h-[100px] animate-pulse bg-slate-100" />
          ))}
        </div>
        <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm animate-pulse">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  {[...Array(8)].map((_, i) => (
                    <th key={i} className="px-4 py-3"><div className="h-4 w-16 bg-slate-200 rounded"></div></th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 w-20 bg-slate-200 rounded"></div></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="rounded-3xl border-red-200 p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <TriangleAlert className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Không thể tải danh sách chấm điểm</h3>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-600">{loadError}</p>
      </Card>
    );
  }

  if (availableProjects.length === 0) {
    return (
      <Card className="rounded-3xl border-slate-200 p-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
          <TriangleAlert className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900">Bạn chưa được phân công dự án nào.</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
          Chưa có dự án nào khả dụng để chấm điểm nhóm.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-3xl border-slate-200 p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select
            value={selectedProjectId || "none"}
            onValueChange={(value) => {
              const nextValue = value === "none" ? "" : value;
              setSelectedProjectId(nextValue);
              resetFilters();
            }}
          >
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Tất cả dự án" /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="none">Tất cả dự án</SelectItem>
              {availableProjects.map((group) => (
                <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            value={searchGroup}
            onChange={(event) => setSearchGroup(event.target.value)}
            placeholder="Tìm kiếm theo tên dự án hoặc nhóm..."
            className="rounded-xl"
          />

          <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as GradeStatusFilter)}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Trạng thái chấm" /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Tất cả</SelectItem>
              <SelectItem value="ungraded">Chưa chấm</SelectItem>
              <SelectItem value="draft">Bản nháp</SelectItem>
              <SelectItem value="submitted">Đã gửi</SelectItem>
              <SelectItem value="locked">Đã khóa</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedRubricId} onValueChange={setSelectedRubricId}>
            <SelectTrigger className="rounded-xl"><SelectValue placeholder="Rubric" /></SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Tất cả rubric</SelectItem>
              {rubricOptions.map((summary) => (
                <SelectItem key={summary.rubric.id} value={summary.rubric.id}>{summary.rubric.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" className="rounded-xl" onClick={resetFilters}>
            Xóa bộ lọc
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card className="rounded-3xl border-slate-200 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Phạm vi</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">
            {selectedProject?.name || "Tất cả dự án phụ trách"}
          </p>
        </Card>
        <Card className="rounded-3xl border-slate-200 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Số nhóm</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{projectSummary.total}</p>
        </Card>
        <Card className="rounded-3xl border-slate-200 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Chưa chấm / nháp</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{projectSummary.ungraded + projectSummary.draft}</p>
        </Card>
        <Card className="rounded-3xl border-slate-200 p-5 shadow-sm">
          <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Đã gửi</p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">{projectSummary.submitted}</p>
        </Card>
      </div>

      {filteredGroups.length === 0 ? (
        <Card className="rounded-3xl border-slate-200 p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <Search className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            {projectRows.length === 0 ? "Hiện chưa có dự án nào để chấm điểm." : "Không có nhóm nào phù hợp với bộ lọc."}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {projectRows.length === 0
              ? "Bạn chưa có dữ liệu dự án khả dụng cho phần chấm điểm."
              : "Thử đổi bộ lọc trạng thái, rubric hoặc từ khóa tìm kiếm."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden rounded-3xl border-slate-200 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3">Dự án</th>
                  <th className="px-4 py-3">Nhóm</th>
                  <th className="px-4 py-3">Thành viên</th>
                  <th className="px-4 py-3">Rubric</th>
                  <th className="px-4 py-3">Trạng thái</th>
                  <th className="px-4 py-3">Tổng điểm</th>
                  <th className="px-4 py-3">Cập nhật lần cuối</th>
                  <th className="px-4 py-3 text-right">Hành động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedGroups.map((group) => {
                  const grade = grades.find((item) => item.group_id === group.id);
                  const status = grade ? normalizeRubricGradeStatus(grade.status) : "ungraded";
                  const actionLabel =
                    status === "draft" ? "Tiếp tục chấm" : status === "submitted" || status === "locked" ? "Xem điểm" : "Chấm điểm";

                  return (
                    <tr key={group.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-4 text-slate-700">{group.name}</td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-900">{group.name}</div>
                        <div className="text-xs text-slate-500">{group.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-slate-700">
                          <Users className="h-4 w-4" />
                          <span>{group.members?.length || 0}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{grade?.rubrics?.name || "-"}</td>
                      <td className="px-4 py-4">{renderStatusBadge(status)}</td>
                      <td className="px-4 py-4 text-slate-700">{grade ? `${grade.total_score} / ${grade.max_total_score}` : "-"}</td>
                      <td className="px-4 py-4 text-slate-700">
                        {grade?.updated_at ? new Date(grade.updated_at).toLocaleString(language === "vi" ? "vi-VN" : "en-US") : "-"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          size="sm"
                          variant={status === "ungraded" ? "default" : "outline"}
                          className={`rounded-xl ${status === "ungraded" ? "bg-indigo-600 text-white hover:bg-indigo-500" : ""}`}
                          onClick={() =>
                            navigate(
                              status === "ungraded"
                                ? `/lecturer/grading/projects/${group.id}/groups/${group.id}`
                                : `/lecturer/grading/projects/${group.id}/groups/${group.id}/rubrics/${grade?.rubric_id}`,
                            )
                          }
                        >
                          {status === "draft" ? <Edit2 className="mr-1.5 h-3.5 w-3.5" /> : status === "ungraded" ? <PlayCircle className="mr-1.5 h-3.5 w-3.5" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />}
                          {actionLabel}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {totalPages > 1 && !loading && filteredGroups.length > 0 && (
        <div className="flex items-center justify-center gap-4 pt-4 pb-2">
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
    </div>
  );
};

export default LecturerGradingWorkspace;
