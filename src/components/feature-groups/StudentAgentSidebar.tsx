import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Bot, ChevronDown, ChevronRight, SendHorizontal, Sparkles, Trash2, Check, X } from "lucide-react";

import { useTeam } from "@/context/TeamContext";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { buildWorkspaceSnapshotFromTeam, type WorkspaceSnapshotJson } from "@/lib/workspaceSnapshot";
import { useToast } from "@/hooks/use-toast";
import { loadChatHistory, insertChatMessage, clearChatHistory, type ChatMessageRow } from "@/lib/chatHistory";
import { isDemoSession } from "@/lib/demoSession";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

type ToolTraceEntry = {
  round: number;
  tool_name: string;
  arguments: Record<string, unknown>;
  result_preview: string;
};

type ChatResponse = {
  answer: string;
  tool_trace: ToolTraceEntry[];
  reasoning: string | null;
  used_heavy_synthesis: boolean;
  workspace?: WorkspaceSnapshotJson | null;
};

export type LockedSection = "work" | "calendar" | "materials" | null;

function chatEndpoint(): string {
  const base = import.meta.env.VITE_STUDENT_AGENT_URL?.trim();
  if (base) return `${base.replace(/\/$/, "")}/chat`;
  return "/api/student-agent/chat";
}

let messageId = 0;
const nextId = () => `m-${++messageId}`;

/* ---- Diff helpers ---- */

type TaskDiff = { kind: "added" | "removed" | "modified"; name: string; id: string };

function diffTasks(
  before: { id: string; name: string }[],
  after: { id: string; name: string }[],
): TaskDiff[] {
  const diffs: TaskDiff[] = [];
  const beforeIds = new Set(before.map(t => t.id));
  const afterIds = new Set(after.map(t => t.id));
  for (const t of after) {
    if (!beforeIds.has(t.id)) diffs.push({ kind: "added", name: t.name, id: t.id });
  }
  for (const t of before) {
    if (!afterIds.has(t.id)) diffs.push({ kind: "removed", name: t.name, id: t.id });
  }
  const afterMap = new Map(after.map(t => [t.id, t]));
  for (const t of before) {
    const a = afterMap.get(t.id);
    if (a && JSON.stringify(t) !== JSON.stringify(a)) {
      diffs.push({ kind: "modified", name: a.name, id: t.id });
    }
  }
  return diffs;
}

function deriveLockedSections(trace: ToolTraceEntry[]): Set<string> {
  const sections = new Set<string>();
  for (const t of trace) {
    const n = t.tool_name;
    if (["create_task", "update_task_status", "update_task_fields", "approve_task", "delete_task", "append_task_evidence_meta"].includes(n)) sections.add("work");
    if (["create_calendar_event", "update_calendar_event", "delete_calendar_event"].includes(n)) sections.add("calendar");
    if (["add_material", "delete_material"].includes(n)) sections.add("materials");
  }
  return sections;
}

/* ---- Auto-apply setting ---- */
const AUTO_APPLY_KEY = "agentAutoApply";
function getAutoApply(): boolean {
  try { return localStorage.getItem(AUTO_APPLY_KEY) === "true"; } catch { return false; }
}
function setAutoApplyStorage(v: boolean) {
  try { localStorage.setItem(AUTO_APPLY_KEY, String(v)); } catch { /* noop */ }
}

interface StudentAgentSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLockedSectionChange?: (section: LockedSection) => void;
}

