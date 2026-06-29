import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, Clock, User, Folder } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import type { Notification } from "@/context/NotificationContext";

interface NotificationDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notification: Notification | null;
  /** Display name of the source project, if resolved */
  projectName?: string;
  onDelete: (id: string) => void;
}

const NotificationDetailModal: React.FC<NotificationDetailModalProps> = ({
  open,
  onOpenChange,
  notification,
  projectName,
  onDelete,
}) => {
  const { language } = useLanguage();

  if (!notification) return null;

  const formattedDate = new Date(notification.createdAt).toLocaleString(
    language === "vi" ? "vi-VN" : "en-US",
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }
  );

  const initials =
    notification.senderName
      .split(" ")
      .pop()
      ?.substring(0, 2)
      .toUpperCase() || "US";

  const hue =
    notification.senderName
      .split("")
      .reduce((sum, c) => sum + c.charCodeAt(0), 0) % 360;
  const avatarGradient = `linear-gradient(135deg, hsl(${hue}, 70%, 55%), hsl(${(hue + 60) % 360}, 70%, 45%))`;

  const handleDelete = () => {
    onDelete(notification.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-white border border-gray-200 text-gray-900 rounded-2xl p-0 shadow-xl overflow-hidden">
        {/* Header band */}
        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 border-b border-gray-100 px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-center gap-3.5">
              {/* Sender avatar */}
              <div
                className="h-11 w-11 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md shrink-0"
                style={{ background: avatarGradient }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base font-bold text-gray-900 truncate">
                  {notification.senderName}
                </DialogTitle>
                <DialogDescription className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                  <Clock className="h-3 w-3 shrink-0" />
                  {formattedDate}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Project badge */}
          <div className="flex items-center gap-2">
            <Folder className="h-3.5 w-3.5 text-gray-400" />
            {projectName ? (
              <Badge className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-semibold tracking-wide py-0.5 px-2.5 rounded-lg hover:bg-indigo-100 transition-colors">
                {tr(language, `Dự án: ${projectName}`, `Project: ${projectName}`)}
              </Badge>
            ) : (
              <Badge className="bg-gray-100 text-gray-500 border border-gray-200 text-[11px] font-semibold tracking-wide py-0.5 px-2.5 rounded-lg">
                {tr(language, "Chung", "General")}
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
              {notification.content}
            </p>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-4 text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {tr(language, "Người gửi", "Sender")}: {notification.senderName}
            </span>
            <span>
              {notification.isRead
                ? tr(language, "Đã đọc", "Read")
                : tr(language, "Chưa đọc", "Unread")}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg gap-1.5 text-xs font-semibold transition-all"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {tr(language, "Xóa thông báo", "Delete Notification")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="rounded-lg text-xs font-semibold border-gray-200 hover:bg-gray-50 transition-all"
          >
            {tr(language, "Đóng", "Close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NotificationDetailModal;
