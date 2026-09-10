import test from "node:test";
import assert from "node:assert";
import { AppError } from "../utils/AppError";

test("Customer Payments, Refunds, Returns API & IDOR Protection Tests", async (t) => {
  // Mock data representing multi-tenant customer records
  const orders = [
    {
      id: "order-a-101",
      orderNumber: "ORD-A-101",
      customerId: "customer-a-id",
      status: "DELIVERED",
      paymentStatus: "PAID",
      totalAmount: 1500,
      deletedAt: null,
    },
    {
      id: "order-b-202",
      orderNumber: "ORD-B-202",
      customerId: "customer-b-id",
      status: "COMPLETED",
      paymentStatus: "PAID",
      totalAmount: 3000,
      deletedAt: null,
    },
  ];

  const payments = [
    {
      id: "pay-a-1",
      orderId: "order-a-101",
      customerId: "customer-a-id",
      amount: 1500,
      currency: "BDT",
      status: "PAID",
      provider: "BKASH",
      transactionReference: "TXN-BKASH-001",
      createdAt: new Date("2026-08-01"),
      paidAt: new Date("2026-08-01"),
    },
    {
      id: "pay-b-1",
      orderId: "order-b-202",
      customerId: "customer-b-id",
      amount: 3000,
      currency: "BDT",
      status: "PAID",
      provider: "SSLCOMMERZ",
      transactionReference: "TXN-SSL-002",
      createdAt: new Date("2026-08-02"),
      paidAt: new Date("2026-08-02"),
    },
  ];

  const refunds = [
    {
      id: "ref-a-1",
      orderId: "order-a-101",
      customerId: "customer-a-id",
      amount: 300,
      currency: "BDT",
      status: "COMPLETED",
      reason: "Item slightly damaged",
      createdAt: new Date("2026-08-03"),
      completedAt: new Date("2026-08-04"),
      updatedAt: new Date("2026-08-04"),
    },
    {
      id: "ref-b-1",
      orderId: "order-b-202",
      customerId: "customer-b-id",
      amount: 1000,
      currency: "BDT",
      status: "COMPLETED",
      reason: "Partially returned",
      createdAt: new Date("2026-08-05"),
      completedAt: new Date("2026-08-06"),
      updatedAt: new Date("2026-08-06"),
    },
  ];

  const returns = [
    {
      id: "ret-a-1",
      orderId: "order-a-101",
      customerId: "customer-a-id",
      reason: "Wrong color delivered",
      status: "APPROVED",
      createdAt: new Date("2026-08-03"),
      updatedAt: new Date("2026-08-04"),
      items: [
        {
          id: "ret-item-1",
          orderItemId: "item-a-1",
          quantity: 1,
          reason: "Wrong color",
          condition: "UNOPENED",
          productName: "T-Shirt",
          productImage: "https://example.com/tshirt.jpg",
        },
      ],
    },
    {
      id: "ret-b-1",
      orderId: "order-b-202",
      customerId: "customer-b-id",
      reason: "Defective item",
      status: "REQUESTED",
      createdAt: new Date("2026-08-05"),
      updatedAt: new Date("2026-08-05"),
      items: [
        {
          id: "ret-item-2",
          orderItemId: "item-b-1",
          quantity: 1,
          reason: "Defective",
          condition: "DEFECTIVE",
          productName: "Laptop Charger",
          productImage: "https://example.com/charger.jpg",
        },
      ],
    },
  ];

  // Service implementation simulating customer scoping
  const service = {
    getCustomerPayments: (customerId: string, options: { page?: number; limit?: number; status?: string } = {}) => {
      const filtered = payments.filter((p) => p.customerId === customerId);
      const page = options.page || 1;
      const limit = options.limit || 10;
      return {
        payments: filtered.map((p) => {
          const ord = orders.find((o) => o.id === p.orderId);
          return {
            id: p.id,
            orderId: p.orderId,
            orderNumber: ord?.orderNumber || null,
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            method: p.provider,
            transactionReference: p.transactionReference,
            createdAt: p.createdAt,
            paidAt: p.paidAt,
          };
        }),
        pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
      };
    },

    getOrderPayments: (customerId: string, orderId: string) => {
      const order = orders.find((o) => o.id === orderId && o.customerId === customerId);
      if (!order) {
        throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
      }
      const orderPayments = payments.filter((p) => p.orderId === orderId && p.customerId === customerId);
      const orderRefunds = refunds.filter((r) => r.orderId === orderId && r.customerId === customerId && r.status === "COMPLETED");

      const paidSum = orderPayments.reduce((acc, p) => acc + p.amount, 0);
      const refundSum = orderRefunds.reduce((acc, r) => acc + r.amount, 0);
      const dueAmount = Math.max(0, order.totalAmount - paidSum);

      return {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          summary: {
            total: order.totalAmount,
            paid: paidSum,
            due: dueAmount,
            status: order.paymentStatus,
          },
        },
        payments: orderPayments.map((p) => ({
          id: p.id,
          orderId: p.orderId,
          orderNumber: order.orderNumber,
          amount: p.amount,
          currency: p.currency,
          status: p.status,
          method: p.provider,
          transactionReference: p.transactionReference,
          createdAt: p.createdAt,
          paidAt: p.paidAt,
        })),
      };
    },

    getCustomerRefunds: (customerId: string, options: { page?: number; limit?: number; status?: string } = {}) => {
      const filtered = refunds.filter((r) => r.customerId === customerId);
      const page = options.page || 1;
      const limit = options.limit || 10;
      return {
        refunds: filtered.map((r) => {
          const ord = orders.find((o) => o.id === r.orderId);
          return {
            id: r.id,
            orderId: r.orderId,
            orderNumber: ord?.orderNumber || null,
            amount: r.amount,
            currency: r.currency,
            status: r.status,
            reason: r.reason,
            createdAt: r.createdAt,
            processedAt: r.completedAt,
          };
        }),
        pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
      };
    },

    getOrderRefunds: (customerId: string, orderId: string) => {
      const order = orders.find((o) => o.id === orderId && o.customerId === customerId);
      if (!order) {
        throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
      }
      const orderRefunds = refunds.filter((r) => r.orderId === orderId && r.customerId === customerId);

      return {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
        },
        refunds: orderRefunds.map((r) => ({
          id: r.id,
          orderId: r.orderId,
          orderNumber: order.orderNumber,
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          reason: r.reason,
          createdAt: r.createdAt,
          processedAt: r.completedAt,
        })),
      };
    },

    getCustomerReturns: (customerId: string, options: { page?: number; limit?: number; status?: string } = {}) => {
      const filtered = returns.filter((r) => r.customerId === customerId);
      const page = options.page || 1;
      const limit = options.limit || 10;
      return {
        returns: filtered.map((r) => {
          const ord = orders.find((o) => o.id === r.orderId);
          return {
            returnId: r.id,
            id: r.id,
            order: { id: r.orderId, orderNumber: ord?.orderNumber || null },
            items: r.items,
            reason: r.reason,
            status: r.status,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
          };
        }),
        pagination: { page, limit, total: filtered.length, totalPages: Math.ceil(filtered.length / limit) },
      };
    },

    getOrderReturns: (customerId: string, orderId: string) => {
      const order = orders.find((o) => o.id === orderId && o.customerId === customerId);
      if (!order) {
        throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
      }
      const orderReturns = returns.filter((r) => r.orderId === orderId && r.customerId === customerId);

      return {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
        },
        returns: orderReturns.map((r) => ({
          returnId: r.id,
          id: r.id,
          order: { id: order.id, orderNumber: order.orderNumber },
          items: r.items,
          reason: r.reason,
          status: r.status,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        })),
      };
    },
  };

  await t.test("Customer Payments List: Scoped strictly to authenticated customer", async () => {
    const resA = service.getCustomerPayments("customer-a-id");
    assert.strictEqual(resA.payments.length, 1);
    assert.strictEqual(resA.payments[0].id, "pay-a-1");
    assert.strictEqual(resA.payments[0].amount, 1500);
    assert.strictEqual(resA.payments[0].method, "BKASH");
    assert.strictEqual(resA.payments[0].transactionReference, "TXN-BKASH-001");

    const resB = service.getCustomerPayments("customer-b-id");
    assert.strictEqual(resB.payments.length, 1);
    assert.strictEqual(resB.payments[0].id, "pay-b-1");
    assert.strictEqual(resB.payments[0].method, "SSLCOMMERZ");
  });

  await t.test("Order Payments: Valid owner gets order payments & accounting summary", async () => {
    const res = service.getOrderPayments("customer-a-id", "order-a-101");
    assert.strictEqual(res.order.id, "order-a-101");
    assert.strictEqual(res.order.summary.total, 1500);
    assert.strictEqual(res.order.summary.paid, 1500);
    assert.strictEqual(res.order.summary.due, 0); // 1500 total - 1500 paid = 0 due
    assert.strictEqual(res.payments.length, 1);
    assert.strictEqual(res.payments[0].amount, 1500);
  });

  await t.test("IDOR Protection: Customer A requesting Customer B order payments throws 404 ORDER_NOT_FOUND", async () => {
    assert.throws(
      () => {
        service.getOrderPayments("customer-a-id", "order-b-202");
      },
      (err: any) => {
        assert.strictEqual(err instanceof AppError, true);
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, "ORDER_NOT_FOUND");
        return true;
      }
    );
  });

  await t.test("Customer Refunds List: Scoped strictly to authenticated customer", async () => {
    const resA = service.getCustomerRefunds("customer-a-id");
    assert.strictEqual(resA.refunds.length, 1);
    assert.strictEqual(resA.refunds[0].id, "ref-a-1");
    assert.strictEqual(resA.refunds[0].amount, 300);
    assert.strictEqual(resA.refunds[0].status, "COMPLETED");
  });

  await t.test("IDOR Protection: Customer A requesting Customer B order refunds throws 404 ORDER_NOT_FOUND", async () => {
    assert.throws(
      () => {
        service.getOrderRefunds("customer-a-id", "order-b-202");
      },
      (err: any) => {
        assert.strictEqual(err instanceof AppError, true);
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, "ORDER_NOT_FOUND");
        return true;
      }
    );
  });

  await t.test("Customer Returns List: Scoped strictly to authenticated customer", async () => {
    const resA = service.getCustomerReturns("customer-a-id");
    assert.strictEqual(resA.returns.length, 1);
    assert.strictEqual(resA.returns[0].returnId, "ret-a-1");
    assert.strictEqual(resA.returns[0].reason, "Wrong color delivered");
    assert.strictEqual(resA.returns[0].items.length, 1);
    assert.strictEqual(resA.returns[0].items[0].productName, "T-Shirt");
  });

  await t.test("IDOR Protection: Customer A requesting Customer B order returns throws 404 ORDER_NOT_FOUND", async () => {
    assert.throws(
      () => {
        service.getOrderReturns("customer-a-id", "order-b-202");
      },
      (err: any) => {
        assert.strictEqual(err instanceof AppError, true);
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, "ORDER_NOT_FOUND");
        return true;
      }
    );
  });
});
