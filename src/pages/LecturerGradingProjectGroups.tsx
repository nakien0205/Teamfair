import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam } from "@/context/TeamContext";
import { tr } from "@/lib/i18n";
import { fetchRubricSummaries, type RubricSummary } from "@/lib/rubricPersistence";
import { canAccessRubricProject, getAccessibleRubricProjects } from "@/lib/rubricProjectAccess";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, FileSpreadsheet, HelpCircle, Loader2, PlayCircle } from "lucide-react";

const LecturerGradingProjectGroups = () => {
  const { projectId, groupId } = useParams<{ projectId: string; groupId: string }>();
  const { language } = useLanguage();
  const { groups } = useTeam();
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const currentRole =
    profile?.role ||
    ((user?.user_metadata?.app_role ||
      user?.app_metadata?.role ||
      user?.user_metadata?.role) as "student" | "lecturer" | "admin" | undefined);

  const [rubrics, setRubrics] = useState<RubricSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const availableProjects = useMemo(
    () => getAccessibleRubricProjects(groups, user?.id, currentRole),
    [currentRole, groups, user?.id],
  );
  const project = useMemo(
    () => availableProjects.find((item) => item.id === projectId) || null,
    [availableProjects, projectId],
  );
  const group = useMemo(
    () => availableProjects.find((item) => item.id === groupId) || project,
    [availableProjects, groupId, project],
  );

  useEffect(() => {
    const loadRubrics = async () => {
      if (!projectId) {
        setLoading(false);
        setLoadError("Không tìm thấy dự án cần chấm điểm.");
        return;
      }

      if (!canAccessRubricProject(projectId, groups, user?.id, currentRole)) {
        setLoading(false);
        setLoadError("Bạn không có quyền chấm điểm cho dự án này.");
        return;
      }

      try {
        setLoading(true);
        setLoadError(null);
        const summaries = await fetchRubricSummaries();
        setRubrics(summaries.filter((summary) => summary.rubric.project_id === projectId));
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : String(error));
        setRubrics([]);
      } finally {
        setLoading(false);
      }
    };

    void loadRubrics();
  }, [currentRole, groups, projectId, user?.id]);

  const visibleRubrics = useMemo(
    () => rubrics.filter((summary) => showArchived || summary.rubric.status === "active"),
    [rubrics, showArchived],
  );

  useEffect(() => {
    if (loading) return;
    if (visibleRubrics.length !== 1 || !projectId || !groupId) return;

    navigate(
      `/lecturer/grading/projects/${projectId}/groups/${groupId}/rubrics/${visibleRubrics[0].rubric.id}`,
      { replace: true },
    );
  }, [groupId, loading, navigate, projectId, visibleRubrics]);

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (loadError) {
    return (
      <Card className="rounded-3xl border-red-200 p-8 text-center shadow-sm">
        <h3 className="text-lg font-semibold text-slate-900">{tr(language, "Không thể tải rubric", "Unable to load rubrics")}</h3>
        <p className="mt-2 text-sm text-red-600">{loadError}</p>
        <div className="mt-6 flex justify-center">
          <Button variant="outline" className="rounded-xl" onClick={() => navigate("/lecturer/rubrics?tab=grading")}>
            {tr(language, "Quay lại chấm điểm nhóm", "Back to grading")}
          </Button>
        </div>
      </Card>
    );
  }

  if (rubrics.length === 0) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => navigate("/lecturer/rubrics?tab=grading")} className="mb-4 flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          {tr(language, "Quay lại danh sách", "Back to list")}
        </Button>
        <Card className="flex flex-col items-center justify-center gap-4 rounded-3xl border-slate-200 bg-white p-12 text-center shadow-sm">
          <div className="rounded-2xl bg-amber-50 p-4 text-amber-600">
            <HelpCircle className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">
            {tr(language, "Dự án này chưa có rubric nào", "No rubrics found for this project")}
          </h3>
          <p className="max-w-sm text-sm text-slate-500">
            {tr(
              language,
              "Vui lòng tạo hoặc upload một mẫu rubric ở phần 'Mẫu Rubric' trước khi chấm điểm.",
              "Please upload or create a rubric template in 'Rubric Templates' before grading.",
            )}
          </p>
          <Button
            onClick={() => navigate("/lecturer/rubrics")}
            className="mt-2 rounded-xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500"
          >
            {tr(language, "Đến mục Mẫu Rubric", "Go to Rubric Templates")}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => navigate("/lecturer/rubrics?tab=grading")} className="flex items-center gap-2">
          <ArrowLeft className="h-4 w-4" />
          {tr(language, "Quay lại danh sách", "Back to list")}
        </Button>

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-2">
          <Switch id="show-archived-rubrics" checked={showArchived} onCheckedChange={setShowArchived} />
          <Label htmlFor="show-archived-rubrics" className="cursor-pointer text-sm text-slate-700">
            {tr(language, "Hiện rubric đã lưu trữ", "Show archived rubrics")}
          </Label>
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
          <FileSpreadsheet className="h-6 w-6 text-indigo-600" />
          {tr(language, "Chọn thang chấm điểm", "Select rubric")}
        </h1>
        <p className="text-sm text-slate-500">
          {tr(
            language,
            `Dự án ${project?.name || projectId} - nhóm ${group?.name || groupId}. Hãy chọn đúng rubric để bắt đầu chấm điểm.`,
            `Project ${project?.name || projectId} - group ${group?.name || groupId}. Select the correct rubric to start grading.`,
          )}
        </p>
      </div>

      {visibleRubrics.length === 0 ? (
        <Card className="rounded-3xl border-slate-200 p-10 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <HelpCircle className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">
            {tr(language, "Dự án này chưa có rubric đang dùng.", "No active rubrics available for new grading.")}
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {tr(
              language,
              "Các rubric hiện tại đều đã lưu trữ. Bật tùy chọn hiển thị rubric lưu trữ hoặc khôi phục một rubric ở trang quản lý.",
              "All current rubrics are archived. Show archived rubrics or restore one from the management page.",
            )}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {visibleRubrics.map((summary) => (
            <Card
              key={summary.rubric.id}
              className="rounded-3xl border-slate-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 rounded-xl bg-indigo-50 p-2.5 text-indigo-600">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="truncate pr-4 font-bold text-slate-900" title={summary.rubric.name}>
                      {summary.rubric.name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="max-w-[220px] truncate" title={summary.rubric.original_file_name || "Mẫu mặc định"}>
                        {summary.rubric.original_file_name || tr(language, "Mẫu mặc định", "Default template")}
                      </span>
                      {summary.selectedSheetName ? <span>• {summary.selectedSheetName}</span> : null}
                    </div>
                  </div>
                </div>

                <Badge
                  className={
                    summary.rubric.status === "archived"
                      ? "border-none bg-slate-200 text-slate-700 hover:bg-slate-200"
                      : "border-none bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                  }
                >
                  {summary.rubric.status === "archived" ? "Đã lưu trữ" : "Đang dùng"}
                </Badge>
              </div>

              {summary.rubric.description ? (
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-600">
                  {summary.rubric.description}
                </div>
              ) : null}

              <dl className="mt-5 grid grid-cols-2 gap-3 text-xs text-slate-500">
                <div>
                  <dt>Số dòng / cột</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {summary.rowCount} / {summary.columnCount}
                  </dd>
                </div>
                <div>
                  <dt>Số nhóm đã dùng</dt>
                  <dd className="mt-1 font-medium text-slate-900">{summary.usageCount}</dd>
                </div>
                <div>
                  <dt>Tạo bởi</dt>
                  <dd className="mt-1 font-medium text-slate-900">{summary.createdByName}</dd>
                </div>
                <div>
                  <dt>Cập nhật</dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {new Date(summary.rubric.updated_at).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")}
                  </dd>
                </div>
              </dl>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                <Button
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => navigate(`/lecturer/rubrics/${summary.rubric.id}`)}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  {tr(language, "Xem rubric", "View rubric")}
                </Button>
                <Button
                  onClick={() =>
                    navigate(`/lecturer/grading/projects/${projectId}/groups/${groupId}/rubrics/${summary.rubric.id}`)
                  }
                  className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  <PlayCircle className="mr-2 h-4 w-4" />
                  {tr(language, "Dùng rubric này để chấm", "Use this rubric to grade")}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default LecturerGradingProjectGroups;
