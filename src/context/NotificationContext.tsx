import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { isDemoSession } from "@/lib/demoSession";
import { isSupabaseConfigured, supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";

export interface Notification {
  id: string;
  recipientId: string;
  senderName: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

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

  const canPersist = isSupabaseConfigured && !isDemoSession() && Boolean(user?.id);

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

          const mapped: Notification[] = (data || []).map((row: any) => ({
            id: row.id,
            recipientId: row.recipient_id,
            senderName: row.sender_name,
            content: row.content,
            isRead: row.is_read,
            createdAt: new Date(row.created_at),
          }));

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
          const newNotif: Notification = {
            id: data.id,
            recipientId: data.recipient_id,
            senderName: data.sender_name,
            content: data.content,
            isRead: data.is_read,
            createdAt: new Date(data.created_at),
          };

          // Only update state if the current user is the recipient
          if (newNotif.recipientId === user?.id) {
            setNotifications(prev => [newNotif, ...prev]);
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
          setNotifications(prev => [newNotif, ...prev]);
        }
      }

      // Trigger Toast notification
      toast({
        title: `Notification from ${senderName}`,
        description: content,
      });

    } catch (err) {
      console.error("Error sending notification:", err);
    }
  }, [canPersist, user?.id, toast]);

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