const StudentAgentSidebar = ({ open, onOpenChange, onLockedSectionChange }: StudentAgentSidebarProps) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const team = useTeam();
  const { user } = useAuth();
  const formId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [heavyTask, setHeavyTask] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastTrace, setLastTrace] = useState<ToolTraceEntry[]>([]);
  const [lastReasoning, setLastReasoning] = useState<string | null>(null);
  const [traceOpen, setTraceOpen] = useState(true);
  const [reasoningOpen, setReasoningOpen] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Diff / snapshot state
  const [pendingSnapshot, setPendingSnapshot] = useState<WorkspaceSnapshotJson | null>(null);
  const [diffOpen, setDiffOpen] = useState(false);
  const [autoApply, setAutoApply] = useState(getAutoApply);

  const currentGroupId = team.groups[team.currentGroupIndex]?.id ?? "g1";

  // --- Load chat history from Supabase on open ---
  useEffect(() => {
    if (!open) {
      setHistoryLoaded(false);
      return;
    }
    if (isDemoSession() || !user?.id) {
      setHistoryLoaded(true);
      return;
    }
    let cancelled = false;
    loadChatHistory(currentGroupId)
      .then((rows: ChatMessageRow[]) => {
        if (cancelled) return;
        const restored: ChatMessage[] = rows.map(r => ({
          id: r.id,
          role: r.role,
          content: r.content,
        }));
        setMessages(restored);
        setHistoryLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    return () => { cancelled = true; };
  }, [open, currentGroupId, user?.id]);

  // --- Auto-scroll when messages change ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // --- Report locked section changes ---
  useEffect(() => {
    if (!loading) {
      onLockedSectionChange?.(null);
    }
  }, [loading, onLockedSectionChange]);

  const snapshot = useMemo(
    () =>
      buildWorkspaceSnapshotFromTeam({
        groups: team.groups,
        currentGroupIndex: team.currentGroupIndex,
        reports: team.reports,
        materials: team.materials,
        lecturerStudentReviews: team.lecturerStudentReviews,
        studentBadges: team.studentBadges,
      }),
    [
      team.groups,
      team.currentGroupIndex,
      team.reports,
      team.materials,
      team.lecturerStudentReviews,
      team.studentBadges,
    ],
  );

  const pushMessage = useCallback((role: ChatRole, content: string) => {
    setMessages(prev => [...prev, { id: nextId(), role, content }]);
  }, []);

  const handleApplySnapshot = useCallback(() => {
    if (!pendingSnapshot) return;
    team.applyAgentSnapshot(pendingSnapshot);
    setPendingSnapshot(null);
    setDiffOpen(false);
    toast({
      title: tr(language, "Đã áp dụng", "Applied"),
      description: tr(language, "Thay đổi từ AI đã được áp dụng.", "AI changes have been applied."),
    });
  }, [language, pendingSnapshot, team, toast]);

  const handleDiscardSnapshot = useCallback(() => {
    setPendingSnapshot(null);
    setDiffOpen(false);
    toast({
      title: tr(language, "Đã bỏ qua", "Discarded"),
      description: tr(language, "Thay đổi từ AI đã bị bỏ qua.", "AI changes have been discarded."),
    });
  }, [language, toast]);

  const sendPrompt = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      pushMessage("user", trimmed);
      setInput("");
      setLoading(true);
      setLastTrace([]);
      setLastReasoning(null);

      // Persist user message
      void insertChatMessage(currentGroupId, { role: "user", content: trimmed });

      try {
        const res = await fetch(chatEndpoint(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: trimmed,
            workspace: snapshot,
            use_heavy: heavyTask,
            max_tool_rounds: 12,
          }),
        });

        const raw = await res.text();
        let data: ChatResponse | null = null;
        try {
          data = JSON.parse(raw) as ChatResponse;
        } catch {
          data = null;
        }

        if (!res.ok) {
          let detail = raw.slice(0, 400);
          if (raw.trim().startsWith("{")) {
            try {
              const errBody = JSON.parse(raw) as { detail?: unknown };
              if (errBody.detail !== undefined) detail = String(errBody.detail);
            } catch {
              /* keep slice */
            }
          }
          throw new Error(detail || `HTTP ${res.status}`);
        }

        if (!data?.answer) {
          throw new Error(tr(language, "Phản hồi không hợp lệ từ máy chủ AI.", "Invalid response from AI server."));
        }

        pushMessage("assistant", data.answer);
        setLastTrace(data.tool_trace ?? []);
        setLastReasoning(data.reasoning ?? null);
        if (data.reasoning) setReasoningOpen(true);

        // Determine locked sections from tool trace
        const sections = deriveLockedSections(data.tool_trace ?? []);
        if (sections.size > 0) {
          const first = sections.values().next().value as string;
          onLockedSectionChange?.(first as LockedSection);
        }

        // Handle workspace snapshot from agent
        if (data.workspace) {
          if (autoApply) {
            team.applyAgentSnapshot(data.workspace);
            toast({
              title: tr(language, "Tự động áp dụng", "Auto-applied"),
              description: tr(language, "Thay đổi từ AI đã được áp dụng tự động.", "AI changes have been auto-applied."),
            });
          } else {
            setPendingSnapshot(data.workspace);
            setDiffOpen(true);
          }
        }

        // Persist assistant message
        void insertChatMessage(currentGroupId, {
          role: "assistant",
          content: data.answer,
          tool_trace: data.tool_trace,
          reasoning: data.reasoning,
          used_heavy: data.used_heavy_synthesis,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({
          title: tr(language, "Không kết nối được AI", "AI unavailable"),
          description: msg,
          variant: "destructive",
        });
        const errContent = tr(
          language,
          "Không gọi được máy chủ agent. Ở máy dev: chạy uvicorn (xem docs/guides/student_workspace_agent.md) và đảm bảo Vite proxy tới cổng đó. Trên Vercel: đặt VITE_STUDENT_AGENT_URL tới URL dịch vụ Python.",
          "Could not reach the agent server. For local dev: run uvicorn (see docs/guides/student_workspace_agent.md) and match the Vite proxy port. On Vercel: set VITE_STUDENT_AGENT_URL to your hosted Python agent URL.",
        );
        pushMessage("assistant", errContent);
      } finally {
        setLoading(false);
      }
    },
    [autoApply, currentGroupId, heavyTask, language, loading, onLockedSectionChange, pushMessage, snapshot, team, toast],
  );

  const handleSend = () => {
    void sendPrompt(input);
  };

  const handleClearHistory = async () => {
    setMessages([]);
    setLastTrace([]);
    setLastReasoning(null);
    await clearChatHistory(currentGroupId);
    toast({
      title: tr(language, "Đã xóa lịch sử", "History cleared"),
      description: tr(language, "Lịch sử chat đã được xóa.", "Chat history has been cleared."),
    });
  };

  const chip = (labelVi: string, labelEn: string, promptVi: string, promptEn: string) => (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="text-xs shrink-0"
      disabled={loading}
      onClick={() => setInput(language === "vi" ? promptVi : promptEn)}
    >
      {language === "vi" ? labelVi : labelEn}
    </Button>
  );

  const hasMessages = messages.length > 0;

  // Compute diffs for the pending snapshot
  const taskDiffs = useMemo(() => {
    if (!pendingSnapshot) return [];
    const gIdx = team.currentGroupIndex;
    const beforeTasks = snapshot.groups[gIdx]?.tasks ?? [];
    const afterTasks = pendingSnapshot.groups[gIdx]?.tasks ?? [];
    return diffTasks(beforeTasks, afterTasks);
  }, [pendingSnapshot, snapshot, team.currentGroupIndex]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg h-full max-h-screen flex flex-col p-0 gap-0 overflow-hidden">
        <SheetHeader className="p-6 pb-4 border-b border-border text-left space-y-1 shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 font-display">
              <Bot className="h-5 w-5 text-primary" />
              {tr(language, "Trợ lý workspace", "Workspace assistant")}
            </SheetTitle>
            {hasMessages && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={() => void handleClearHistory()}
                disabled={loading}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {tr(language, "Xóa lịch sử", "Clear history")}
              </Button>
            )}
          </div>
          <SheetDescription className="text-xs leading-relaxed">
            {tr(
              language,
              "Gọi mô hình qua máy chủ Teamfair (snapshot nhóm hiện tại). Lịch trong UI chưa đồng bộ vào snapshot.",
              "Calls the Teamfair agent server with your current group snapshot. Calendar tab data is not included in the snapshot yet.",
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Quick prompts — only when no messages */}
        {!hasMessages && (
          <div className="px-6 py-3 border-b border-border shrink-0 space-y-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                {tr(language, "Gợi ý nhanh", "Quick prompts")}
              </p>
              <div className="flex flex-wrap gap-2">
                {chip(
                  "Task & deadline",
                  "Tasks & deadlines",
                  "Liệt kê task và deadline của nhóm hiện tại.",
                  "List tasks and deadlines for the current group.",
                )}
                {chip(
                  "Đóng góp",
                  "Contribution",
                  "Tóm tắt đóng góp thành viên dựa trên task đã duyệt.",
                  "Summarize member contributions from approved tasks.",
                )}
                {chip("Tài liệu", "Materials", "Có những tài liệu nào trong workspace?", "What materials are in the workspace?")}
                {chip("Badge", "Badges", "Badge đã được trao cho ai?", "Which verified badges exist?")}
                {chip("Lịch", "Calendar", "Có sự kiện lịch nào trong snapshot?", "What calendar events are in the snapshot?")}
              </div>
            </div>

            {/* Full Heavy Task card — only when no messages */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <Label htmlFor={`${formId}-heavy`} className="text-sm font-medium cursor-pointer">
                    {tr(language, "Tác vụ nặng (Heavy Task)", "Heavy Task")}
                  </Label>
                  <p className="text-xs text-muted-foreground leading-snug">
                    {tr(
                      language,
                      "Bật khi bạn cần câu trả lời tổng hợp sâu hơn sau khi agent gọi công cụ: mô hình lớn hơn (deepseek-v4-pro) đọc toàn bộ hội thoại + kết quả tool và viết lại câu trả lời cuối. Tốn token hơn; dùng cho phân tích phức tạp, so sánh nhiều nguồn, hoặc văn bản dài.",
                      "Turn on when you want a deeper final write-up after tools run: the larger model (deepseek-v4-pro) reads the full thread plus tool outputs and rewrites the final answer. Uses more tokens—best for complex analysis, multi-step comparisons, or longer explanations.",
                    )}
                  </p>
                </div>
                <Switch id={`${formId}-heavy`} checked={heavyTask} onCheckedChange={setHeavyTask} disabled={loading} />
              </div>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0 px-6">
          <div ref={scrollRef} className="space-y-3 py-4 pr-3">
            {messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {tr(language, "Bắt đầu bằng một câu hỏi hoặc chọn gợi ý phía trên.", "Ask something or tap a quick prompt above.")}
              </p>
            ) : (
              messages.map(m => (
                <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[92%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed",
                      m.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/80 text-foreground border border-border",
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Diff panel for pending snapshot */}
        {pendingSnapshot && (
          <div className="shrink-0 border-t border-border px-6 py-3 space-y-2 max-h-[35vh] overflow-y-auto">
            <Collapsible open={diffOpen} onOpenChange={setDiffOpen}>
              <CollapsibleTrigger className="flex w-full items-center gap-2 text-left text-sm font-medium py-1 hover:text-primary">
                {diffOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                {tr(language, "Thay đổi của AI", "AI changes")}
                {taskDiffs.length > 0 && <span className="text-xs font-normal text-muted-foreground">({taskDiffs.length})</span>}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-2">
                {taskDiffs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{tr(language, "Không có thay đổi task.", "No task changes.")}</p>
                ) : (
                  taskDiffs.map(d => (
                    <div
                      key={d.id}
                      className={cn(
                        "rounded px-3 py-1.5 text-xs font-medium",
                        d.kind === "added" && "bg-green-500/15 text-green-700 dark:text-green-300",
                        d.kind === "removed" && "bg-red-500/15 text-red-700 dark:text-red-300",
                        d.kind === "modified" && "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
                      )}
                    >
                      {d.kind === "added" && "+ "}
                      {d.kind === "removed" && "− "}
                      {d.kind === "modified" && "~ "}
                      {d.name}
                    </div>
                  ))
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={handleApplySnapshot}>
                    <Check className="h-3.5 w-3.5 mr-1" />
                    {tr(language, "Áp dụng", "Apply")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleDiscardSnapshot}>
                    <X className="h-3.5 w-3.5 mr-1" />
                    {tr(language, "Bỏ qua", "Discard")}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {(lastTrace.length > 0 || lastReasoning) && (
          <div className="shrink-0 border-t border-border px-6 py-3 space-y-2 max-h-[40vh] overflow-y-auto">
            {lastTrace.length > 0 && (
              <Collapsible open={traceOpen} onOpenChange={setTraceOpen}>
                <CollapsibleTrigger className="flex w-full items-center gap-2 text-left text-sm font-medium py-1 hover:text-primary">
                  {traceOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {tr(language, "Luồng công cụ (tool trace)", "Tool trace")}
                  <span className="text-xs font-normal text-muted-foreground">({lastTrace.length})</span>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2 pt-2">
                  {lastTrace.map((t, i) => (
                    <div key={`${t.tool_name}-${t.round}-${i}`} className="rounded-md border border-border bg-background p-2 text-xs font-mono">
                      <div className="text-muted-foreground mb-1">
                        #{i + 1} {t.tool_name} (round {t.round})
                      </div>
                      <pre className="whitespace-pre-wrap break-words max-h-32 overflow-y-auto text-[11px]">
                        {t.result_preview}
                      </pre>
                    </div>
                  ))}
                </CollapsibleContent>
              </Collapsible>
            )}

            {lastReasoning ? (
              <Collapsible open={reasoningOpen} onOpenChange={setReasoningOpen}>
                <CollapsibleTrigger className="flex w-full items-center gap-2 text-left text-sm font-medium py-1 hover:text-primary">
                  {reasoningOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  {tr(language, "Suy luận mô hình (nếu có)", "Model reasoning (if any)")}
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-2">
                  <pre className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 p-2 text-xs max-h-40 overflow-y-auto">
                    {lastReasoning}
                  </pre>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>
        )}

        <div className="p-6 pt-3 border-t border-border shrink-0 space-y-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={tr(language, "Hỏi về task, đóng góp, tài liệu…", "Ask about tasks, contribution, materials…")}
            className="min-h-[72px] resize-none"
            disabled={loading}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Compact heavy toggle — only when messages exist */}
              {hasMessages && (
                <div className="flex items-center gap-2">
                  <Label htmlFor={`${formId}-heavy-compact`} className="text-xs font-medium cursor-pointer text-muted-foreground">
                    {tr(language, "Tác vụ nặng", "Heavy Task")}
                  </Label>
                  <Switch
                    id={`${formId}-heavy-compact`}
                    checked={heavyTask}
                    onCheckedChange={setHeavyTask}
                    disabled={loading}
                    className="scale-90"
                  />
                </div>
              )}
              {/* Auto-apply toggle */}
              <div className="flex items-center gap-1.5">
                <Label htmlFor={`${formId}-auto-apply`} className="text-xs font-medium cursor-pointer text-muted-foreground">
                  {tr(language, "Tự động", "Auto")}
                </Label>
                <Switch
                  id={`${formId}-auto-apply`}
                  checked={autoApply}
                  onCheckedChange={v => { setAutoApply(v); setAutoApplyStorage(v); }}
                  disabled={loading}
                  className="scale-75"
                />
              </div>
            </div>
            <Button onClick={handleSend} disabled={loading || !input.trim()}>
              {loading ? tr(language, "Đang gửi…", "Sending…") : tr(language, "Gửi", "Send")}
              <SendHorizontal className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default StudentAgentSidebar;
