import test from "node:test";
import assert from "node:assert";
import { StorefrontAccountService } from "../services/storefront/account.service";
import { prisma } from "../config/db";

// We can mock prisma calls on the prisma object directly for testing
test("Customer Dashboard API DTO & Aggregation Tests", async (t) => {
  await t.test("Dashboard aggregates customer, order, financial and engagement metrics correctly", async (t) => {
    // Mock prisma.customer.findUnique
    const originalCustomerFindUnique = prisma.customer.findUnique;
    const originalOrderFindMany = prisma.order.findMany;
    const originalActivityFindMany = prisma.customerActivity.findMany;
    const originalPaymentAggregate = prisma.payment.aggregate;
    const originalRefundAggregate = prisma.refund.aggregate;
    const originalNotificationCount = prisma.notification.count;
    const originalSessionFindFirst = prisma.customerRefreshToken.findFirst;
    const originalOrderItemFindMany = prisma.orderItem.findMany;
    const originalReviewFindMany = prisma.review.findMany;

    try {
      (prisma.customer.findUnique as any) = async () => {
        return {
          id: "cust-1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          addresses: [{ id: "addr-1", isDefault: true }],
          wishlist: { _count: { items: 5 } },
        } as any;
      };

      (prisma.order.findMany as any) = async () => {
        return [
          {
            id: "ord-1",
            orderNumber: "ORD-001",
            status: "Delivered",
            paymentStatus: "PAID",
            totalAmount: 100,
            createdAt: new Date(),
            items: [{ id: "item-1", productName: "Product 1", quantity: 1, price: 100 }],
          },
          {
            id: "ord-2",
            orderNumber: "ORD-002",
            status: "Pending",
            paymentStatus: "PENDING",
            totalAmount: 50,
            createdAt: new Date(),
            items: [{ id: "item-2", productName: "Product 2", quantity: 1, price: 50 }],
          },
        ] as any;
      };

      (prisma.customerActivity.findMany as any) = async () => {
        return [
          { id: "act-1", action: "LOGIN", createdAt: new Date() },
        ] as any;
      };

      (prisma.payment.aggregate as any) = async () => {
        return { _sum: { amount: 100 } } as any;
      };

      (prisma.refund.aggregate as any) = async () => {
        return { _sum: { amount: 20 } } as any;
      };

      (prisma.notification.count as any) = async () => {
        return 3 as any;
      };

      (prisma.customerRefreshToken.findFirst as any) = async () => {
        return { ipAddress: "127.0.0.1", lastActiveAt: new Date() } as any;
      };

      (prisma.orderItem.findMany as any) = async () => {
        // Return delivered items
        return [
          { id: "item-1", orderId: "ord-1" }
        ] as any;
      };

      (prisma.review.findMany as any) = async () => {
        // Assume no reviews yet, meaning item-1 is eligible
        return [] as any;
      };

      const dashboard = await StorefrontAccountService.getDashboard("cust-1");

      assert.strictEqual(dashboard.profile.firstName, "John");
      assert.strictEqual(dashboard.stats.wishlist, 5);
      
      assert.strictEqual(dashboard.orderSummary.totalOrders, 2);
      assert.strictEqual(dashboard.financialSummary.totalPaid, 100); // from payments
      assert.strictEqual(dashboard.orderSummary.activeOrders, 1); // Pending
      assert.strictEqual(dashboard.orderSummary.completedOrders, 1); // Delivered
      assert.strictEqual(dashboard.financialSummary.totalRefunded, 20); // from refunds
      assert.strictEqual(dashboard.engagement.unreadNotifications, 3);
      assert.strictEqual(dashboard.engagement.pendingReviewCount, 1); // item-1 is unreviewed
      
      assert.strictEqual(dashboard.recent.recentOrders.length, 2);
      assert.strictEqual(dashboard.recentActivity.length, 1);
    } finally {
      // Restore mocks
      (prisma.customer.findUnique as any) = originalCustomerFindUnique;
      (prisma.order.findMany as any) = originalOrderFindMany;
      (prisma.customerActivity.findMany as any) = originalActivityFindMany;
      (prisma.payment.aggregate as any) = originalPaymentAggregate;
      (prisma.refund.aggregate as any) = originalRefundAggregate;
      (prisma.notification.count as any) = originalNotificationCount;
      (prisma.customerRefreshToken.findFirst as any) = originalSessionFindFirst;
      (prisma.orderItem.findMany as any) = originalOrderItemFindMany;
      (prisma.review.findMany as any) = originalReviewFindMany;
    }
  });
});
