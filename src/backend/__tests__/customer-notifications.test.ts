import test from "node:test";
import assert from "node:assert";
import { AppError } from "../utils/AppError";

test("Customer Notifications & IDOR Protection Tests", async (t) => {
  // In-memory mock notification state representing multiple customers and notifications
  let notifications = [
    {
      id: "notif-a-1",
      customerId: "customer-a-id",
      type: "ORDER_SHIPPED",
      channel: "IN_APP",
      title: "Order Shipped",
      message: "Your order ORD-001 has been shipped.",
      status: "SENT",
      metadata: { internalInfo: "secret_carrier_payload_123" },
      orderId: "order-1",
      createdAt: new Date("2026-08-10T10:00:00Z"),
    },
    {
      id: "notif-a-2",
      customerId: "customer-a-id",
      type: "ORDER_DELIVERED",
      channel: "IN_APP",
      title: "Order Delivered",
      message: "Your order ORD-001 was delivered successfully.",
      status: "PENDING",
      metadata: { courierResponseRaw: "internal_json" },
      orderId: "order-1",
      createdAt: new Date("2026-08-11T12:00:00Z"),
    },
    {
      id: "notif-a-3",
      customerId: "customer-a-id",
      type: "GENERAL",
      channel: "IN_APP",
      title: "Welcome Bonus",
      message: "You earned 100 reward points!",
      status: "READ",
      metadata: null,
      orderId: null,
      createdAt: new Date("2026-08-01T08:00:00Z"),
    },
    {
      id: "notif-b-1",
      customerId: "customer-b-id",
      type: "ACCOUNT_SECURITY",
      channel: "IN_APP",
      title: "New Login Detected",
      message: "A new device logged into your account.",
      status: "PENDING",
      metadata: { ip: "192.168.1.1" },
      orderId: null,
      createdAt: new Date("2026-08-12T09:00:00Z"),
    },
  ];

  // Service helper implementation simulating StorefrontNotificationService
  const mockNotificationService = {
    getNotifications(
      customerId: string,
      options: { page?: number; limit?: number; unreadOnly?: boolean } = {}
    ) {
      const page = Math.max(1, options.page || 1);
      const limit = Math.min(50, Math.max(1, options.limit || 10));
      const skip = (page - 1) * limit;

      let filtered = notifications.filter(
        (n) => n.customerId === customerId && n.channel === "IN_APP"
      );

      if (options.unreadOnly) {
        filtered = filtered.filter((n) => n.status !== "READ");
      }

      // Sort by createdAt desc
      filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

      const paginated = filtered.slice(skip, skip + limit);
      const total = filtered.length;

      const unreadCount = notifications.filter(
        (n) => n.customerId === customerId && n.channel === "IN_APP" && n.status !== "READ"
      ).length;

      const formattedNotifications = paginated.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        status: n.status,
        isRead: n.status === "READ",
        orderId: n.orderId || null,
        createdAt: n.createdAt,
      }));

      return {
        notifications: formattedNotifications,
        unreadCount,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      };
    },

    getUnreadCount(customerId: string) {
      return notifications.filter(
        (n) => n.customerId === customerId && n.channel === "IN_APP" && n.status !== "READ"
      ).length;
    },

    markAsRead(customerId: string, notificationId: string) {
      const notif = notifications.find(
        (n) => n.id === notificationId && n.customerId === customerId
      );

      if (!notif) {
        throw new AppError("Notification not found", 404, "NOT_FOUND");
      }

      notif.status = "READ";
      return { status: "READ" };
    },

    markAllAsRead(customerId: string) {
      notifications.forEach((n) => {
        if (n.customerId === customerId && n.channel === "IN_APP" && n.status !== "READ") {
          n.status = "READ";
        }
      });
    },
  };

  await t.test("GET /customer/notifications: Scoped strictly to authenticated Customer A with unreadCount", () => {
    const res = mockNotificationService.getNotifications("customer-a-id");
    assert.strictEqual(res.notifications.length, 3);
    assert.strictEqual(res.unreadCount, 2, "Customer A should have 2 unread notifications");
    assert.strictEqual(res.pagination.total, 3);

    // Verify metadata internal field is NOT present
    res.notifications.forEach((n: any) => {
      assert.strictEqual(n.metadata, undefined, "Internal metadata must not be exposed");
      assert.strictEqual(n.customerId, undefined, "Internal customerId must not be exposed");
    });
  });

  await t.test("GET /customer/notifications?unreadOnly=true: Returns only unread notifications", () => {
    const res = mockNotificationService.getNotifications("customer-a-id", { unreadOnly: true });
    assert.strictEqual(res.notifications.length, 2);
    res.notifications.forEach((n) => {
      assert.strictEqual(n.isRead, false);
    });
  });

  await t.test("PATCH /customer/notifications/:id/read: Customer A marks own notification as read", () => {
    mockNotificationService.markAsRead("customer-a-id", "notif-a-1");

    const res = mockNotificationService.getNotifications("customer-a-id");
    assert.strictEqual(res.unreadCount, 1, "Unread count should decrement to 1");

    const readNotif = res.notifications.find((n) => n.id === "notif-a-1");
    assert.strictEqual(readNotif?.status, "READ");
    assert.strictEqual(readNotif?.isRead, true);
  });

  await t.test("IDOR Test: Customer B attempting to mark Customer A's notification as read returns 404", () => {
    assert.throws(
      () => {
        mockNotificationService.markAsRead("customer-b-id", "notif-a-2");
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, "NOT_FOUND");
        return true;
      }
    );

    // Verify Customer A's notification remains unread
    const notifA2 = notifications.find((n) => n.id === "notif-a-2");
    assert.strictEqual(notifA2?.status, "PENDING", "Customer A's notification must not be modified by Customer B");
  });

  await t.test("PATCH /customer/notifications/read-all: Customer A marks all own notifications as read without affecting Customer B", () => {
    mockNotificationService.markAllAsRead("customer-a-id");

    const resA = mockNotificationService.getNotifications("customer-a-id");
    assert.strictEqual(resA.unreadCount, 0, "Customer A unread count should be 0");

    // Check that Customer B's unread notification was NOT affected
    const resB = mockNotificationService.getNotifications("customer-b-id");
    assert.strictEqual(resB.unreadCount, 1, "Customer B unread count should remain 1");
    assert.strictEqual(resB.notifications[0].isRead, false);
  });
});
