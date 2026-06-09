import React, { useEffect, useMemo, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useTeam } from "@/context/TeamContext";
import { tr } from "@/lib/i18n";
import { createTaskEvidenceSignedUrl } from "@/lib/taskSubmissions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  FileText,
  Bot,
  AlertTriangle,
  FolderOpen,
  FileCode2,
  Paperclip,
  LayoutDashboard,
  ExternalLink,
  Download,
  Image as ImageIcon,
  Video
} from "lucide-react";

interface LecturerGradingEvidenceViewProps {
  groupId: string;
}

type EvidenceItem = {
  id: string;
  type: "submission" | "doc" | "code" | "evidence" | "task" | "contribution" | "peerreview" | "ai";
  title: string;
  subtitle?: string;
  date?: string | Date;
  url?: string;
  storagePath?: string;
  data?: unknown;
};

const ItemIcon = ({ type, className }: { type: string; className?: string }) => {
  switch (type) {
    case "doc": return <FileText className={className} />;
    case "code": return <FileCode2 className={className} />;
    case "evidence": return <Paperclip className={className} />;
    case "task": return <LayoutDashboard className={className} />;
    case "contribution": return <Users className={className} />;
    case "peerreview": return <Users className={className} />;
    case "ai": return <Bot className={className} />;
    default: return <FolderOpen className={className} />;
  }
};

