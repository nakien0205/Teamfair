import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  const aiRequestIdRef = useRef(0);

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
      aiRequestIdRef.current += 1;
      setLoading(false);
      setResult(null);
      setAiAnalysis(null);
      setAiLoading(false);
      setAiError(false);
      return;
    }

    let cancelled = false;
    aiRequestIdRef.current += 1;
    setLoading(true);
    setError("");
    setResult(null);
    setAiAnalysis(null);
    setAiLoading(false);
    setAiError(false);

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
      const requestId = aiRequestIdRef.current + 1;
      aiRequestIdRef.current = requestId;
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
          if (aiRequestIdRef.current !== requestId) return;
          setAiAnalysis(analysis);
          if (!analysis) setAiError(true);
        })
        .catch(() => {
          if (aiRequestIdRef.current === requestId) setAiError(true);
        })
        .finally(() => {
          if (aiRequestIdRef.current === requestId) setAiLoading(false);
        });
    },
    [user?.id, group?.id, group?.name, result, myTasks, workLogs, myLeaderReviews, currentUserName, profile?.full_name],
  );

  const hasAiInsights =
    aiAnalysis && ((aiAnalysis.anomalies.length > 0) || (aiAnalysis.recommendations.length > 0));

  return (
    <>
      <div className="min-h-screen bg-slate-50/50 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.05),_transparent_50%)]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-6">
          {loading ? <LoadingState /> : null}

          {!loading && error ? (
            <Alert className="rounded-2xl border-amber-300 bg-amber-50 text-amber-950 [&>svg]:text-amber-700 shadow-sm">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle className="font-bold text-amber-900">Không thể tải điểm đóng góp</AlertTitle>
              <AlertDescription className="mt-2 font-medium">{error}</AlertDescription>
            </Alert>
          ) : null}

          {!loading && !group ? (
            <Card className="rounded-3xl border border-dashed border-slate-300 bg-white shadow-sm">
              <CardContent className="p-10 text-center text-sm font-semibold text-slate-600">
                Bạn chưa được phân vào nhóm nào.
              </CardContent>
            </Card>
          ) : null}

          {!loading && group ? (
            <>
              {/* ── 1. Header Card ── */}
              <Card className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-xl shadow-slate-200/60">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-50 px-3 py-0.5 rounded-full font-bold">
                      {tr(language, "Điểm đóng góp tham khảo", "Reference Contribution Score")}
                    </Badge>
                    <Badge variant="outline" className="border border-slate-200 bg-slate-50 text-slate-800 px-3 py-0.5 rounded-full font-bold shadow-sm">
                      {group.name}
                    </Badge>
                    {aiAnalysis ? (
                      <Badge className={cn("border px-3 py-0.5 rounded-full font-bold shadow-sm text-slate-900", confidenceMeta[aiAnalysis.confidence_tag].className)}>
                        <Sparkles className="mr-1 h-3 w-3" />
                        AI: {confidenceMeta[aiAnalysis.confidence_tag].label}
                      </Badge>
                    ) : null}
                  </div>
                  <div>
                    <h1 className="text-3xl font-black tracking-tight text-slate-900 md:text-4xl">{profile?.full_name || currentUserName}</h1>
                    <p className="mt-2 text-sm leading-6 text-slate-600 font-medium">
                      {tr(language, "Điểm đóng góp chỉ mang tính tham khảo. Quyết định cuối cùng thuộc về giảng viên.", "Contribution scores are for reference only. The final decision rests with the instructor.")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {!result?.hasEnoughData ? (
                <Card className="rounded-3xl border border-dashed border-slate-300 bg-white shadow-sm">
                  <CardContent className="p-8 text-center text-sm font-semibold text-slate-600">
                      {tr(language, "Chưa có đủ dữ liệu để tính điểm đóng góp.", "Not enough data available to calculate contribution score.")}
                  </CardContent>
                </Card>
              ) : null}

              {result?.hasEnoughData ? (
                <>
                  {/* ── 2. Score + AI Summary row ── */}
                  <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                    {/* Left: Reference score card */}
                    <Card className="rounded-3xl border border-slate-200 bg-white shadow-md flex flex-col justify-between overflow-hidden">
                      <CardHeader className="pb-3 border-b border-slate-100">
                        <CardTitle className="text-xl font-bold text-slate-900">Điểm tham khảo hiện tại</CardTitle>
                        <CardDescription className="text-slate-600 font-medium">Không phải điểm cuối cùng của học phần hoặc đồ án.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4 flex-1 flex flex-col justify-between">
                        <div className="rounded-2xl border border-indigo-250 border-l-4 border-l-indigo-600 bg-indigo-50/40 p-5 pl-6 shadow-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Reference Contribution Score</p>
                              <p className="mt-1 text-5xl font-black tracking-tight text-indigo-950">{result.referenceScore}</p>
                            </div>
                            <Badge className={cn("border px-2.5 py-0.5 font-bold rounded-lg shadow-sm text-slate-900", riskMeta[result.riskLevel].className)}>
                              {riskMeta[result.riskLevel].label}
                            </Badge>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-700 shadow-sm">
                          Cập nhật gần nhất: {result.lastUpdatedAt ? dateFormatter.format(new Date(result.lastUpdatedAt)) : "Chưa rõ"}
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-xs leading-6 font-medium text-slate-600">
                          <p>Điểm đóng góp chỉ mang tính tham khảo. Quyết định cuối cùng thuộc về giảng viên.</p>
                          <p className="mt-2">
                            Cờ rủi ro chỉ là cảnh báo để xem xét thêm, không phải hình thức xử lý tự động.
                          </p>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Right: AI Effort Summary card */}
                    <Card className="rounded-3xl border border-slate-200 bg-white shadow-md overflow-hidden">
                      <CardHeader className="pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-5 w-5 text-purple-600" />
                          <CardTitle className="text-xl font-bold text-slate-900">Phân tích AI</CardTitle>
                        </div>
                        <CardDescription className="text-slate-600 font-medium">Nhận xét tổng hợp từ AI dựa trên dữ liệu đóng góp hiện có.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
                        {aiLoading ? (
                          <div className="space-y-3">
                            <Skeleton className="h-4 w-full" />
                            <Skeleton className="h-4 w-4/5" />
                            <Skeleton className="h-4 w-3/5" />
                          </div>
                        ) : aiAnalysis ? (
                          <>
                            <div className="rounded-2xl border border-purple-205 border-l-4 border-l-purple-600 bg-purple-50/40 p-5 pl-6 text-sm font-semibold text-slate-800 leading-7 shadow-sm">
                              {aiAnalysis.effort_summary}
                            </div>
                            {aiAnalysis.reasoning ? (
                              <div className="rounded-2xl border border-slate-200 border-l-4 border-l-slate-500 bg-slate-50 p-5 pl-6 text-sm leading-6 text-slate-600 font-medium mt-3">
                                <p className="mb-1 text-xs font-bold uppercase tracking-widest text-slate-500">Lý do phân tích</p>
                                {aiAnalysis.reasoning}
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-medium text-slate-600">
                            {aiError ? "Không thể kết nối tới máy chủ phân tích AI." : "Nhấn nút để chạy phân tích AI khi bạn cần."}
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-xl text-xs font-bold border-slate-300 bg-white text-slate-700 hover:bg-slate-100 transition-colors shadow-sm"
                            disabled={aiLoading}
                            onClick={() => fetchAi(Boolean(aiAnalysis))}
                          >
                            <RefreshCw className={cn("mr-1.5 h-3 w-3", aiLoading && "animate-spin")} />
                            {aiAnalysis ? "Phân tích lại" : "Chạy phân tích AI"}
                          </Button>
                          {aiAnalysis ? (
                            <Badge className={cn("border text-xs px-2.5 py-0.5 font-bold rounded-lg shadow-sm text-slate-900", confidenceMeta[aiAnalysis.confidence_tag].className)}>
                              {confidenceMeta[aiAnalysis.confidence_tag].label}
                            </Badge>
                          ) : null}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* ── 3. AI Insights Card ── */}
                  {hasAiInsights ? (
                    <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                      <CardHeader className="pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                          <Lightbulb className="h-5 w-5 text-amber-500" />
                          <CardTitle className="text-xl font-bold text-slate-900">Gợi ý từ AI</CardTitle>
                        </div>
                        <CardDescription className="text-slate-600 font-medium">Phát hiện bất thường và đề xuất cải thiện dựa trên phân tích dữ liệu.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          {/* Anomalies */}
                          {aiAnalysis!.anomalies.length > 0 ? (
                            <div className="space-y-3">
                              <p className="flex items-center gap-1.5 text-sm font-bold text-amber-800 uppercase tracking-wider">
                                <ShieldAlert className="h-4 w-4" />
                                Bất thường phát hiện
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {aiAnalysis!.anomalies.map((anomaly, i) => (
                                  <Badge key={i} className="border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded-lg font-bold px-2.5 py-0.5 shadow-sm">
                                    {anomaly}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {/* Recommendations */}
                          {aiAnalysis!.recommendations.length > 0 ? (
                            <div className="space-y-3">
                              <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-800 uppercase tracking-wider">
                                <TrendingUp className="h-4 w-4" />
                                Đề xuất cải thiện
                              </p>
                              <ul className="space-y-2 text-sm text-slate-700 font-semibold">
                                {aiAnalysis!.recommendations.map((rec, i) => (
                                  <li key={i} className="flex gap-2">
                                    <span className="mt-1 block h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 shadow-sm border border-emerald-300" />
                                    {rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>

                        {/* Timeline assessment badge */}
                        <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Nhịp độ làm việc:</span>
                          <Badge variant="outline" className="border-slate-300 bg-slate-50 text-slate-800 text-xs font-bold px-2.5 py-0.5 rounded-lg shadow-sm">
                            {timelineMeta[aiAnalysis!.timeline_assessment]}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}

                  {/* ── 4. Score Breakdown ── */}
                  <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                    <CardHeader className="pb-3 border-b border-slate-100">
                      <CardTitle className="text-xl font-bold text-slate-900">Score breakdown</CardTitle>
                      <CardDescription className="text-slate-600 font-medium">Hiển thị từng thành phần và trọng số dùng cho điểm tham khảo.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 pt-4">
                      {result.breakdown.map((item, index) => {
                        // Mảng màu sắc xoay vòng linh hoạt cho từng ô thành phần breakdown điểm
                        const breakdownColors = [
                          "border-indigo-200 border-l-4 border-l-indigo-600 bg-indigo-50/40 hover:bg-indigo-50",
                          "border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50/40 hover:bg-emerald-50",
                          "border-amber-200 border-l-4 border-l-amber-600 bg-amber-50/40 hover:bg-amber-50",
                          "border-sky-200 border-l-4 border-l-sky-600 bg-sky-50/40 hover:bg-sky-50",
                          "border-violet-200 border-l-4 border-l-violet-600 bg-violet-50/40 hover:bg-violet-50",
                          "border-rose-200 border-l-4 border-l-rose-600 bg-rose-50/40 hover:bg-rose-50"
                        ];
                        const colorClass = breakdownColors[index % breakdownColors.length];

                        return (
                          <div key={item.key} className={cn("rounded-2xl border p-5 pl-6 transition-all shadow-sm flex flex-col justify-between", colorClass, !item.hasData && "opacity-65")}>
                            <div>
                              <div className="flex items-center justify-between gap-3">
                                <p className="text-sm font-bold text-slate-800">{item.label}</p>
                                <div className="flex items-center gap-1.5">
                                  {!item.hasData ? (
                                    <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-600 font-bold px-2 rounded-md text-[10px]">
                                      N/A
                                    </Badge>
                                  ) : null}
                                  <Badge variant="outline" className="border-slate-300 bg-white text-slate-800 font-black px-2 rounded-md shadow-sm">
                                    {item.weight}%
                                  </Badge>
                                </div>
                              </div>
                              <p className="mt-3 text-3xl font-black text-slate-900">{item.hasData ? item.score : "—"}</p>
                              <Progress value={item.hasData ? item.score : 0} className="mt-3 h-2.5 bg-slate-200/80 rounded-full overflow-hidden [&>div]:bg-slate-850" />
                            </div>
                            <p className="mt-3 text-xs leading-5 text-slate-600 font-medium">{item.explanation}</p>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>

                  {/* ── 5. Evidence Summary + Leader Feedback ── */}
                  <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <Card className="rounded-3xl border border-slate-200 bg-white shadow-md">
                      <CardHeader className="pb-3 border-b border-slate-100">
                        <CardTitle className="text-xl font-bold text-slate-900">Evidence summary</CardTitle>
                        <CardDescription className="text-slate-600 font-medium">Dữ liệu hệ thống đang dùng để ước lượng contribution.</CardDescription>
                      </CardHeader>
                      <CardContent className="grid gap-3 sm:grid-cols-2 pt-4">
                        <div className="rounded-2xl border border-slate-200 border-l-4 border-l-slate-600 bg-slate-50/50 p-5 pl-6 shadow-sm hover:bg-slate-100/70 transition-colors">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Assigned tasks</p>
                          <p className="mt-1 text-2xl font-black text-slate-950">{result.evidenceSummary.assignedTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-emerald-200 border-l-4 border-l-emerald-600 bg-emerald-50/50 p-5 pl-6 shadow-sm hover:bg-emerald-100/70 transition-colors">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Approved tasks</p>
                          <p className="mt-1 text-2xl font-black text-emerald-950">{result.evidenceSummary.approvedTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-amber-200 border-l-4 border-l-amber-600 bg-amber-50/50 p-5 pl-6 shadow-sm hover:bg-amber-100/70 transition-colors">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">Pending tasks</p>
                          <p className="mt-1 text-2xl font-black text-amber-955">{result.evidenceSummary.pendingTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-rose-200 border-l-4 border-l-rose-600 bg-rose-50/50 p-5 pl-6 shadow-sm hover:bg-rose-100/70 transition-colors">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-rose-700">Rejected tasks</p>
                          <p className="mt-1 text-2xl font-black text-rose-950">{result.evidenceSummary.rejectedTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-red-200 border-l-4 border-l-red-600 bg-red-50/50 p-5 pl-6 shadow-sm hover:bg-red-100/70 transition-colors">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-red-700">Late tasks</p>
                          <p className="mt-1 text-2xl font-black text-red-950">{result.evidenceSummary.lateTasks}</p>
                        </div>
                        <div className="rounded-2xl border border-sky-200 border-l-4 border-l-sky-600 bg-sky-50/50 p-5 pl-6 shadow-sm hover:bg-sky-100/70 transition-colors">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-700">Average quality rating</p>
                          <p className="mt-1 text-2xl font-black text-sky-950">
                            {result.evidenceSummary.averageQualityRating ?? "—"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-violet-200 border-l-4 border-l-violet-600 bg-violet-50/50 p-5 pl-6 shadow-sm hover:bg-violet-100/70 transition-colors">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-700">Peer review average</p>
                          <p className="mt-1 text-2xl font-black text-violet-950">{result.evidenceSummary.peerReviewAverage ?? "—"}</p>
                        </div>
                        <div className="rounded-2xl border border-indigo-200 border-l-4 border-l-indigo-600 bg-indigo-50/50 p-5 pl-6 shadow-sm hover:bg-indigo-100/70 transition-colors">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-indigo-700">Work logs</p>
                          <p className="mt-1 text-2xl font-black text-indigo-950">{result.evidenceSummary.workLogCount}</p>
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="rounded-3xl border border-slate-200 bg-white shadow-md flex flex-col justify-between overflow-hidden">
                      <div>
                        <CardHeader className="pb-3 border-b border-slate-100">
                          <CardTitle className="text-xl font-bold text-slate-900">Leader feedback summary</CardTitle>
                          <CardDescription className="text-slate-600 font-medium">Không hiển thị comment peer review riêng tư của thành viên khác.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-4">
                          <div className="rounded-2xl border border-fuchsia-200 border-l-4 border-l-fuchsia-600 bg-fuchsia-50/30 p-5 pl-6 text-sm font-semibold text-slate-800 leading-7 shadow-sm">
                            {result.evidenceSummary.leaderFeedbackSummary}
                          </div>

                          {result.riskReasons.length > 0 ? (
                            <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
                              <div className="flex items-center gap-2 text-sm font-bold text-amber-955 uppercase tracking-wide">
                                <ShieldAlert className="h-4 w-4 text-amber-700" />
                                Lý do cần chú ý
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {result.riskReasons.map(reason => (
                                  <Badge key={reason} className="border border-amber-300 bg-white text-amber-900 hover:bg-white px-2.5 py-0.5 rounded-lg font-bold shadow-sm">
                                    {reason}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </CardContent>
                      </div>

                      <CardContent className="pt-0">
                        <div className="flex flex-col gap-3 sm:flex-row border-t border-slate-150 pt-4">
                          <Button type="button" className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm px-4" onClick={() => navigate("/student/my-tasks")}>
                            Xem task liên quan
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Button>
                          <Button type="button" variant="outline" className="rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold px-4" onClick={() => navigate("/student/feedback")}>
                            <MessageSquareQuote className="mr-2 h-4 w-4" />
                            Xem feedback
                          </Button>
                          {result.canAppeal ? (
                            <Button type="button" variant="outline" className="rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-semibold px-4" onClick={() => navigate("/student/appeals")}>
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
