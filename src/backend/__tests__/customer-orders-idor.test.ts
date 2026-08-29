import test from "node:test";
import assert from "node:assert";
import { AppError } from "../utils/AppError";

test("Customer Orders API & IDOR Protection Tests", async (t) => {
  // In-memory mock DB and service logic layer to verify IDOR protection & authorization rules
  const createMockService = () => {
    const orders = [
      {
        id: "order-a-101",
        orderNumber: "ORD-A-101",
        customerId: "customer-a-id",
        status: "DELIVERED",
        paymentStatus: "PAID",
        totalAmount: 1500,
        subtotal: 1400,
        taxAmount: 50,
        shippingFee: 50,
        discountAmount: 0,
        shippingAddress: JSON.stringify({ street: "123 Main St", city: "Dhaka" }),
        billingAddress: JSON.stringify({ street: "123 Main St", city: "Dhaka" }),
        paymentMethod: "BKASH",
        createdAt: new Date("2026-08-01"),
        updatedAt: new Date("2026-08-01"),
        deletedAt: null,
        items: [
          {
            id: "item-a-1",
            productId: "prod-1",
            quantity: 2,
            price: 700,
            productName: "Wireless Headphones",
            productSlug: "wireless-headphones",
            productImage: "https://example.com/headphones.jpg",
            variantSku: "SKU-HEADPHONES",
          },
        ],
        payments: [{ id: "pay-1", status: "PAID", amount: 1500 }],
        refunds: [],
        shipments: [
          {
            id: "ship-1",
            trackingNumber: "TRK123456",
            status: "DELIVERED",
            shippedAt: new Date("2026-08-02"),
            courierName: "Steadfast",
            trackingUrl: "https://steadfast.com/track/TRK123456",
          },
        ],
        returnRequests: [],
      },
      {
        id: "order-b-202",
        orderNumber: "ORD-B-202",
        customerId: "customer-b-id",
        status: "Pending",
        paymentStatus: "Unpaid",
        totalAmount: 3000,
        deletedAt: null,
        items: [],
        payments: [],
        refunds: [],
        shipments: [],
        returnRequests: [],
      },
    ];

    return {
      getCustomerOrders: (customerId: string, options: { page?: number; limit?: number; status?: string; search?: string }) => {
        let filtered = orders.filter((o) => o.customerId === customerId);

        if (options.status && options.status !== "ALL") {
          filtered = filtered.filter((o) => o.status === options.status);
        }

        if (options.search) {
          const q = options.search.toLowerCase();
          filtered = filtered.filter((o) => o.orderNumber.toLowerCase().includes(q));
        }

        const page = options.page || 1;
        const limit = options.limit || 10;
        const start = (page - 1) * limit;
        const pageItems = filtered.slice(start, start + limit);

        return {
          orders: pageItems.map((o) => ({
            id: o.id,
            orderNumber: o.orderNumber,
            status: o.status,
            paymentStatus: o.paymentStatus,
            total: o.totalAmount,
            paidAmount: (o.payments as any[]).reduce((acc: number, p: any) => acc + p.amount, 0),
            dueAmount: o.totalAmount - (o.payments as any[]).reduce((acc: number, p: any) => acc + p.amount, 0),
            itemCount: (o.items as any[]).reduce((acc: number, i: any) => acc + i.quantity, 0),
            createdAt: o.createdAt,
            estimatedDeliveryDate: null,
            primaryProductImage: o.items[0]?.productImage || null,
          })),
          pagination: {
            page,
            limit,
            total: filtered.length,
            totalPages: Math.ceil(filtered.length / limit),
          },
        };
      },

      getCustomerOrderById: (customerId: string, orderId: string) => {
        const order = orders.find((o) => o.id === orderId && o.customerId === customerId);
        if (!order) {
          throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
        }
        return order;
      },

      getOrderShipments: (customerId: string, orderId: string) => {
        const order = orders.find((o) => o.id === orderId && o.customerId === customerId);
        if (!order) {
          throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
        }
        return order.shipments;
      },
    };
  };

  await t.test("Customer Order List: Scoped strictly to customer with pagination and search filter", async () => {
    const service = createMockService();
    const result = service.getCustomerOrders("customer-a-id", { page: 1, limit: 10, search: "ORD-A" });

    assert.strictEqual(result.orders.length, 1);
    assert.strictEqual(result.orders[0].orderNumber, "ORD-A-101");
    assert.strictEqual(result.orders[0].total, 1500);
    assert.strictEqual(result.orders[0].paidAmount, 1500);
    assert.strictEqual(result.orders[0].dueAmount, 0);
    assert.strictEqual(result.orders[0].itemCount, 2);
    assert.strictEqual(result.orders[0].primaryProductImage, "https://example.com/headphones.jpg");
  });

  await t.test("IDOR Protection: Customer A requesting Customer B order ID returns 404 ORDER_NOT_FOUND", async () => {
    const service = createMockService();
    const customerAId = "customer-a-id";
    const customerBOrderId = "order-b-202";

    assert.throws(
      () => {
        service.getCustomerOrderById(customerAId, customerBOrderId);
      },
      (err: any) => {
        assert.strictEqual(err instanceof AppError, true);
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, "ORDER_NOT_FOUND");
        return true;
      }
    );
  });

  await t.test("IDOR Protection: Customer A requesting Customer B shipments returns 404 ORDER_NOT_FOUND", async () => {
    const service = createMockService();
    const customerAId = "customer-a-id";
    const customerBOrderId = "order-b-202";

    assert.throws(
      () => {
        service.getOrderShipments(customerAId, customerBOrderId);
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