export const LecturerGradingEvidenceView: React.FC<LecturerGradingEvidenceViewProps> = ({ groupId }) => {
  const { groups, reports } = useTeam();
  const { language } = useLanguage();

  const [filter, setFilter] = useState("all");
  const [selectedItem, setSelectedItem] = useState<EvidenceItem | null>(null);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [signedUrlError, setSignedUrlError] = useState<string | null>(null);

  const group = useMemo(() => groups.find((g) => g.id === groupId), [groups, groupId]);

  const groupReports = useMemo(() => {
    if (!group) return [];
    const memberNames = group.members.map((m) => m.name);
    return reports.filter((r) => memberNames.includes(r.from) || memberNames.includes(r.to));
  }, [group, reports]);

  const stats = useMemo(() => {
    if (!group) return { totalTasks: 0, completedTasks: 0, overdueTasks: 0, avgContribution: 0 };
    const total = group.tasks.length;
    const completed = group.tasks.filter((t) => t.status === "Done").length;
    const overdue = group.tasks.filter((t) => t.status !== "Done" && new Date(t.deadline) < new Date()).length;
    const totalCont = group.members.reduce((acc, m) => acc + (m.contributionPercent || 0), 0);
    const avgContribution = group.members.length ? Math.round(totalCont / group.members.length) : 0;
    
    return { totalTasks: total, completedTasks: completed, overdueTasks: overdue, avgContribution };
  }, [group]);

  const items = useMemo<EvidenceItem[]>(() => {
    if (!group) return [];
    const list: EvidenceItem[] = [];

    group.tasks.forEach(task => {
      task.evidence?.forEach(ev => {
        let type: EvidenceItem["type"] = "evidence";
        const name = ev.fileName.toLowerCase();
        if (name.endsWith(".pdf") || name.endsWith(".docx") || name.endsWith(".ppt") || name.endsWith(".pptx")) type = "doc";
        else if (name.endsWith(".zip") || name.endsWith(".js") || name.endsWith(".ts") || name.endsWith(".py")) type = "code";

        const uploadTime =
          ev.uploadTime instanceof Date ? ev.uploadTime.toISOString() : String(ev.uploadTime || "");
        const fallbackId = [task.id, ev.storagePath || ev.fileName, uploadTime].filter(Boolean).join("-");

        list.push({
          id: ev.storagePath || ev.id || fallbackId,
          type,
          title: ev.fileName,
          subtitle: `Task: ${task.name}`,
          date: ev.uploadTime,
          url: ev.publicUrl,
          storagePath: ev.storagePath,
          data: ev
        });
      });

      list.push({
        id: task.id,
        type: "task",
        title: `Task: ${task.name}`,
        subtitle: `Phân công: ${task.assignedTo}`,
        date: task.deadline,
        data: task
      });
    });

    list.push({
      id: "contribution-summary",
      type: "contribution",
      title: "Bảng tổng hợp đóng góp",
      subtitle: `${group.members.length} thành viên`,
      data: group.members
    });

    if (groupReports.length > 0) {
      list.push({
        id: "peerreview-summary",
        type: "peerreview",
        title: "Tổng hợp Peer Review",
        subtitle: `${groupReports.length} đánh giá`,
        data: groupReports
      });
    }

    list.push({
      id: "ai-summary",
      type: "ai",
      title: "AI Phân tích nhóm",
      subtitle: "Gợi ý tự động",
      data: stats
    });

    return list;
  }, [group, groupReports, stats]);

  const filteredItems = useMemo(() => {
    return items.filter(item => filter === "all" || item.type === filter);
  }, [items, filter]);

  useEffect(() => {
    if (!selectedItem?.storagePath || selectedItem.url || signedUrls[selectedItem.storagePath]) {
      return;
    }

    let cancelled = false;
    setSignedUrlError(null);

    createTaskEvidenceSignedUrl(selectedItem.storagePath, 600)
      .then((url) => {
        if (cancelled || !url) return;
        setSignedUrls((current) => ({ ...current, [selectedItem.storagePath as string]: url }));
      })
      .catch((error) => {
        if (cancelled) return;
        setSignedUrlError(error instanceof Error ? error.message : "Không thể tạo liên kết tải file.");
      });

    return () => {
      cancelled = true;
    };
  }, [selectedItem, signedUrls]);

  if (!group) return (
    <div className="flex h-full items-center justify-center p-6 text-slate-500">
      Đang tải dữ liệu nhóm...
    </div>
  );

  const renderPreview = () => {
    if (!selectedItem) return null;
    const { type, data, url } = selectedItem;
    const resolvedUrl = selectedItem.storagePath ? signedUrls[selectedItem.storagePath] || url : url;

    if (type === "doc" || type === "evidence") {
      const isPdf = selectedItem.title.toLowerCase().endsWith(".pdf");
      const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(selectedItem.title);
      const isVideo = /\.(mp4|webm|ogg)$/i.test(selectedItem.title);

      if (isPdf && resolvedUrl) {
        return <iframe src={resolvedUrl} className="w-full h-full rounded-xl border border-slate-200" title={selectedItem.title} />;
      }
      if (isImg && resolvedUrl) {
        return (
          <div className="w-full h-full flex items-center justify-center bg-slate-50 rounded-xl border border-slate-200 p-4">
            <img src={resolvedUrl} alt={selectedItem.title} className="max-w-full max-h-full object-contain rounded-lg shadow-sm" />
          </div>
        );
      }
      if (isVideo && resolvedUrl) {
        return (
          <div className="w-full h-full flex items-center justify-center bg-slate-900 rounded-xl overflow-hidden">
            <video src={resolvedUrl} controls className="max-w-full max-h-full" />
          </div>
        );
      }
      
      return (
        <div className="flex flex-col items-center justify-center h-full text-center bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <FileText className="w-16 h-16 text-slate-300 mb-4" />
          <h3 className="font-semibold text-slate-900 text-lg mb-1">{selectedItem.title}</h3>
          <p className="text-slate-500 text-sm mb-6">
            {signedUrlError || "Không thể xem trước định dạng file này."}
          </p>
          <div className="flex gap-3">
            {resolvedUrl && (
              <Button onClick={() => window.open(resolvedUrl, "_blank")} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                <Download className="w-4 h-4 mr-2" /> Tải xuống file
              </Button>
            )}
          </div>
        </div>
      );
    }

    if (type === "code") {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <FileCode2 className="w-16 h-16 text-slate-300 mb-4" />
          <h3 className="font-semibold text-slate-900 text-lg mb-1">{selectedItem.title}</h3>
          <p className="text-slate-500 text-sm mb-6">File mã nguồn hoặc tập tin nén ZIP.</p>
          {resolvedUrl && (
            <Button onClick={() => window.open(resolvedUrl, "_blank")} className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
              <Download className="w-4 h-4 mr-2" /> Tải source code
            </Button>
          )}
        </div>
      );
    }

    if (type === "task") {
      return (
        <Card className="p-6 rounded-2xl shadow-sm border-slate-200 bg-white w-full max-w-2xl mx-auto">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{data.name}</h2>
              <p className="text-slate-500 mt-1">Phân công cho: <span className="font-medium text-slate-700">{data.assignedTo}</span></p>
            </div>
            <Badge variant="secondary" className={`
              ${data.status === "Done" ? "bg-emerald-100 text-emerald-700" : ""}
              ${data.status === "In Progress" ? "bg-blue-100 text-blue-700" : ""}
              ${data.status === "Todo" ? "bg-slate-100 text-slate-700" : ""}
            `}>
              {data.status}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-slate-500 block mb-1">Mức đóng góp</span>
              <span className="font-semibold text-slate-900">{data.contributionPercent}%</span>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl">
              <span className="text-slate-500 block mb-1">Hạn chót</span>
              <span className="font-semibold text-slate-900">{new Date(data.deadline).toLocaleDateString(language === "vi" ? "vi-VN" : "en-US")}</span>
            </div>
          </div>
        </Card>
      );
    }

    if (type === "contribution") {
      return (
        <div className="overflow-x-auto bg-white rounded-2xl border border-slate-200 shadow-sm">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">Thành viên</th>
                <th className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap">Tasks hoàn thành</th>
                <th className="px-4 py-3 font-medium text-slate-500 whitespace-nowrap text-center">% Đóng góp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {group.members.map((member) => (
                <tr key={member.name} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {member.name}
                    {member.role === "Leader" && <Badge variant="secondary" className="ml-2 text-[10px]">Leader</Badge>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{member.completedTasks} task</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${member.contributionPercent < 15 ? 'text-red-600' : 'text-indigo-600'}`}>
                      {member.contributionPercent}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    if (type === "peerreview") {
      return (
        <div className="space-y-4 max-w-3xl mx-auto">
          {groupReports.map((report) => (
            <Card key={report.id} className="p-4 rounded-2xl shadow-sm border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 text-sm">
                <span className="font-medium text-slate-700">{report.from} <span className="text-slate-400 mx-2">&rarr;</span> {report.to}</span>
                <span className="text-xs text-slate-400">{new Date(report.timestamp).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-slate-900 font-medium">{report.reason}</p>
              <p className="text-sm text-slate-600 mt-1 italic">"{report.notes}"</p>
            </Card>
          ))}
        </div>
      );
    }

    if (type === "ai") {
      return (
        <Card className="rounded-3xl border-purple-100 bg-gradient-to-br from-purple-50/50 to-white shadow-sm overflow-hidden max-w-3xl mx-auto">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-inner">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">AI Nhận xét nhóm</h3>
                <p className="text-xs text-slate-500">Phân tích tự động để tham khảo (Không tính vào điểm chính thức)</p>
              </div>
            </div>
            
            <div className="space-y-4 text-sm text-slate-700">
              <p>
                <strong>Đánh giá chung:</strong> Nhóm <b>{group.name}</b> có mức độ hoàn thành task {stats.completedTasks / Math.max(1, stats.totalTasks) > 0.7 ? "tốt" : "ở mức trung bình"} ({stats.completedTasks}/{stats.totalTasks}). 
                {stats.overdueTasks > 0 ? ` Có ${stats.overdueTasks} task trễ hạn, cần lưu ý về quản lý thời gian.` : " Tiến độ công việc đang đi đúng hướng."}
              </p>
              {group.members.some(m => m.contributionPercent < 15) && (
                <div className="p-3 bg-red-50 text-red-800 rounded-xl border border-red-100 flex gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong>Cảnh báo phân bổ công việc:</strong>
                    <p className="mt-1 text-xs">Có thành viên đóng góp dưới 15% khối lượng. Vui lòng kiểm tra lại sự cân bằng trong việc phân công task.</p>
                  </div>
                </div>
              )}
              <p>
                <strong>Đề xuất chấm điểm:</strong> Hãy chú ý kỹ tiêu chí "Chất lượng" khi kiểm tra các file đã nộp.
              </p>
            </div>
          </div>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="flex h-full flex-col bg-slate-50 overflow-hidden rounded-2xl border border-slate-200 shadow-sm">
      <div className="shrink-0 border-b border-slate-200 bg-white p-3 flex flex-wrap gap-3 items-center z-10 shadow-sm">
        <div className="w-[160px] sm:w-[180px]">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 text-slate-700 font-medium">
              <SelectValue placeholder="Lọc theo loại" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="all">Tất cả dữ liệu</SelectItem>
              <SelectItem value="submission">Bài nộp</SelectItem>
              <SelectItem value="doc">Tài liệu / PDF</SelectItem>
              <SelectItem value="code">Code / ZIP</SelectItem>
              <SelectItem value="evidence">Minh chứng khác</SelectItem>
              <SelectItem value="task">Tasks</SelectItem>
              <SelectItem value="contribution">Đóng góp</SelectItem>
              <SelectItem value="peerreview">Peer Review</SelectItem>
              <SelectItem value="ai">AI Summary</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex-1 min-w-[200px]">
          <Select 
            value={selectedItem?.id || ""} 
            onValueChange={(val) => setSelectedItem(items.find(i => i.id === val) || null)}
          >
            <SelectTrigger className="h-10 rounded-xl border-slate-200 bg-white w-full">
              <SelectValue placeholder="Chọn tài liệu để xem..." />
            </SelectTrigger>
            <SelectContent className="rounded-xl max-h-[300px]">
              {filteredItems.length === 0 ? (
                <div className="p-3 text-sm text-center text-slate-500">Không có dữ liệu loại này</div>
              ) : (
                filteredItems.map(item => (
                  <SelectItem key={item.id} value={item.id} className="py-2">
                    <div className="flex items-center gap-3 w-[250px] sm:w-[350px]">
                      <ItemIcon type={item.type} className="w-4 h-4 text-slate-400 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 bg-slate-100/50 p-4 lg:p-6 overflow-y-auto border-b border-slate-200 relative min-h-[300px]">
          {!selectedItem ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 border border-slate-100">
                <FolderOpen className="w-8 h-8 text-indigo-300" />
              </div>
              <p className="font-medium text-slate-600">Dữ liệu sinh viên nộp</p>
              <p className="text-sm mt-1">Vui lòng chọn một tài liệu từ danh sách để xem trước.</p>
            </div>
          ) : (
            renderPreview()
          )}
        </div>

        <div className="h-[280px] shrink-0 bg-white overflow-y-auto p-3">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-2 pt-1">
            Danh sách hiện tại ({filteredItems.length})
          </div>
          <div className="space-y-1.5">
            {filteredItems.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className={`w-full text-left flex items-center justify-between p-2.5 rounded-xl text-sm transition-all ${
                  selectedItem?.id === item.id 
                    ? "bg-indigo-50 border border-indigo-100 shadow-sm" 
                    : "hover:bg-slate-50 border border-transparent"
                }`}
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`p-2 rounded-lg shrink-0 ${selectedItem?.id === item.id ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-500"}`}>
                    <ItemIcon type={item.type} className="w-4 h-4" />
                  </div>
                  <div className="truncate">
                    <p className={`font-semibold truncate ${selectedItem?.id === item.id ? "text-indigo-900" : "text-slate-700"}`}>
                      {item.title}
                    </p>
                    {item.subtitle && <p className="text-[11px] text-slate-500 truncate mt-0.5">{item.subtitle}</p>}
                  </div>
                </div>
                {item.date && (
                  <span className="text-xs font-medium text-slate-400 shrink-0 ml-3 whitespace-nowrap bg-white px-2 py-1 rounded-md border border-slate-100">
                    {new Date(item.date).toLocaleDateString()}
                  </span>
                )}
              </button>
            ))}
            {filteredItems.length === 0 && (
              <div className="text-center p-6 text-sm text-slate-500 border border-dashed border-slate-200 rounded-xl">
                Không có dữ liệu để hiển thị.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
