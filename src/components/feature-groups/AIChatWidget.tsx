import { useMemo, useRef, useState } from "react";
import { useTeam } from "@/context/TeamContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/context/LanguageContext";
import { t } from "@/lib/i18n";
import { trackEvent } from "@/lib/analytics";
import { MessageSquare, SendHorizontal } from "lucide-react";

type ChatRole = "user" | "ai";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
};

const getDeadlineTs = (deadline: string): number => {
  const ts = new Date(deadline).getTime();
  return Number.isFinite(ts) ? ts : Number.POSITIVE_INFINITY;
};

const normalize = (v: string): string => v.trim().toLowerCase();

const AIChatWidget = () => {
  const { groups, currentGroupIndex, tasks, members, materials } = useTeam();
  const { language } = useLanguage();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: "init",
      role: "ai",
      content:
        language === "vi"
          ? "Mình có thể giúp bạn: tài liệu, task/deadline, và hướng dẫn đánh giá ẩn danh."
          : "I can help you: materials, tasks/deadlines, and how anonymous evaluation works.",
    },
  ]);
  const nextId = useRef(1);

  const availableMemberNames = useMemo(() => members.map(m => m.name), [members]);

  const buildMaterialsResponse = () => {
    if (language === "vi") {
      return [
        `Bạn đang có ${materials.length} tài liệu trong mục “Tài liệu”.`,
        "Cách dùng:",
        "1) Vào sidebar mục “Tài liệu”.",
        "2) Nhấn nút “Tải lên tài liệu” để chọn file.",
        "3) Sau khi tải lên, bạn sẽ thấy file trong bảng để tải về (và giảng viên có thể xóa).",
      ].join("\n");
    }

    return [
      `You have ${materials.length} materials in the “Materials” section.`,
      "How to use:",
      "1) Open the sidebar “Materials”.",
      "2) Click “Upload materials” to choose a file.",
      "3) Uploaded files appear in the table (lecturers can delete).",
    ].join("\n");
  };

  const buildTasksResponse = () => {
    const totalTasks = tasks.length;
    const doneCount = tasks.filter(tk => tk.status === "Done").length;
    const inProgressCount = tasks.filter(tk => tk.status === "In Progress").length;
    const todoCount = tasks.filter(tk => tk.status === "Todo").length;
    const pendingApprovalCount = tasks.filter(tk => tk.status === "Done" && !tk.approved).length;
    const earliest = [...tasks].sort((a, b) => getDeadlineTs(a.deadline) - getDeadlineTs(b.deadline)).slice(0, 3);

    let taskLines = "";
    if (earliest.length > 0) {
      taskLines = earliest.map(tk => `- ${tk.name} (${tk.status}) · ${tk.deadline}`).join("\n");
    } else {
      taskLines = language === "vi" ? "- Chưa có task nào." : "- No tasks yet.";
    }

    let pendingLine = "";
    if (pendingApprovalCount > 0) {
      pendingLine =
        language === "vi"
          ? `Có ${pendingApprovalCount} task Done đang chờ duyệt.`
          : `${pendingApprovalCount} Done tasks are waiting for approval.`;
    } else {
      pendingLine = language === "vi" ? "Không có task Done đang chờ duyệt." : "No Done tasks are waiting for approval.";
    }

    if (language === "vi") {
      return [
        `Tổng task: ${totalTasks} (Todo: ${todoCount}, In Progress: ${inProgressCount}, Done: ${doneCount}).`,
        pendingLine,
        "3 task gần deadline nhất:",
        taskLines,
      ].join("\n");
    }

    return [
      `Total tasks: ${totalTasks} (Todo: ${todoCount}, In Progress: ${inProgressCount}, Done: ${doneCount}).`,
      pendingLine,
      "Top 3 nearest deadlines:",
      taskLines,
    ].join("\n");
  };

  const buildEvaluationResponse = () => {
    let memberHint = "";
    if (availableMemberNames.length > 0) {
      const base = availableMemberNames.slice(0, 4).join(", ");
      const suffix = availableMemberNames.length > 4 ? "..." : "";
      memberHint = `${base}${suffix}`;
    }

    let suggestionLine = "";
    if (memberHint) {
      suggestionLine = language === "vi" ? `Gợi ý thành viên: ${memberHint}` : `Member suggestions: ${memberHint}`;
    }

    const baseVi = [
      "Bạn có thể gửi đánh giá ẩn danh trong mục “Đánh giá”.",
      "Quy trình:",
      "1) Chọn thành viên được đánh giá.",
      "2) Chọn số sao.",
      "3) Nhập nhận xét (tuỳ chọn).",
      "4) Bấm “Gửi đánh giá”.",
    ];

    const baseEn = [
      "You can submit anonymous evaluation in the “Evaluation” section.",
      "Steps:",
      "1) Pick the member to evaluate.",
      "2) Choose star rating.",
      "3) Add an optional comment.",
      "4) Click “Send evaluation”.",
    ];

    const list = language === "vi" ? baseVi : baseEn;
    if (suggestionLine) list.push(suggestionLine);
    return list.join("\n");
  };

  const buildBadgeResponse = () => {
    if (language === "vi") {
      return [
        "Verified badge sẽ xuất hiện ở trang “Xác nhận đóng góp” khi giảng viên trao badge.",
        "Bạn có thể nhận sao và comment từ giảng viên kèm theo một link demo để đưa vào hồ sơ xin việc.",
      ].join("\n");
    }

    return [
      "Verified badges appear in the “Contribution verification” page when a lecturer awards them.",
      "You’ll see stars and the lecturer’s comment, plus a demo link you can add to your profile.",
    ].join("\n");
  };

  const buildGeneralResponse = () => {
    const memberCount = members.length;
    const totalTasks = tasks.length;

    let materialsLine = "";
    if (materials.length > 0) {
      materialsLine = language === "vi" ? `Hiện có ${materials.length} tài liệu.` : `You currently have ${materials.length} materials.`;
    } else {
      materialsLine = language === "vi" ? "Chưa có tài liệu nào." : "No materials yet.";
    }

    if (language === "vi") {
      return [
        `Hi! Bạn đang làm việc với nhóm có ${memberCount} thành viên và ${totalTasks} task.`,
        materialsLine,
        "Bạn muốn hỏi về gì?",
        "- Tài liệu",
        "- Task & deadline",
        "- Đánh giá ẩn danh",
        "- Verified badge",
      ].join("\n");
    }

    return [
      `Hi! Your team has ${memberCount} members and ${totalTasks} tasks.`,
      materialsLine,
      "What would you like help with?",
      "- Materials",
      "- Tasks & deadlines",
      "- Anonymous evaluation",
      "- Verified badges",
    ].join("\n");
  };

  const generateResponse = (question: string): string => {
    const q = normalize(question);
    const hasMaterials = /material|tai lieu|tài liệu|upload|file/i.test(q);
    const hasTasks = /task|deadline|hạn|tiến độ|tiendo/i.test(q);
    const hasEval = /peer|anonymous|ẩn danh|đánh giá|rating|sao/i.test(q);
    const hasBadge = /badge|verified|đóng góp|xác nhận/i.test(q);

    if (hasMaterials) return buildMaterialsResponse();
    if (hasTasks) return buildTasksResponse();
    if (hasEval) return buildEvaluationResponse();
    if (hasBadge) return buildBadgeResponse();
    return buildGeneralResponse();
  };

  const pushMessage = (role: ChatRole, content: string) => {
    setMessages(prev => [
      ...prev,
      {
        id: String(nextId.current),
        role,
        content,
      },
    ]);
    nextId.current += 1;
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    trackEvent("ai_chat_sent", {
      group_id: groups[currentGroupIndex]?.id,
      source: "dashboard_widget",
    });
    pushMessage("user", text);
    setInput("");
    setLoading(true);

    globalThis.setTimeout(() => {
      const response = generateResponse(text);
      pushMessage("ai", response);
      setLoading(false);
    }, 600);
  };

  return (
    <section className="bg-card rounded-xl p-6 shadow-card border border-border">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-display text-lg font-semibold flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" /> {t(language, "aiChatTitle")}
        </h2>
        <span className="text-xs text-muted-foreground">{loading ? "Thinking..." : "Online"}</span>
      </div>

      <div className="bg-muted/30 rounded-lg border border-border p-3">
        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-line rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-foreground border border-border"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={language === "vi" ? "Nhập câu hỏi..." : "Type your question..."}
            className="min-h-[68px]"
          />
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted-foreground">
              {language === "vi" ? "Gợi ý: tài liệu, task, đánh giá ẩn danh." : "Suggestions: materials, tasks, anonymous evaluation."}
            </div>
            <Button onClick={handleSend} disabled={loading || input.trim().length === 0}>
              <SendHorizontal className="h-4 w-4 mr-1" /> {language === "vi" ? "Gửi" : "Send"}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AIChatWidget;

