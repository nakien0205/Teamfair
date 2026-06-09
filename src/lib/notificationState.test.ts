import { describe, expect, it } from "vitest";
import {
  applyNotificationUpdate,
  mapNotificationRow,
  mergeNotificationInsert,
  removeNotificationById,
  type Notification,
} from "./notificationState";

const baseNotification: Notification = {
  id: "notification-1",
  recipientId: "user-1",
  senderName: "Ada",
  content: "First message",
  isRead: false,
  createdAt: new Date("2026-06-04T00:00:00.000Z"),
};

describe("notificationState", () => {
  it("maps Supabase rows to notification state", () => {
    expect(mapNotificationRow({
      id: "notification-1",
      recipient_id: "user-1",
      sender_name: "Ada",
      content: "First message",
      is_read: false,
      created_at: "2026-06-04T00:00:00.000Z",
    })).toEqual(baseNotification);
  });

  it("adds an inserted notification once", () => {
    const result = mergeNotificationInsert([], baseNotification);

    expect(result.inserted).toBe(true);
    expect(result.notifications).toEqual([baseNotification]);
  });

  it("ignores duplicate inserts", () => {
    const result = mergeNotificationInsert([baseNotification], baseNotification);

    expect(result.inserted).toBe(false);
    expect(result.notifications).toEqual([baseNotification]);
  });

  it("applies updates from another tab", () => {
    const updated = { ...baseNotification, isRead: true, content: "Updated" };

    expect(applyNotificationUpdate([baseNotification], updated)).toEqual([updated]);
  });

  it("removes deleted notifications", () => {
    expect(removeNotificationById([baseNotification], baseNotification.id)).toEqual([]);
  });
});
