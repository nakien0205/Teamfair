import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, ShieldCheck, Star, Users } from "lucide-react";
import StudentShell from "@/components/student/StudentShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { t, tr } from "@/lib/i18n";
import { useTeam } from "@/context/TeamContext";
import {
  getStudentPeerReviewActive,
  getStudentPeerReviewStatus,
  submitStudentPeerReview,
} from "@/lib/studentApi";
import {
  getPeerReviewTargets,
  type PeerReviewInput,
  type PeerReviewPeriod,
  type PeerReviewStatus,
} from "@/lib/studentPeerReview";
import { cn } from "@/lib/utils";

type ReviewDraft = Omit<PeerReviewInput, "revieweeId">;

const criteria = [
  { key: "completionScore", label: "Mức độ hoàn thành công việc được giao" },
  { key: "deadlineScore", label: "Mức độ đúng deadline" },
  { key: "collaborationScore", label: "Mức độ hợp tác với nhóm" },
  { key: "responsivenessScore", label: "Mức độ phản hồi khi nhóm cần" },
  { key: "overallScore", label: "Chất lượng đóng góp tổng thể" },
] as const;

const scoreLabels = ["Rất thấp", "Thấp", "Trung bình", "Tốt", "Rất tốt"];

const emptyDraft = (): ReviewDraft => ({
  completionScore: 0,
  deadlineScore: 0,
  collaborationScore: 0,
  responsivenessScore: 0,
  overallScore: 0,
  comment: "",
});

const LoadingState = () => (
  <div className="space-y-6">
    <Skeleton className="h-28 rounded-3xl" />
    <Skeleton className="h-[480px] rounded-3xl" />
  </div>
);

