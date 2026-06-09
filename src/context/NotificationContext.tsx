import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { useRealtimeSubscription } from "@/hooks/useRealtimeSubscription";
import {
  applyNotificationUpdate,
  mapNotificationRow,
  mergeNotificationInsert,
  removeNotificationById,
  type DbNotificationRow,
  type Notification,
} from "@/lib/notificationState";

export type { Notification } from "@/lib/notificationState";

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  sendNotification: (recipientId: string, senderName: string, content: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const canPersist = isSupabaseConfigured && Boolean(user?.id);

  const showNotificationToast = useCallback((notification: Notification) => {
    toast({
      title: `Notification from ${notification.senderName}`,
      description: notification.content,
    });
  }, [toast]);

  // Load and seed notifications
  useEffect(() => {
    if (canPersist && user?.id) {
      const fetchNotifications = async () => {
        try {
          const { data, error } = await supabase
            .from("notifications")
            .select("*")
            .eq("recipient_id", user.id)
            .order("created_at", { ascending: false });

          if (error) throw error;
          const mapped: Notification[] = (data || []).map((row: DbNotificationRow) => mapNotificationRow(row));

          setNotifications(mapped);
        } catch (err) {
          console.error("Error fetching notifications:", err);
        }
      };

      void fetchNotifications();
    } else {
      // Demo session or offline mode: seed notifications
      const recipientId = user?.id || "demo-recipient-id";
      const seeded: Notification[] = [
        {
          id: "seed-1",
          recipientId,
          senderName: "Lecturer",
          content: "Lecturer published your performance evaluation review",
          isRead: false,
          createdAt: new Date(Date.now() - 3600000),
        },
        {
          id: "seed-2",
          recipientId,
          senderName: "Trần Thị B",
          content: "Trần Thị B added a new document to the Materials folder",
          isRead: false,
          createdAt: new Date(Date.now() - 7200000),
        },
      ];
      setNotifications(seeded);
    }
  }, [canPersist, user?.id]);

  useRealtimeSubscription<DbNotificationRow>({
    enabled: canPersist && Boolean(user?.id),
    table: "notifications",
    filter: user?.id ? `recipient_id=eq.${user.id}` : undefined,
    requireFilter: true,
    events: ["INSERT", "UPDATE", "DELETE"],
    onPayload: payload => {
      if (payload.eventType === "INSERT") {
        const notification = mapNotificationRow(payload.new);
        let shouldToast = false;

        setNotifications(prev => {
          const result = mergeNotificationInsert(prev, notification);
          shouldToast = result.inserted && !notification.isRead;
          return result.notifications;
        });

        if (shouldToast) {
          showNotificationToast(notification);
        }
        return;
      }

      if (payload.eventType === "UPDATE") {
        setNotifications(prev => applyNotificationUpdate(prev, mapNotificationRow(payload.new)));
        return;
      }

      const deletedId = typeof payload.old?.id === "string" ? payload.old.id : undefined;
      if (deletedId) {
        setNotifications(prev => removeNotificationById(prev, deletedId));
      }
    },
    onStatus: (status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.warn("Notification realtime subscription degraded:", status, error);
      }
    },
  });

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  const sendNotification = useCallback(async (recipientId: string, senderName: string, content: string) => {
    try {
      if (canPersist) {
        const { data, error } = await supabase
          .from("notifications")
          .insert({
            recipient_id: recipientId,
            sender_name: senderName,
            content,
            is_read: false,
          })
          .select()
          .single();

        if (error) throw error;

        if (data) {
          const newNotif = mapNotificationRow(data as DbNotificationRow);

          // Only update state if the current user is the recipient
          if (newNotif.recipientId === user?.id) {
            let shouldToast = false;
            setNotifications(prev => {
              const result = mergeNotificationInsert(prev, newNotif);
              shouldToast = result.inserted && !newNotif.isRead;
              return result.notifications;
            });
            if (shouldToast) {
              showNotificationToast(newNotif);
            }
          } else {
            showNotificationToast(newNotif);
          }
        }
      } else {
        // In-memory demo mode
        const generatedId = typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Math.random().toString(36).substring(2, 15);

        const newNotif: Notification = {
          id: generatedId,
          recipientId,
          senderName,
          content,
          isRead: false,
          createdAt: new Date(),
        };

        const currentUserId = user?.id || "demo-recipient-id";
        if (recipientId === currentUserId) {
          let shouldToast = false;
          setNotifications(prev => {
            const result = mergeNotificationInsert(prev, newNotif);
            shouldToast = result.inserted && !newNotif.isRead;
            return result.notifications;
          });
          if (shouldToast) {
            showNotificationToast(newNotif);
          }
        } else {
          showNotificationToast(newNotif);
        }
      }

    } catch (err) {
      console.error("Error sending notification:", err);
    }
  }, [canPersist, user?.id, showNotificationToast]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      if (canPersist) {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("id", id);

        if (error) throw error;
      }

      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error("Error marking notification as read:", err);
    }
  }, [canPersist]);

  const markAllAsRead = useCallback(async () => {
    try {
      if (canPersist && user?.id) {
        const { error } = await supabase
          .from("notifications")
          .update({ is_read: true })
          .eq("recipient_id", user.id);

        if (error) throw error;
      }

      setNotifications(prev =>
        prev.map(n => ({ ...n, isRead: true }))
      );
    } catch (err) {
      console.error("Error marking all notifications as read:", err);
    }
  }, [canPersist, user?.id]);

  const value = useMemo(() => ({
    notifications,
    unreadCount,
    sendNotification,
    markAsRead,
    markAllAsRead,
  }), [notifications, unreadCount, sendNotification, markAsRead, markAllAsRead]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
};
