import { useEffect, useMemo, useState } from "react";
import { tr } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RubricSummary } from "@/lib/rubricPersistence";

type DuplicateRubricDialogMode = "duplicate" | "apply";

type ProjectOption = {
  id: string;
  name: string;
};

interface DuplicateRubricDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceRubric: RubricSummary | null;
  projects: ProjectOption[];
  language: "vi" | "en";
  mode: DuplicateRubricDialogMode;
  isSubmitting: boolean;
  onSubmit: (payload: { targetProjectId: string; newName: string }) => Promise<void> | void;
}

function buildSuggestedName(sourceName: string, targetProjectName: string | null, useProjectName: boolean) {
  if (useProjectName && targetProjectName) {
    return `${sourceName} - ${targetProjectName}`;
  }

  return `${sourceName} - Bản sao`;
}

const DuplicateRubricDialog = ({
  open,
  onOpenChange,
  sourceRubric,
  projects,
  language,
  mode,
  isSubmitting,
  onSubmit,
}: DuplicateRubricDialogProps) => {
  const [targetProjectId, setTargetProjectId] = useState("");
  const [newRubricName, setNewRubricName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const availableProjects = useMemo(() => {
    if (!sourceRubric) return [];
    if (mode === "apply") {
      return projects.filter((project) => project.id !== sourceRubric.rubric.project_id);
    }
    return projects;
  }, [mode, projects, sourceRubric]);

  const selectedTargetProject = useMemo(
    () => availableProjects.find((project) => project.id === targetProjectId) || null,
    [availableProjects, targetProjectId],
  );

  useEffect(() => {
    if (!open || !sourceRubric) return;

    const defaultProjectId =
      mode === "duplicate"
        ? availableProjects.find((project) => project.id === sourceRubric.rubric.project_id)?.id || availableProjects[0]?.id || ""
        : availableProjects[0]?.id || "";

    setTargetProjectId(defaultProjectId);
    setNameTouched(false);
    setValidationError(null);

    const defaultProjectName = availableProjects.find((project) => project.id === defaultProjectId)?.name || null;
    const useProjectName = !!defaultProjectId && defaultProjectId !== sourceRubric.rubric.project_id;
    setNewRubricName(buildSuggestedName(sourceRubric.rubric.name, defaultProjectName, useProjectName));
  }, [availableProjects, mode, open, sourceRubric]);

  useEffect(() => {
    if (!sourceRubric || nameTouched) return;

    const useProjectName = !!targetProjectId && targetProjectId !== sourceRubric.rubric.project_id;
    setNewRubricName(
      buildSuggestedName(sourceRubric.rubric.name, selectedTargetProject?.name || null, useProjectName),
    );
  }, [nameTouched, selectedTargetProject?.name, sourceRubric, targetProjectId]);

  const handleSubmit = async () => {
    if (!sourceRubric) return;

    if (!targetProjectId) {
      setValidationError("Vui lòng chọn dự án đích.");
      return;
    }

    if (!newRubricName.trim()) {
      setValidationError("Vui lòng nhập tên rubric mới.");
      return;
    }

    setValidationError(null);
    await onSubmit({
      targetProjectId,
      newName: newRubricName.trim(),
    });
  };

  const noProjectMessage = tr(
    language,
    "Bạn chưa có dự án phù hợp để nhân bản rubric này.",
    "You do not have a suitable project for duplicating this rubric.",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{tr(language, "Nhân bản Rubric", "Duplicate rubric")}</DialogTitle>
          <DialogDescription>
            {tr(
              language,
              "Chọn dự án đích và tên rubric mới. Kết quả chấm cũ sẽ không được sao chép.",
              "Choose the target project and new rubric name. Existing grading results will not be copied.",
            )}
          </DialogDescription>
        </DialogHeader>

        {sourceRubric ? (
          <div className="space-y-4">
            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {tr(language, "Rubric gốc", "Original rubric")}
                </p>
                <p className="mt-1 font-semibold text-slate-900">{sourceRubric.rubric.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  {tr(language, "Dự án gốc", "Original project")}
                </p>
                <p className="mt-1 font-semibold text-slate-900">{sourceRubric.projectName}</p>
              </div>
            </div>

            {availableProjects.length === 0 ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {noProjectMessage}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="duplicate-rubric-target-project">
                    {tr(language, "Dự án đích", "Target project")}
                  </Label>
                  <Select value={targetProjectId} onValueChange={setTargetProjectId}>
                    <SelectTrigger id="duplicate-rubric-target-project" className="rounded-xl">
                      <SelectValue placeholder={tr(language, "Chọn dự án", "Select project")} />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {availableProjects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="duplicate-rubric-name">
                    {tr(language, "Tên rubric mới", "New rubric name")}
                  </Label>
                  <Input
                    id="duplicate-rubric-name"
                    value={newRubricName}
                    onChange={(event) => {
                      setNameTouched(true);
                      setNewRubricName(event.target.value);
                    }}
                    className="rounded-xl"
                  />
                </div>
              </>
            )}

            {validationError ? <p className="text-sm text-red-600">{validationError}</p> : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            {tr(language, "Hủy", "Cancel")}
          </Button>
          <Button
            className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
            onClick={() => void handleSubmit()}
            disabled={!sourceRubric || availableProjects.length === 0 || isSubmitting}
          >
            {isSubmitting ? tr(language, "Đang nhân bản...", "Duplicating...") : tr(language, "Nhân bản rubric", "Duplicate rubric")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DuplicateRubricDialog;