const StudentPeerReview = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const { groups, currentGroupIndex, addLog } = useTeam();

  const [periods, setPeriods] = useState<PeerReviewPeriod[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>("");
  const [reviewStatus, setReviewStatus] = useState<PeerReviewStatus | null>(null);
  const [drafts, setDrafts] = useState<Record<string, ReviewDraft>>({});
  const [honestyConfirmed, setHonestyConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const group = groups[currentGroupIndex] || groups[0];
  const targets = useMemo(() => getPeerReviewTargets(group, user?.id), [group, user?.id]);
  const selectedPeriod = useMemo(
    () => periods.find(period => period.id === selectedPeriodId) || null,
    [periods, selectedPeriodId],
  );

  useEffect(() => {
    if (!group?.id || !user?.id) {
      setPeriods([]);
      setSelectedPeriodId("");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    void getStudentPeerReviewActive(group.id)
      .then(data => {
        if (cancelled) return;
        setPeriods(data);
        setSelectedPeriodId(current => current || data[0]?.id || "");
      })
      .catch(fetchError => {
        if (cancelled) return;
        setError(fetchError instanceof Error ? fetchError.message : "Không thể tải kỳ đánh giá.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [group?.id, user?.id]);

  useEffect(() => {
    if (!selectedPeriodId || !user?.id) {
      setReviewStatus(null);
      return;
    }

    let cancelled = false;
    setStatusLoading(true);
    void getStudentPeerReviewStatus(selectedPeriodId, user.id)
      .then(data => {
        if (!cancelled) setReviewStatus(data);
      })
      .catch(fetchError => {
        if (!cancelled) setError(fetchError instanceof Error ? fetchError.message : "Không thể tải trạng thái đánh giá.");
      })
      .finally(() => {
        if (!cancelled) setStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedPeriodId, user?.id]);

  const handleScoreChange = (
    memberId: string,
    key: keyof ReviewDraft,
    value: number | string,
  ) => {
    setDrafts(current => ({
      ...current,
      [memberId]: {
        ...(current[memberId] || emptyDraft()),
        [key]: value,
      },
    }));
    setError("");
  };

  const handleSubmit = async () => {
    
    if (!group?.id || !user?.id || !selectedPeriod) return;
    setSubmitting(true);
    setError("");

    try {
      const reviews: PeerReviewInput[] = targets.map(target => ({
        revieweeId: target.id,
        ...(drafts[target.id] || emptyDraft()),
      }));

      await submitStudentPeerReview({
        groupId: group.id,
        period: selectedPeriod,
        reviewerId: user.id,
        reviews,
        honestyConfirmed,
        targets,
        alreadySubmitted: Boolean(reviewStatus?.submitted),
      });

      addLog(`Sinh viên ${profile?.full_name || user.email || "người dùng"} đã gửi đánh giá chéo cho kỳ "${selectedPeriod.title}".`);
      setReviewStatus({
        periodId: selectedPeriod.id,
        reviewerId: user.id,
        submitted: true,
        submittedAt: new Date().toISOString(),
      });
      toast({
        title: "Đã gửi đánh giá",
        description: "Đánh giá chéo đã được ghi nhận cho kỳ hiện tại.",
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Không thể gửi đánh giá chéo.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_42%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--card))_100%)]">
          <div className="mx-auto max-w-6xl px-4 py-6 md:px-6">
            <LoadingState />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_42%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--card))_100%)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
          <Card className="rounded-3xl border-0 shadow-card">
            <CardContent className="space-y-4 p-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="border border-primary/15 bg-primary/10 text-primary hover:bg-primary/10">
                  {tr(language, "Đánh giá chéo", "Peer Review")}
                </Badge>
                {group?.name ? (
                  <Badge variant="outline" className="border-border/70 bg-background/80 text-muted-foreground">
                    {group.name}
                  </Badge>
                ) : null}
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{tr(language, "Đánh giá thành viên trong nhóm", "Peer Review")}</h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                  {tr(language, "Đánh giá chéo là dữ liệu tham khảo để giảng viên xem xét contribution. Vui lòng đánh giá công bằng và có trách nhiệm.", "Peer review is reference data for instructors to evaluate contributions. Please review fairly and responsibly.")}
                </p>
              </div>
            </CardContent>
          </Card>

          {!group ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Bạn chưa được phân vào nhóm nào.
              </CardContent>
            </Card>
          ) : null}

          {error ? (
            <Alert className="rounded-3xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{tr(language, "Không thể xử lý đánh giá chéo", "Cannot Process Peer Review")}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {group && periods.length > 0 ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-xl">{tr(language, "Kỳ đánh giá hiện có", "Current Review Periods")}</CardTitle>
                <CardDescription>{tr(language, "Chọn một kỳ đang mở để gửi đánh giá chéo.", "Select an open period to submit a peer review.")}</CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={selectedPeriodId} onValueChange={setSelectedPeriodId}>
                  <SelectTrigger className="max-w-md rounded-2xl">
                    <SelectValue placeholder="Chọn kỳ đánh giá" />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map(period => (
                      <SelectItem key={period.id} value={period.id}>
                        {period.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          ) : null}

          {group && periods.length === 0 ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                {tr(language, "Hiện chưa có kỳ đánh giá chéo nào đang mở.", "No peer review periods are currently open.")}
              </CardContent>
            </Card>
          ) : null}

          {group && selectedPeriod && targets.length === 0 ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Không có thành viên nào khác trong nhóm để đánh giá.
              </CardContent>
            </Card>
          ) : null}

          {group && selectedPeriod && reviewStatus?.submitted ? (
            <Alert className="rounded-3xl border-emerald-200 bg-emerald-50 text-emerald-900 [&>svg]:text-emerald-700">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Bạn đã hoàn thành đánh giá chéo cho kỳ này.</AlertTitle>
              <AlertDescription>
                Trạng thái đã gửi được lưu lại và chỉ có thể mở lại nếu giảng viên cho phép.
              </AlertDescription>
            </Alert>
          ) : null}

          {group && selectedPeriod && !reviewStatus?.submitted ? (
            <>
              {statusLoading ? (
                <Skeleton className="h-20 rounded-3xl" />
              ) : null}

              <div className="space-y-4">
                {targets.map(target => {
                  const draft = drafts[target.id] || emptyDraft();
                  const hasLowScore = [
                    draft.completionScore,
                    draft.deadlineScore,
                    draft.collaborationScore,
                    draft.responsivenessScore,
                    draft.overallScore,
                  ].some(score => score > 0 && score <= 2);

                  return (
                    <Card key={target.id} className="rounded-3xl border-0 shadow-card">
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <CardTitle className="text-xl">{target.fullName}</CardTitle>
                          <Badge variant="outline" className="border-border/70 bg-background/80 text-muted-foreground">
                            {target.role === "Leader" ? "Nhóm trưởng" : "Thành viên"}
                          </Badge>
                        </div>
                        <CardDescription>
                          Đánh giá dựa trên quá trình làm việc thực tế, không dùng làm căn cứ duy nhất cho contribution.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                          {criteria.map(item => (
                            <div key={item.key} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                              <p className="text-sm font-medium leading-6">{item.label}</p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {scoreLabels.map((label, index) => {
                                  const score = index + 1;
                                  const selected = draft[item.key] === score;
                                  return (
                                    <Button
                                      key={label}
                                      type="button"
                                      variant={selected ? "default" : "outline"}
                                      className={cn("h-auto rounded-2xl px-3 py-2 text-left", selected ? "" : "bg-background")}
                                      onClick={() => handleScoreChange(target.id, item.key, score)}
                                    >
                                      <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs">
                                        {score}
                                      </span>
                                      {label}
                                    </Button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`comment-${target.id}`}>Nhận xét cụ thể</Label>
                          <Textarea
                            id={`comment-${target.id}`}
                            value={draft.comment}
                            onChange={event => handleScoreChange(target.id, "comment", event.target.value)}
                            placeholder="Mô tả ngắn gọn điểm mạnh, điểm cần cải thiện hoặc tình huống phối hợp trong nhóm..."
                            className="min-h-[120px] rounded-2xl"
                          />
                          <p className="text-xs text-muted-foreground">
                            Nhận xét là bắt buộc khi bạn cho bất kỳ tiêu chí nào ở mức 1 hoặc 2.
                          </p>
                          {hasLowScore && draft.comment.trim().length < 20 ? (
                            <p className="text-sm text-destructive">Vui lòng nhập nhận xét khi cho điểm thấp.</p>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card className="rounded-3xl border-0 shadow-card">
                <CardContent className="space-y-4 p-6">
                  <div className="flex items-start gap-3 rounded-2xl border border-border/70 bg-background/80 p-4">
                    <Checkbox
                      id="peer-review-honesty"
                      checked={honestyConfirmed}
                      onCheckedChange={checked => setHonestyConfirmed(Boolean(checked))}
                    />
                    <div className="space-y-1">
                      <Label htmlFor="peer-review-honesty" className="cursor-pointer text-sm font-medium">
                        Tôi xác nhận đánh giá này là trung thực và dựa trên quá trình làm việc thực tế.
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Dữ liệu đánh giá có thể được đối chiếu với task, submission, work log và phản hồi của nhóm.
                      </p>
                    </div>
                  </div>

                  <Alert className="rounded-2xl border-border bg-background/80">
                    <ShieldCheck className="h-4 w-4" />
                    <AlertTitle>Lưu ý về tính riêng tư</AlertTitle>
                    <AlertDescription>
                      Đánh giá chéo không hiển thị trực tiếp cho sinh viên khác. Nếu dữ liệu đánh giá mâu thuẫn với task hoặc minh chứng,
                      hệ thống sẽ đánh dấu để giảng viên xem xét.
                    </AlertDescription>
                  </Alert>

                  <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={() => navigate("/student/dashboard")}>
                      Hủy
                    </Button>
                    <Button type="button" className="rounded-2xl" onClick={() => void handleSubmit()} disabled={submitting}>
                      {submitting ? "Đang gửi..." : <><Star className="mr-2 h-4 w-4" />Gửi đánh giá</>}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default StudentPeerReview;
