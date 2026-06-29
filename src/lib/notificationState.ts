export interface Notification {
  id: string;
  recipientId: string;
  groupId?: string;
  senderName: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

export interface DbNotificationRow {
  id: string;
  recipient_id: string;
  group_id?: string;
  sender_name: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export function mapNotificationRow(row: DbNotificationRow): Notification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    groupId: row.group_id || undefined,
    senderName: row.sender_name,
    content: row.content,
    isRead: row.is_read,
    createdAt: new Date(row.created_at),
  };
}

export function mergeNotificationInsert(
  notifications: Notification[],
  notification: Notification,
): { notifications: Notification[]; inserted: boolean } {
  if (notifications.some(item => item.id === notification.id)) {
    return { notifications, inserted: false };
  }

  return { notifications: [notification, ...notifications], inserted: true };
}

export function applyNotificationUpdate(
  notifications: Notification[],
  notification: Notification,
): Notification[] {
  if (!notifications.some(item => item.id === notification.id)) {
    return [notification, ...notifications];
  }

  return notifications.map(item => (
    item.id === notification.id ? notification : item
  ));
}

export function removeNotificationById(
  notifications: Notification[],
  id: string,
): Notification[] {
  return notifications.filter(item => item.id !== id);
}
