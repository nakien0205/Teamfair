import React, { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNotifications } from "@/context/NotificationContext";
import { useLanguage } from "@/context/LanguageContext";
import { tr } from "@/lib/i18n";
import { Mail, MailOpen } from "lucide-react";

export const NotificationMailIcon: React.FC = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { language } = useLanguage();
  const [isHovered, setIsHovered] = useState(false);

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return tr(language, "Vừa xong", "Just now");
    if (diffMins < 60) return `${diffMins} ${tr(language, "phút trước", "m ago")}`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} ${tr(language, "giờ trước", "h ago")}`;

    return d.toLocaleDateString(language === "vi" ? "vi-VN" : "en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const IconComponent = isHovered ? MailOpen : Mail;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-all duration-200 focus:outline-none"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          aria-label={tr(language, "Thông báo", "Notifications")}
        >
          <IconComponent className="h-5 w-5 transition-transform duration-200 hover:scale-110" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 shadow-lg border border-border bg-popover text-popover-foreground rounded-lg" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm">
              {tr(language, "Thông báo", "Notifications")}
            </span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 text-xs font-bold bg-red-100 text-red-600 rounded-full dark:bg-red-900/30 dark:text-red-400">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="text-xs text-primary hover:underline font-medium transition-colors"
            >
              {tr(language, "Đánh dấu tất cả đã đọc", "Mark all as read")}
            </button>
          )}
        </div>

        {/* List */}
        <div className="overflow-y-auto max-h-[300px] divide-y divide-border/60">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-muted-foreground">
              <Mail className="h-8 w-8 mb-2 opacity-40 text-muted-foreground" />
              <p className="text-xs font-medium">
                {tr(language, "Bạn chưa có thông báo nào", "No notifications yet")}
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => !notif.isRead && markAsRead(notif.id)}
                className={`p-3 text-left transition-colors cursor-pointer flex flex-col gap-1 select-none hover:bg-muted/50 ${
                  notif.isRead ? "opacity-60 bg-transparent" : "bg-primary/5 border-l-2 border-primary"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-xs text-foreground">
                    {notif.senderName}
                  </span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatTime(notif.createdAt)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed break-words">
                  {notif.content}
                </p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
