import { useCallback, useId, useMemo, useState } from "react";
import { Bot, ChevronDown, ChevronRight, SendHorizontal, Sparkles } from "lucide-react";

import { useTeam } from "@/context/TeamContext";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { buildWorkspaceSnapshotFromTeam } from "@/lib/workspaceSnapshot";
import { useToast } from "@/hooks/use-toast";
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
};

function chatEndpoint(): string {
  const base = import.meta.env.VITE_STUDENT_AGENT_URL?.trim();
  if (base) return `${base.replace(/\/$/, "")}/chat`;
  return "/api/student-agent/chat";
}

let messageId = 0;
const nextId = () => `m-${++messageId}`;

const StudentAgentSidebar = () => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const team = useTeam();
  const formId = useId();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [heavyTask, setHeavyTask] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lastTrace, setLastTrace] = useState<ToolTraceEntry[]>([]);
  const [lastReasoning, setLastReasoning] = useState<string | null>(null);
  const [traceOpen, setTraceOpen] = useState(true);
  const [reasoningOpen, setReasoningOpen] = useState(false);

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

  const sendPrompt = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      pushMessage("user", trimmed);
      setInput("");
      setLoading(true);
      setLastTrace([]);
      setLastReasoning(null);

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
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        toast({
          title: tr(language, "Không kết nối được AI", "AI unavailable"),
          description: msg,
          variant: "destructive",
        });
        pushMessage(
          "assistant",
          tr(
            language,
            "Không gọi được máy chủ agent. Ở máy dev: chạy uvicorn (xem docs/guides/student_workspace_agent.md) và đảm bảo Vite proxy tới cổng đó. Trên Vercel: đặt VITE_STUDENT_AGENT_URL tới URL dịch vụ Python.",
            "Could not reach the agent server. For local dev: run uvicorn (see docs/guides/student_workspace_agent.md) and match the Vite proxy port. On Vercel: set VITE_STUDENT_AGENT_URL to your hosted Python agent URL.",
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [heavyTask, language, loading, pushMessage, snapshot, toast],
  );

  const handleSend = () => {
    void sendPrompt(input);
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

  return (
    <>
      <Button
        type="button"
        size="lg"
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg p-0"
        onClick={() => setOpen(true)}
        aria-label={tr(language, "Mở trợ lý AI workspace", "Open workspace AI assistant")}
      >
        <Sparkles className="h-6 w-6" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-full sm:max-w-lg h-full max-h-screen flex flex-col p-0 gap-0 overflow-hidden">
          <SheetHeader className="p-6 pb-4 border-b border-border text-left space-y-1 shrink-0">
            <SheetTitle className="flex items-center gap-2 font-display">
              <Bot className="h-5 w-5 text-primary" />
              {tr(language, "Trợ lý workspace", "Workspace assistant")}
            </SheetTitle>
            <SheetDescription className="text-xs leading-relaxed">
              {tr(
                language,
                "Gọi mô hình qua máy chủ Teamfair (snapshot nhóm hiện tại). Lịch trong UI chưa đồng bộ vào snapshot.",
                "Calls the Teamfair agent server with your current group snapshot. Calendar tab data is not included in the snapshot yet.",
              )}
            </SheetDescription>
          </SheetHeader>

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

          <ScrollArea className="flex-1 min-h-0 px-6">
            <div className="space-y-3 py-4 pr-3">
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
            <div className="flex justify-end">
              <Button onClick={handleSend} disabled={loading || !input.trim()}>
                {loading ? tr(language, "Đang gửi…", "Sending…") : tr(language, "Gửi", "Send")}
                <SendHorizontal className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default StudentAgentSidebar;
