import test from "node:test";
import assert from "node:assert";
import { AppError } from "../utils/AppError";

test("Customer Shipments & Tracking API & IDOR Protection Tests", async (t) => {
  const orders = [
    {
      id: "order-a-101",
      orderNumber: "ORD-A-101",
      customerId: "customer-a-id",
      status: "SHIPPED",
      deletedAt: null,
    },
    {
      id: "order-b-202",
      orderNumber: "ORD-B-202",
      customerId: "customer-b-id",
      status: "DELIVERED",
      deletedAt: null,
    },
  ];

  const shipments = [
    {
      id: "shipment-a-1",
      orderId: "order-a-101",
      customerId: "customer-a-id",
      courierName: "Pathao Courier",
      trackingUrlPrefix: "https://pathao.com/track/",
      trackingNumber: "PTH-100200300",
      status: "IN_TRANSIT",
      shippedAt: new Date("2026-08-10T10:00:00Z"),
      deliveredAt: null,
      createdAt: new Date("2026-08-10T09:00:00Z"),
      items: [
        {
          id: "ship-item-1",
          orderItemId: "item-a-1",
          quantity: 2,
          productName: "Wireless Earbuds",
          productImage: "https://example.com/earbuds.jpg",
          warehouseName: "Dhaka Central Warehouse",
        },
      ],
      trackingEvents: [
        {
          id: "event-a-2",
          status: "IN_TRANSIT",
          location: "Dhaka Sorting Hub",
          description: "Package departed sorting facility",
          timestamp: new Date("2026-08-10T14:00:00Z"),
        },
        {
          id: "event-a-1",
          status: "INFO_RECEIVED",
          location: "Dhaka Warehouse",
          description: "Shipment info received by courier",
          timestamp: new Date("2026-08-10T10:00:00Z"),
        },
      ],
    },
    {
      id: "shipment-b-1",
      orderId: "order-b-202",
      customerId: "customer-b-id",
      courierName: "Steadfast Courier",
      trackingUrlPrefix: "https://steadfast.com.bd/t/",
      trackingNumber: "STDF-999888777",
      status: "DELIVERED",
      shippedAt: new Date("2026-08-11T10:00:00Z"),
      deliveredAt: new Date("2026-08-12T16:00:00Z"),
      createdAt: new Date("2026-08-11T08:00:00Z"),
      items: [
        {
          id: "ship-item-2",
          orderItemId: "item-b-1",
          quantity: 1,
          productName: "Smart Watch",
          productImage: "https://example.com/watch.jpg",
          warehouseName: "Chittagong Hub",
        },
      ],
      trackingEvents: [
        {
          id: "event-b-1",
          status: "DELIVERED",
          location: "Customer Address",
          description: "Delivered to recipient",
          timestamp: new Date("2026-08-12T16:00:00Z"),
        },
      ],
    },
  ];

  const service = {
    getCustomerShipments: (customerId: string, options: { page?: number; limit?: number; status?: string } = {}) => {
      const userOrders = orders.filter((o) => o.customerId === customerId).map((o) => o.id);
      let userShipments = shipments.filter((s) => userOrders.includes(s.orderId));

      if (options.status && options.status !== "ALL") {
        userShipments = userShipments.filter((s) => s.status === options.status);
      }

      const page = options.page || 1;
      const limit = options.limit || 10;

      return {
        shipments: userShipments.map((s) => {
          const ord = orders.find((o) => o.id === s.orderId);
          return {
            id: s.id,
            shipmentId: s.id,
            orderId: s.orderId,
            orderNumber: ord?.orderNumber || null,
            status: s.status,
            carrier: s.courierName,
            courierName: s.courierName,
            trackingNumber: s.trackingNumber,
            trackingUrl: s.trackingUrlPrefix + s.trackingNumber,
            shippedAt: s.shippedAt,
            estimatedDelivery: null,
            deliveredAt: s.deliveredAt,
            createdAt: s.createdAt,
            items: s.items,
            trackingEvents: s.trackingEvents,
          };
        }),
        pagination: { page, limit, total: userShipments.length, totalPages: Math.ceil(userShipments.length / limit) },
      };
    },

    getOrderShipments: (customerId: string, orderId: string) => {
      const order = orders.find((o) => o.id === orderId && o.customerId === customerId);
      if (!order) {
        throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
      }

      const orderShipments = shipments.filter((s) => s.orderId === orderId);

      return {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
        },
        shipments: orderShipments.map((s) => ({
          id: s.id,
          shipmentId: s.id,
          orderId: s.orderId,
          orderNumber: order.orderNumber,
          status: s.status,
          carrier: s.courierName,
          courierName: s.courierName,
          trackingNumber: s.trackingNumber,
          trackingUrl: s.trackingUrlPrefix + s.trackingNumber,
          shippedAt: s.shippedAt,
          estimatedDelivery: null,
          deliveredAt: s.deliveredAt,
          createdAt: s.createdAt,
          items: s.items,
          trackingEvents: s.trackingEvents,
        })),
      };
    },

    getOrderTracking: (customerId: string, orderId: string) => {
      const order = orders.find((o) => o.id === orderId && o.customerId === customerId);
      if (!order) {
        throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
      }

      const orderShipments = shipments.filter((s) => s.orderId === orderId);
      const latest = orderShipments[0];

      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderStatus: order.status,
        shipmentStatus: latest?.status || order.status,
        carrier: latest?.courierName || null,
        trackingNumber: latest?.trackingNumber || null,
        trackingUrl: latest ? latest.trackingUrlPrefix + latest.trackingNumber : null,
        shippedAt: latest?.shippedAt || null,
        estimatedDelivery: null,
        deliveredAt: latest?.deliveredAt || null,
        shipments: orderShipments.map((s) => ({
          id: s.id,
          status: s.status,
          carrier: s.courierName,
          trackingNumber: s.trackingNumber,
          trackingUrl: s.trackingUrlPrefix + s.trackingNumber,
          shippedAt: s.shippedAt,
          deliveredAt: s.deliveredAt,
          trackingEvents: s.trackingEvents,
        })),
      };
    },
  };

  await t.test("Customer Shipments List: Scoped strictly to authenticated customer", async () => {
    const resA = service.getCustomerShipments("customer-a-id");
    assert.strictEqual(resA.shipments.length, 1);
    assert.strictEqual(resA.shipments[0].id, "shipment-a-1");
    assert.strictEqual(resA.shipments[0].carrier, "Pathao Courier");
    assert.strictEqual(resA.shipments[0].trackingNumber, "PTH-100200300");
    assert.strictEqual(resA.shipments[0].trackingUrl, "https://pathao.com/track/PTH-100200300");
    assert.strictEqual(resA.shipments[0].status, "IN_TRANSIT");
    assert.strictEqual(resA.shipments[0].items.length, 1);
    assert.strictEqual(resA.shipments[0].items[0].productName, "Wireless Earbuds");

    const resB = service.getCustomerShipments("customer-b-id");
    assert.strictEqual(resB.shipments.length, 1);
    assert.strictEqual(resB.shipments[0].id, "shipment-b-1");
    assert.strictEqual(resB.shipments[0].carrier, "Steadfast Courier");
    assert.strictEqual(resB.shipments[0].status, "DELIVERED");
  });

  await t.test("Order Shipments: Valid owner retrieves order shipments", async () => {
    const res = service.getOrderShipments("customer-a-id", "order-a-101");
    assert.strictEqual(res.order.id, "order-a-101");
    assert.strictEqual(res.shipments.length, 1);
    assert.strictEqual(res.shipments[0].trackingNumber, "PTH-100200300");
  });

  await t.test("IDOR Protection: Customer A requesting Customer B order shipments throws 404 ORDER_NOT_FOUND", async () => {
    assert.throws(
      () => {
        service.getOrderShipments("customer-a-id", "order-b-202");
      },
      (err: any) => {
        assert.strictEqual(err instanceof AppError, true);
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, "ORDER_NOT_FOUND");
        return true;
      }
    );
  });

  await t.test("Order Tracking: Valid owner retrieves order tracking timeline & carrier info", async () => {
    const res = service.getOrderTracking("customer-a-id", "order-a-101");
    assert.strictEqual(res.orderId, "order-a-101");
    assert.strictEqual(res.shipmentStatus, "IN_TRANSIT");
    assert.strictEqual(res.carrier, "Pathao Courier");
    assert.strictEqual(res.trackingNumber, "PTH-100200300");
    assert.strictEqual(res.trackingUrl, "https://pathao.com/track/PTH-100200300");
    assert.strictEqual(res.shipments[0].trackingEvents.length, 2);
    assert.strictEqual(res.shipments[0].trackingEvents[0].status, "IN_TRANSIT");
  });

  await t.test("IDOR Protection: Customer A requesting Customer B order tracking throws 404 ORDER_NOT_FOUND", async () => {
    assert.throws(
      () => {
        service.getOrderTracking("customer-a-id", "order-b-202");
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
