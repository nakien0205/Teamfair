import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle,
  BellDot,
  CheckCircle2,
  Loader2,
  MessageSquareQuote,
  ShieldAlert,
} from "lucide-react";
import StudentShell from "@/components/student/StudentShell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
import { useTeam } from "@/context/TeamContext";
import {
  answerStudentFeedback,
  getStudentFeedbackItem,
  getStudentFeedbackList,
  readStudentFeedback,
} from "@/lib/studentApi";
import { feedbackTypeMeta, type StudentFeedbackRecord, type StudentFeedbackType } from "@/lib/studentFeedback";
import { cn } from "@/lib/utils";

type FeedbackFilter = "all" | "unread" | "task_review" | "contribution" | "warning" | "lecturer_note";

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const LoadingState = () => (
  <div className="space-y-6">
    <Skeleton className="h-28 rounded-3xl" />
    <Skeleton className="h-[460px] rounded-3xl" />
  </div>
);

const filterMatches = (filter: FeedbackFilter, item: StudentFeedbackRecord) => {
  if (filter === "all") return true;
  if (filter === "unread") return !item.read;
  if (filter === "lecturer_note") return item.senderRole === "lecturer";
  return item.feedbackType === filter;
};

const StudentFeedback = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { tasks, lecturerStudentReviews, currentUserName, addLog } = useTeam();

  const [items, setItems] = useState<StudentFeedbackRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState<FeedbackFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    void getStudentFeedbackList({
      studentId: user.id,
      studentName: currentUserName,
      tasks,
      lecturerReviews: lecturerStudentReviews,
    })
      .then(data => {
        if (!cancelled) {
          setItems(data);
          setSelectedId(data[0]?.id || "");
        }
      })
      .catch(fetchError => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Không thể tải feedback.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserName, lecturerStudentReviews, tasks, user?.id]);

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return items.filter(item => {
      if (!filterMatches(filter, item)) return false;
      if (!normalizedSearch) return true;
      return (
        item.content.toLowerCase().includes(normalizedSearch) ||
        item.senderName.toLowerCase().includes(normalizedSearch) ||
        (item.relatedTaskTitle || "").toLowerCase().includes(normalizedSearch)
      );
    });
  }, [filter, items, search]);

  const selectedItem = useMemo(
    () => visibleItems.find(item => item.id === selectedId) || items.find(item => item.id === selectedId) || null,
    [items, selectedId, visibleItems],
  );

  const openDetail = async (item: StudentFeedbackRecord) => {
    setSelectedId(item.id);
    setReplyText(item.replyText || "");
    setDetailOpen(true);

    if (!item.read) {
      try {
        await readStudentFeedback(item.id);
        addLog(`Sinh viên ${currentUserName} đã đọc feedback "${item.id}".`);
        setItems(current => current.map(currentItem => (currentItem.id === item.id ? { ...currentItem, read: true } : currentItem)));
      } catch {
        // keep UI usable even if audit/read sync fails
      }
    }

    try {
      const detail = await getStudentFeedbackItem(item.id);
      if (detail) {
        setItems(current => current.map(currentItem => (currentItem.id === detail.id ? detail : currentItem)));
      }
    } catch {
      // silent fallback to current item
    }
  };

  const handleReply = async () => {
    if (!selectedItem) return;
    setSaving(true);
    setError("");
    try {
      await answerStudentFeedback(selectedItem.id, replyText);
      addLog(`Sinh viên ${currentUserName} đã phản hồi feedback "${selectedItem.id}".`);
      setItems(current =>
        current.map(item =>
          item.id === selectedItem.id
            ? { ...item, replyText: replyText.trim(), repliedAt: new Date().toISOString(), read: true }
            : item,
        ),
      );
      toast({
        title: "Đã gửi phản hồi",
        description: "Phản hồi của bạn đã được ghi nhận.",
      });
      setDetailOpen(false);
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Không thể gửi phản hồi.");
    } finally {
      setSaving(false);
    }
  };

  const unreadCount = items.filter(item => !item.read).length;

  return (
    <>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_42%),linear-gradient(180deg,_hsl(var(--background))_0%,_hsl(var(--card))_100%)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:px-6">
          {loading ? <LoadingState /> : null}

          {!loading && (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="space-y-4 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border border-primary/15 bg-primary/10 text-primary hover:bg-primary/10">
                    Feedback
                  </Badge>
                  {unreadCount > 0 ? (
                    <Badge className="border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-50">
                      {unreadCount} chưa đọc
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Phản hồi từ nhóm trưởng và giảng viên</h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    Đây là khu vực chỉ hiển thị feedback dành riêng cho bạn. Cảnh báo ở đây không phải kết luận cuối cùng hay hình thức xử phạt tự động.
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-[220px_1fr]">
                  <select
                    value={filter}
                    onChange={event => setFilter(event.target.value as FeedbackFilter)}
                    className="h-11 rounded-2xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="all">Tất cả</option>
                    <option value="unread">Chưa đọc</option>
                    <option value="task_review">Task feedback</option>
                    <option value="contribution">Contribution feedback</option>
                    <option value="warning">Warning</option>
                    <option value="lecturer_note">Lecturer feedback</option>
                  </select>
                  <Input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Tìm theo người gửi, nội dung hoặc task liên quan"
                    className="h-11 rounded-2xl"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {!loading && error ? (
            <Alert className="rounded-3xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Không thể tải feedback</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {!loading && !error && visibleItems.length === 0 ? (
            <Card className="rounded-3xl border-0 shadow-card">
              <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                <BellDot className="h-10 w-10 text-muted-foreground" />
                <p>Bạn chưa có feedback nào.</p>
              </CardContent>
            </Card>
          ) : null}

          {!loading && !error && visibleItems.length > 0 ? (
            <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
              <Card className="rounded-3xl border-0 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">Danh sách feedback</CardTitle>
                  <CardDescription>Chọn một feedback để xem chi tiết và phản hồi nếu được phép.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {visibleItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => void openDetail(item)}
                      className={cn(
                        "w-full rounded-2xl border p-4 text-left transition-colors",
                        item.id === selectedId ? "border-primary/30 bg-primary/5" : "border-border bg-background/80",
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        {!item.read ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                        <Badge className={cn("border", feedbackTypeMeta[item.feedbackType].className)}>
                          {feedbackTypeMeta[item.feedbackType].label}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn(
                            "border-border/70 bg-background text-muted-foreground",
                            item.senderRole === "lecturer" ? "border-emerald-200 text-emerald-700" : "",
                          )}
                        >
                          {item.senderRole === "lecturer" ? "Giảng viên" : "Nhóm trưởng"}
                        </Badge>
                      </div>
                      <div className="mt-3">
                        <p className="text-sm font-medium">{item.senderName}</p>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.content}</p>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{dateFormatter.format(new Date(item.createdAt))}</span>
                        {item.relatedTaskTitle ? <span>• {item.relatedTaskTitle}</span> : null}
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-0 shadow-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-xl">Chi tiết feedback</CardTitle>
                  <CardDescription>Feedback chỉ dành cho cá nhân bạn và không thể chỉnh sửa hoặc xóa.</CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedItem ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={cn("border", feedbackTypeMeta[selectedItem.feedbackType].className)}>
                          {feedbackTypeMeta[selectedItem.feedbackType].label}
                        </Badge>
                        <Badge variant="outline" className="border-border/70 bg-background/80 text-muted-foreground">
                          {selectedItem.senderName}
                        </Badge>
                        {!selectedItem.read ? (
                          <Badge className="border border-primary/20 bg-primary/10 text-primary hover:bg-primary/10">Chưa đọc</Badge>
                        ) : null}
                      </div>
                      <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                        <p className="text-sm leading-7">{selectedItem.content}</p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Related item</p>
                          <p className="mt-2 text-sm font-medium">{selectedItem.relatedTaskTitle || "Feedback chung của dự án"}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Created date</p>
                          <p className="mt-2 text-sm font-medium">{dateFormatter.format(new Date(selectedItem.createdAt))}</p>
                        </div>
                      </div>

                      {selectedItem.suggestedAction ? (
                        <Alert className="rounded-2xl border-border bg-background/80">
                          <CheckCircle2 className="h-4 w-4" />
                          <AlertTitle>Suggested action</AlertTitle>
                          <AlertDescription>{selectedItem.suggestedAction}</AlertDescription>
                        </Alert>
                      ) : null}

                      {selectedItem.feedbackType === "warning" ? (
                        <Alert className="rounded-2xl border-amber-200 bg-amber-50 text-amber-900 [&>svg]:text-amber-700">
                          <ShieldAlert className="h-4 w-4" />
                          <AlertTitle>Lưu ý</AlertTitle>
                          <AlertDescription>
                            Feedback cảnh báo nhằm giúp bạn điều chỉnh sớm và vẫn có thể gửi giải trình nếu cần.
                          </AlertDescription>
                        </Alert>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        {selectedItem.allowsReply ? (
                          <Button className="rounded-2xl" onClick={() => void openDetail(selectedItem)}>
                            <MessageSquareQuote className="mr-2 h-4 w-4" />
                            Phản hồi / giải thích
                          </Button>
                        ) : null}
                        {selectedItem.feedbackType === "warning" || selectedItem.feedbackType === "revision_request" ? (
                          <Button variant="outline" className="rounded-2xl" onClick={() => navigate("/student/appeals")}>
                            Gửi giải trình
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-[320px] items-center justify-center text-sm text-muted-foreground">
                      Chọn một feedback ở danh sách bên trái để xem chi tiết.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </div>

      <Dialog open={detailOpen && Boolean(selectedItem?.allowsReply)} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Phản hồi feedback</DialogTitle>
            <DialogDescription>
              Chỉ phản hồi khi bạn cần bổ sung bối cảnh, minh chứng hoặc giải thích thêm cho người gửi.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="feedback-reply">Nội dung phản hồi</Label>
              <Textarea
                id="feedback-reply"
                value={replyText}
                onChange={event => setReplyText(event.target.value)}
                placeholder="Trình bày rõ bối cảnh, phần việc bạn đã làm và bằng chứng liên quan..."
                className="min-h-[140px] rounded-2xl"
              />
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-2xl" onClick={() => setDetailOpen(false)} disabled={saving}>
              Hủy
            </Button>
            <Button className="rounded-2xl" onClick={() => void handleReply()} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Gửi phản hồi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentFeedback;
