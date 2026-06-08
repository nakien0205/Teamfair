import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam } from "@/context/TeamContext";
import { tr } from "@/lib/i18n";
import { canManageRubric, parseStoredRubricTemplate } from "@/lib/rubricModel";
import { getAccessibleRubricProjects } from "@/lib/rubricProjectAccess";
import {
  duplicateRubric,
  fetchRubricSummaryById,
  fetchRubricTemplateByRubricId,
  type RubricSummary,
} from "@/lib/rubricPersistence";
import DuplicateRubricDialog from "@/components/rubrics/DuplicateRubricDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  Eye,
  FileSpreadsheet,
  Loader2,
  PencilLine,
} from "lucide-react";

const LecturerRubricDetail = () => {
  const { rubricId } = useParams<{ rubricId: string }>();
  const { profile, user } = useAuth();
  const { groups } = useTeam();
  const { language } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<RubricSummary | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [templateWarning, setTemplateWarning] = useState<string | null>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const currentRole =
    profile?.role ||
    ((user?.user_metadata?.app_role ||
      user?.app_metadata?.role ||
      user?.user_metadata?.role) as "student" | "lecturer" | "admin" | undefined);
  const projects = useMemo(
    () => getAccessibleRubricProjects(groups, user?.id, currentRole).map((group) => ({ id: group.id, name: group.name })),
    [currentRole, groups, user?.id],
  );

  useEffect(() => {
    const load = async () => {
      if (!rubricId) return;

      try {
        setLoading(true);
        setError(null);
        setTemplateWarning(null);
        setHeaders([]);
        setRows([]);

        const loadedSummary = await fetchRubricSummaryById(rubricId);
        setSummary(loadedSummary);

        try {
          const loadedTemplate = loadedSummary.template ?? (await fetchRubricTemplateByRubricId(rubricId));

          if (!loadedTemplate) {
            setTemplateWarning(
              tr(
                language,
                "Rubric này chưa có cấu trúc bảng khả dụng hoặc dữ liệu template không còn đầy đủ.",
                "This rubric does not currently have a usable table structure or the template data is incomplete.",
              ),
            );
            return;
          }

          const parsed = parseStoredRubricTemplate(
            loadedTemplate.table_json,
            loadedTemplate.columns_json,
            loadedTemplate.settings_json,
          );

          setHeaders(parsed.headers);
          setRows(parsed.rows);
        } catch (templateError) {
          setTemplateWarning(
            templateError instanceof Error
              ? templateError.message
              : tr(language, "Không thể tải cấu trúc rubric template.", "Unable to load rubric template structure."),
          );
        }
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [language, rubricId]);

  const canManage = useMemo(
    () =>
      canManageRubric({
        currentUserId: user?.id,
        currentUserRole: currentRole,
        createdBy: summary?.rubric.created_by,
      }),
    [currentRole, summary?.rubric.created_by, user?.id],
  );

  const handleDuplicateSubmit = async ({ targetProjectId, newName }: { targetProjectId: string; newName: string }) => {
    if (!rubricId || !user?.id) return;

    try {
      setIsDuplicating(true);
      await duplicateRubric({
        rubricId,
        userId: user.id,
        targetProjectId,
        newName,
      });
      toast({
        title: tr(language, "Đã nhân bản rubric", "Rubric duplicated"),
        description: tr(language, "Bản sao mới đã được tạo.", "A new copy has been created."),
      });
      setDuplicateDialogOpen(false);
      navigate(`/lecturer/rubrics?projectId=${targetProjectId}`);
    } catch (duplicateError) {
      toast({
        title: tr(language, "Không thể nhân bản rubric", "Unable to duplicate rubric"),
        description: duplicateError instanceof Error ? duplicateError.message : String(duplicateError),
        variant: "destructive",
      });
    } finally {
      setIsDuplicating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <Card className="rounded-3xl border-red-200 p-8 text-center">
        <p className="text-sm text-red-600">{error || tr(language, "Không tìm thấy rubric.", "Rubric not found.")}</p>
        <Button className="mt-4 rounded-xl" variant="outline" onClick={() => navigate(-1)}>
          {tr(language, "Quay lại", "Go back")}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button variant="outline" className="rounded-xl" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {tr(language, "Quay lại", "Go back")}
        </Button>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={() => setDuplicateDialogOpen(true)}>
            <Copy className="mr-2 h-4 w-4" />
            {tr(language, "Nhân bản", "Duplicate")}
          </Button>
          {canManage ? (
            <Button
              className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
              onClick={() => navigate(`/lecturer/rubrics/${summary.rubric.id}/edit`)}
            >
              <PencilLine className="mr-2 h-4 w-4" />
              {tr(language, "Chỉnh sửa", "Edit")}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-slate-900">
          <Eye className="h-6 w-6 text-indigo-600" />
          {tr(language, "Xem rubric", "View rubric")}
        </h1>
        <p className="text-sm text-slate-500">
          {tr(language, "Xem lại metadata và bảng rubric ở chế độ chỉ đọc.", "Review rubric metadata and table in read-only mode.")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 rounded-3xl border-slate-200 p-6 shadow-sm">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-slate-900">{summary.rubric.name}</h2>
            <p className="text-sm text-slate-500">
              {summary.rubric.description || tr(language, "Chưa có mô tả.", "No description.")}
            </p>
          </div>

          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Dự án</dt><dd className="text-right font-medium text-slate-900">{summary.projectName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">File gốc</dt><dd className="text-right font-medium text-slate-900">{summary.rubric.original_file_name || "-"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Sheet đã import</dt><dd className="text-right font-medium text-slate-900">{summary.selectedSheetName || "-"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Hiển thị</dt><dd className="text-right font-medium text-slate-900">{summary.rubric.visibility === "private" ? "Riêng tư" : "Theo dự án"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Trạng thái</dt><dd className="text-right font-medium text-slate-900">{summary.rubric.status === "archived" ? "Đã lưu trữ" : "Đang dùng"}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Số nhóm đã dùng</dt><dd className="text-right font-medium text-slate-900">{summary.usageCount}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Tạo bởi</dt><dd className="text-right font-medium text-slate-900">{summary.createdByName}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Ngày tạo</dt><dd className="text-right font-medium text-slate-900">{new Date(summary.rubric.created_at).toLocaleString(language === "vi" ? "vi-VN" : "en-US")}</dd></div>
            <div className="flex justify-between gap-4"><dt className="text-slate-500">Cập nhật</dt><dd className="text-right font-medium text-slate-900">{new Date(summary.rubric.updated_at).toLocaleString(language === "vi" ? "vi-VN" : "en-US")}</dd></div>
          </dl>
        </Card>

        <Card className="rounded-3xl border-slate-200 p-6 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-900">
            <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
            Bảng rubric
          </div>

          {templateWarning ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-medium">{tr(language, "Không thể hiển thị bảng rubric", "Unable to display rubric table")}</p>
                  <p className="mt-1">{templateWarning}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="min-w-[720px] w-full border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    {headers.map((header) => (
                      <th key={header} className="border-r border-slate-200 px-3 py-2 text-left font-semibold text-slate-700 last:border-r-0">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={`row-${index}`} className="border-b border-slate-100 last:border-b-0">
                      {headers.map((header) => (
                        <td key={`${header}-${index}`} className="border-r border-slate-100 px-3 py-2 text-slate-700 last:border-r-0">
                          {row[header] || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <DuplicateRubricDialog
        open={duplicateDialogOpen}
        onOpenChange={setDuplicateDialogOpen}
        sourceRubric={summary}
        projects={projects}
        language={language}
        mode="duplicate"
        isSubmitting={isDuplicating}
        onSubmit={handleDuplicateSubmit}
      />
    </div>
  );
};

export default LecturerRubricDetail;
