import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ClipboardPenLine,
  Lightbulb,
  MessageSquareQuote,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { useTeam } from "@/context/TeamContext";
import { getStudentContributionData, getStudentPeerReviewActive } from "@/lib/studentApi";
import { listStudentWorkLogs, type WorkLogRecord } from "@/lib/workLogs";
import { cn } from "@/lib/utils";
import { getOrFetchAnalysis, type ContributionAiAnalysis } from "@/lib/contributionAi";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const riskMeta = {
  normal: { label: "Bình thường", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  attention: { label: "Cần chú ý", className: "border-amber-200 bg-amber-50 text-amber-700" },
  high: { label: "Rủi ro cao", className: "border-rose-200 bg-rose-50 text-rose-700" },
} as const;

const confidenceMeta: Record<ContributionAiAnalysis["confidence_tag"], { label: string; className: string }> = {
  well_supported: { label: "Đáng tin cậy", className: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  partially_supported: { label: "Có hạn chế", className: "border-amber-200 bg-amber-50 text-amber-700" },
  insufficient_evidence: { label: "Thiếu dữ liệu", className: "border-slate-200 bg-slate-50 text-slate-600" },
};

const timelineMeta: Record<ContributionAiAnalysis["timeline_assessment"], string> = {
  regular: "Đều đặn",
  front_loaded: "Tập trung đầu",
  back_loaded: "Tập trung cuối",
  sporadic: "Không đều",
};

const LoadingState = () => (
  <div className="space-y-6">
    <Skeleton className="h-28 rounded-3xl" />
    <Skeleton className="h-[420px] rounded-3xl" />
    <Skeleton className="h-[360px] rounded-3xl" />
  </div>
);

const StudentMyContribution = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { groups, currentGroupIndex, tasks, lecturerStudentReviews, currentUserName } = useTeam();

  const [workLogs, setWorkLogs] = useState<WorkLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePeriodLabel, setActivePeriodLabel] = useState("Giai đoạn hiện tại");
  const [result, setResult] = useState<Awaited<ReturnType<typeof getStudentContributionData>> | null>(null);

  // AI analysis state (separate from main data flow)
  const [aiAnalysis, setAiAnalysis] = useState<ContributionAiAnalysis | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(false);

  const group = groups[currentGroupIndex] || groups[0];
  const myTasks = useMemo(
    () => tasks.filter(task => (user?.id ? task.assigneeId === user.id : task.assignedTo === currentUserName)),
    [currentUserName, tasks, user?.id],
  );
  const myLeaderReviews = useMemo(
    () => lecturerStudentReviews.filter(review => review.studentName.trim().toLowerCase() === currentUserName.trim().toLowerCase()),
    [currentUserName, lecturerStudentReviews],
  );

  // Main data loading
  useEffect(() => {
    if (!user?.id || !group?.id) {
      setLoading(false);
      setResult(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    void Promise.all([
      listStudentWorkLogs(user.id, group.id),
      getStudentPeerReviewActive(group.id),
    ])
      .then(async ([logs, periods]) => {
        if (cancelled) return;
        setWorkLogs(logs);
        setActivePeriodLabel(periods[0]?.milestoneLabel || periods[0]?.title || "Giai đoạn hiện tại");
        const contribution = await getStudentContributionData({
          tasks: myTasks,
          workLogs: logs,
          leaderReviews: myLeaderReviews,
          activePeriodId: periods[0]?.id || null,
          studentId: user.id,
        });
        if (!cancelled) setResult(contribution);
      })
      .catch(fetchError => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Không thể tải dữ liệu contribution.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [group?.id, myLeaderReviews, myTasks, user?.id]);

  // AI analysis loading (separate, doesn't block page)
  const fetchAi = useCallback(
    (forceRefresh = false) => {
      if (!user?.id || !group?.id || !result?.hasEnoughData) return;
      setAiLoading(true);
      setAiError(false);

      void getOrFetchAnalysis({
        studentId: user.id,
        studentName: profile?.full_name || currentUserName,
        groupId: group.id,
        groupName: group.name,
        deterministic_score: result.referenceScore,
        tasks: myTasks,
        workLogs,
        leaderReviews: myLeaderReviews,
        peerReviewAverage: result.evidenceSummary.peerReviewAverage,
        forceRefresh,
      })
        .then(analysis => {
          setAiAnalysis(analysis);
          if (!analysis) setAiError(true);
        })
        .catch(() => setAiError(true))
        .finally(() => setAiLoading(false));
    },
    [user?.id, group?.id, group?.name, result, myTasks, workLogs, myLeaderReviews, currentUserName, profile?.full_name],
  );

  useEffect(() => {
    if (result?.hasEnoughData) {
      fetchAi(false);
    }
  }, [result?.hasEnoughData, fetchAi]);

  const hasAiInsights =
    aiAnalysis && ((aiAnalysis.anomalies.length > 0) || (aiAnalysis.recommendations.length > 0));

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_42%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--card))_100%)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
          {loading ? <LoadingState /> : null}

          {!loading && error ? (
            <Alert className="rounded-3xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Không thể tải điểm đóng góp</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {!loading && !group ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Bạn chưa được phân vào nhóm nào.
              </CardContent>
            </Card>
          ) : null}

          {!loading && group ? (
            <>
              {/* ── 1. Header Card ── */}
              <Card className="rounded-3xl border-0 shadow-card">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border border-primary/15 bg-primary/10 text-primary hover:bg-primary/10">
                      {tr(language, "Điểm đóng góp tham khảo", "Reference Contribution Score")}
                    </Badge>
                    <Badge variant="outline" className="border-border/70 bg-background/80 text-muted-foreground">
                      {group.name}
                    </Badge>
                    {aiAnalysis ? (
                      <Badge className={cn("border", confidenceMeta[aiAnalysis.confidence_tag].className)}>
                        <Sparkles className="mr-1 h-3 w-3" />
                        AI: {confidenceMeta[aiAnalysis.confidence_tag].label}
                      </Badge>
                    ) : null}
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{profile?.full_name || currentUserName}</h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {tr(language, "Điểm đóng góp chỉ mang tính tham khảo. Quyết định cuối cùng thuộc về giảng viên.", "Contribution scores are for reference only. The final decision rests with the instructor.")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {!result?.hasEnoughData ? (
                <Card className="rounded-3xl border-0 shadow-card">
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                      {tr(language, "Chưa có đủ dữ liệu để tính điểm đóng góp.", "Not enough data available to calculate contribution score.")}
                  </CardContent>
                </Card>
              ) : null}

              {result?.hasEnoughData ? (
                <>
                  {/* ── 2. Score + AI Summary row ── */}
                  <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                    {/* Left: Reference score card */}
                    <Card className="rounded-3xl border-0 shadow-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl">Điểm tham khảo hiện tại</CardTitle>
                        <CardDescription>Không phải điểm cuối cùng của học phần hoặc đồ án.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Reference Contribution Score</p>
                            <p className="mt-1 text-5xl font-semibold tracking-tight">{result.referenceScore}</p>
                          </div>
                          <Badge className={cn("border", riskMeta[result.riskLevel].className)}>
                            {riskMeta[result.riskLevel].label}
                          </Badge>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">
                          Cập nhật gần nhất: {result.lastUpdatedAt ? dateFormatter.format(new Date(result.lastUpdatedAt)) : "Chưa rõ"}
                        </div>
                        <div className="rounded-2xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
                          <p>Điểm đóng góp chỉ mang tính tham khảo. Quyết định cuối cùng thuộc về giảng viên.</p>
                          <p className="mt-2">
                            Cờ rủi ro chỉ là cảnh báo để xem xét thêm, không phải hình thức xử lý tự động.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Right: AI Effort Summary card */}
                    <Card className="rounded-3xl border-0 shadow-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-primary/70" />
                          <CardTitle className="text-xl">Phân tích AI</CardTitle>
                        </div>
                        <CardDescription>Nhận xét tổng hợp từ AI dựa trên dữ liệu đóng góp hiện có.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {aiLoading ? (
                          <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-4/5" />
                            <Skeleton className="h-4 w-3/5" />
                          </div>
                        ) : aiAnalysis ? (
                          <>
                            <div className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm leading-7">
                              {aiAnalysis.effort_summary}
                            </div>
                            {aiAnalysis.reasoning ? (
                              <div className="rounded-2xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
                                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">Lý do phân tích</p>
                                {aiAnalysis.reasoning}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm text-muted-foreground">
                            {aiError ? "Không thể kết nối tới máy chủ phân tích AI." : "Đang chờ phân tích AI..."}
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-2xl text-xs"
                            disabled={aiLoading}
                            onClick={() => fetchAi(true)}
                          >
                            <RefreshCw className={cn("mr-1.5 h-3 w-3", aiLoading && "animate-spin")} />
                            Phân tích lại
                          </Button>
                          {aiAnalysis ? (
                            <Badge className={cn("border text-xs", confidenceMeta[aiAnalysis.confidence_tag].className)}>
                              {confidenceMeta[aiAnalysis.confidence_tag].label}
                            </Badge>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* ── 3. AI Insights Card ── */}
                  {hasAiInsights ? (
                    <Card className="rounded-3xl border-0 shadow-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="h-5 w-5 text-amber-500" />
                          <CardTitle className="text-xl">Gợi ý từ AI</CardTitle>
                        </div>
                        <CardDescription>Phát hiện bất thường và đề xuất cải thiện dựa trên phân tích dữ liệu.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          {/* Anomalies */}
                          {aiAnalysis!.anomalies.length > 0 ? (
                            <div className="space-y-3">
                              <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800">
                                <ShieldAlert className="h-4 w-4" />
                                Bất thường phát hiện
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {aiAnalysis!.anomalies.map((anomaly, i) => (
                                  <Badge key={i} className="border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-50">
                                    {anomaly}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* Recommendations */}
                          {aiAnalysis!.recommendations.length > 0 ? (
                            <div className="space-y-3">
                              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-800">
                                <TrendingUp className="h-4 w-4" />
                                Đề xuất cải thiện
                              </p>
                              <ul className="space-y-1.5 text-sm text-muted-foreground">
                                {aiAnalysis!.recommendations.map((rec, i) => (
                                  <li key={i} className="flex gap-2">
                                    <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                                    {rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>

                        {/* Timeline assessment badge */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">Nhịp độ làm việc:</span>
                          <Badge variant="outline" className="border-border/70 bg-background text-muted-foreground text-xs">
                            {timelineMeta[aiAnalysis!.timeline_assessment]}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {/* ── 4. Score Breakdown ── */}
                  <Card className="rounded-3xl border-0 shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl">Score breakdown</CardTitle>
                      <CardDescription>Hiển thị từng thành phần và trọng số dùng cho điểm tham khảo.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {result.breakdown.map(item => (
                        <div key={item.key} className={cn("rounded-2xl border border-border/70 bg-background/80 p-4", !item.hasData && "opacity-60")}>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{item.label}</p>
                            <div className="flex items-center gap-1.5">
                              {!item.hasData ? (
                                <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-500 text-[10px]">
                                  N/A
                                </Badge>
                              ) : null}
                              <Badge variant="outline" className="border-border/70 bg-background text-muted-foreground">
                                {item.weight}%
                              </Badge>
                            </div>
                          </div>
                          <p className="mt-3 text-2xl font-semibold">{item.hasData ? item.score : "—"}</p>
                          <Progress value={item.hasData ? item.score : 0} className="mt-3 h-2.5 bg-muted" />
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.explanation}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* ── 5. Evidence Summary + Leader Feedback ── */}
                  <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                    <Card className="rounded-3xl border-0 shadow-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl">Evidence summary</CardTitle>
                        <CardDescription>Dữ liệu hệ thống đang dùng để ước lượng contribution.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Assigned tasks</p>
                          <p className="mt-2 text-2xl font-semibold">{result.evidenceSummary.assignedTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Approved tasks</p>
                          <p className="mt-2 text-2xl font-semibold">{result.evidenceSummary.approvedTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Pending tasks</p>
                          <p className="mt-2 text-2xl font-semibold">{result.evidenceSummary.pendingTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Rejected tasks</p>
                          <p className="mt-2 text-2xl font-semibold">{result.evidenceSummary.rejectedTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Late tasks</p>
                          <p className="mt-2 text-2xl font-semibold">{result.evidenceSummary.lateTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Average quality rating</p>
                          <p className="mt-2 text-2xl font-semibold">
                            {result.evidenceSummary.averageQualityRating ?? "—"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Peer review average</p>
                          <p className="mt-2 text-2xl font-semibold">{result.evidenceSummary.peerReviewAverage ?? "—"}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Work logs</p>
                          <p className="mt-2 text-2xl font-semibold">{result.evidenceSummary.workLogCount}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border-0 shadow-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl">Leader feedback summary</CardTitle>
                        <CardDescription>Không hiển thị comment peer review riêng tư của thành viên khác.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm leading-7">
                          {result.evidenceSummary.leaderFeedbackSummary}
                        </div>

                        {result.riskReasons.length > 0 ? (
                          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                            <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                              <ShieldAlert className="h-4 w-4" />
                              Lý do cần chú ý
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {result.riskReasons.map(reason => (
                                <Badge key={reason} className="border border-amber-200 bg-white text-amber-800 hover:bg-white">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        <div className="flex flex-col gap-3 sm:flex-row">
                          <Button type="button" className="rounded-2xl" onClick={() => navigate("/student/my-tasks")}>
                            Xem task liên quan
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                          <Button type="button" variant="outline" className="rounded-2xl" onClick={() => navigate("/student/feedback")}>
                            <MessageSquareQuote className="mr-2 h-4 w-4" />
                            Xem feedback
                          </Button>
                          {result.canAppeal ? (
                            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => navigate("/student/appeals")}>
                              <ClipboardPenLine className="mr-2 h-4 w-4" />
                              Gửi giải trình
                            </Button>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default StudentMyContribution;
