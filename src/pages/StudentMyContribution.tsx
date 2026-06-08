import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  ClipboardPenLine,
  MessageSquareQuote,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import StudentShell from "@/components/student/StudentShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/context/TeamContext";
import { getStudentContributionData, getStudentPeerReviewActive } from "@/lib/studentApi";
import { listStudentWorkLogs, type WorkLogRecord } from "@/lib/workLogs";
import { cn } from "@/lib/utils";

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

const LoadingState = () => (
  <div className="space-y-6">
    <Skeleton className="h-28 rounded-3xl" />
    <Skeleton className="h-[420px] rounded-3xl" />
    <Skeleton className="h-[360px] rounded-3xl" />
  </div>
);

const StudentMyContribution = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { groups, currentGroupIndex, tasks, lecturerStudentReviews, currentUserName } = useTeam();

  const [workLogs, setWorkLogs] = useState<WorkLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activePeriodLabel, setActivePeriodLabel] = useState("Giai đoạn hiện tại");
  const [result, setResult] = useState<Awaited<ReturnType<typeof getStudentContributionData>> | null>(null);

  const group = groups[currentGroupIndex] || groups[0];
  const myTasks = useMemo(
    () => tasks.filter(task => (user?.id ? task.assigneeId === user.id : task.assignedTo === currentUserName)),
    [currentUserName, tasks, user?.id],
  );
  const myLeaderReviews = useMemo(
    () => lecturerStudentReviews.filter(review => review.studentName.trim().toLowerCase() === currentUserName.trim().toLowerCase()),
    [currentUserName, lecturerStudentReviews],
  );

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
              <Card className="rounded-3xl border-0 shadow-card">
                <CardContent className="space-y-4 p-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border border-primary/15 bg-primary/10 text-primary hover:bg-primary/10">
                      Điểm đóng góp tham khảo
                    </Badge>
                    <Badge variant="outline" className="border-border/70 bg-background/80 text-muted-foreground">
                      {group.name}
                    </Badge>
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{profile?.full_name || currentUserName}</h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Điểm đóng góp chỉ mang tính tham khảo. Quyết định cuối cùng thuộc về giảng viên.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Nhóm / dự án</p>
                      <p className="mt-2 text-sm font-medium">{group.name}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Review period</p>
                      <p className="mt-2 text-sm font-medium">{activePeriodLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                      <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Work log</p>
                      <p className="mt-2 text-sm font-medium">{workLogs.length} bản ghi</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {!result?.hasEnoughData ? (
                <Card className="rounded-3xl border-0 shadow-card">
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    Chưa có đủ dữ liệu để tính điểm đóng góp.
                  </CardContent>
                </Card>
              ) : null}

              {result?.hasEnoughData ? (
                <>
                  <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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

                    <Card className="rounded-3xl border-0 shadow-card">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-xl">Giải thích từ hệ thống</CardTitle>
                        <CardDescription>Dùng ngôn ngữ đơn giản để bạn biết điểm mạnh và phần cần bổ sung.</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4 text-sm leading-7">
                          {result.explanation}
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
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="rounded-3xl border-0 shadow-card">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-xl">Score breakdown</CardTitle>
                      <CardDescription>Hiển thị từng thành phần và trọng số dùng cho điểm tham khảo.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {result.breakdown.map(item => (
                        <div key={item.key} className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-medium">{item.label}</p>
                            <Badge variant="outline" className="border-border/70 bg-background text-muted-foreground">
                              {item.weight}%
                            </Badge>
                          </div>
                          <p className="mt-3 text-2xl font-semibold">{item.score}</p>
                          <Progress value={item.score} className="mt-3 h-2.5 bg-muted" />
                          <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.explanation}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

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
                            {result.evidenceSummary.averageQualityRating ?? "-"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Peer review average</p>
                          <p className="mt-2 text-2xl font-semibold">{result.evidenceSummary.peerReviewAverage ?? "-"}</p>
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
