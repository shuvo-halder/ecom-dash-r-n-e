import test from "node:test";
import assert from "node:assert";
import { prisma } from "../config/db";
import { AppError } from "../utils/AppError";
import {
  StorefrontShipmentService,
  resolveCourierProviderInfo,
} from "../services/storefront/shipment.service";
import { mapShipmentToStorefrontDTO } from "../dtos/storefront/mappers";

test("STEP 23 — Normalized Storefront Shipment & Tracking API", async (t) => {
  // Save original prisma methods
  const origOrderFindFirst = prisma.order.findFirst;
  const origShipmentFindMany = prisma.shipment.findMany;
  const origShipmentCount = prisma.shipment.count;
  const origShipmentFindFirst = prisma.shipment.findFirst;

  t.afterEach(() => {
    prisma.order.findFirst = origOrderFindFirst;
    prisma.shipment.findMany = origShipmentFindMany;
    prisma.shipment.count = origShipmentCount;
    prisma.shipment.findFirst = origShipmentFindFirst;
  });

  // Mock Database Records
  const mockOrders = [
    {
      id: "ord-user-1",
      orderNumber: "ORD-1001",
      customerId: "cust-1",
      customerEmail: "alice@example.com",
      status: "Processing",
      shippingAddress: JSON.stringify({ phone: "+8801711223344", city: "Dhaka" }),
      billingAddress: JSON.stringify({ phone: "+8801711223344" }),
      deletedAt: null,
      timeline: [
        { id: "tl-1", status: "Order Placed", action: "Created", createdAt: new Date("2026-08-01T10:00:00Z") },
      ],
    },
    {
      id: "ord-user-2",
      orderNumber: "ORD-2002",
      customerId: "cust-2",
      customerEmail: "bob@example.com",
      status: "Delivered",
      shippingAddress: JSON.stringify({ phone: "+8801811223344", city: "Chittagong" }),
      billingAddress: JSON.stringify({ phone: "+8801811223344" }),
      deletedAt: null,
      timeline: [
        { id: "tl-2", status: "Delivered", action: "Fulfilled", createdAt: new Date("2026-08-02T10:00:00Z") },
      ],
    },
    {
      id: "ord-guest-3",
      orderNumber: "ORD-GUEST-3003",
      customerId: null,
      customerEmail: "guest@example.com",
      status: "Shipped",
      shippingAddress: JSON.stringify({ phone: "01911223344", email: "guest@example.com", address: "Banani, Dhaka" }),
      billingAddress: JSON.stringify({ phone: "01911223344" }),
      deletedAt: null,
      timeline: [
        { id: "tl-3", status: "Shipped", action: "Dispatched", createdAt: new Date("2026-08-03T10:00:00Z") },
      ],
    },
  ];

  const mockShipments = [
    {
      id: "ship-pathao-1",
      orderId: "ord-user-1",
      provider: "pathao",
      consignmentId: "CS-PTH-889900",
      trackingNumber: "CS-PTH-889900",
      trackingUrl: "https://merchant.pathao.com/tracking?consignment_id=CS-PTH-889900",
      status: "IN_TRANSIT",
      shippedAt: new Date("2026-08-01T12:00:00Z"),
      deliveredAt: null,
      createdAt: new Date("2026-08-01T11:00:00Z"),
      deletedAt: null,
      // Internal sensitive fields that MUST NOT leak
      providerMetadata: { raw_response: { internal_token: "secret_token_abc" } },
      providerError: "Transient timeout retry",
      syncMetadata: { last_polled_batch: "batch_9" },
      merchantOrderId: "internal-merchant-id-12345",
      courier: { id: "cr-1", name: "Pathao Courier", trackingUrl: "https://merchant.pathao.com/tracking?consignment_id=" },
      order: { id: "ord-user-1", orderNumber: "ORD-1001", status: "Processing" },
      items: [
        {
          id: "item-1",
          orderItemId: "oi-1",
          quantity: 2,
          warehouse: { id: "wh-1", name: "Dhaka Hub" },
          orderItem: {
            product: { id: "p-1", name: "Wireless Headphones", images: [{ url: "https://img.example/p1.jpg", isPrimary: true }] },
          },
        },
      ],
      trackingEvents: [
        { id: "te-1", status: "IN_TRANSIT", location: "Dhaka Sorting Hub", description: "Package in transit", timestamp: new Date("2026-08-01T14:00:00Z") },
      ],
    },
    {
      id: "ship-manual-2",
      orderId: "ord-guest-3",
      provider: "manual",
      consignmentId: null,
      trackingNumber: "MAN-556677",
      trackingUrl: "https://track.manualcarrier.com/MAN-556677",
      status: "SHIPPED",
      shippedAt: new Date("2026-08-03T11:00:00Z"),
      deliveredAt: null,
      createdAt: new Date("2026-08-03T10:30:00Z"),
      deletedAt: null,
      providerMetadata: null,
      providerError: null,
      syncMetadata: null,
      courier: { id: "cr-2", name: "In-House Logistics", trackingUrl: "https://track.manualcarrier.com/" },
      order: { id: "ord-guest-3", orderNumber: "ORD-GUEST-3003", status: "Shipped" },
      items: [
        {
          id: "item-2",
          orderItemId: "oi-2",
          quantity: 1,
          warehouse: { id: "wh-1", name: "Dhaka Hub" },
          orderItem: {
            product: { id: "p-2", name: "Smart Watch", images: [{ url: "https://img.example/p2.jpg", isPrimary: true }] },
          },
        },
      ],
      trackingEvents: [],
    },
    {
      id: "ship-pending-3",
      orderId: "ord-user-2",
      provider: "pathao",
      consignmentId: null,
      trackingNumber: null,
      trackingUrl: null,
      status: "PENDING",
      shippedAt: null,
      deliveredAt: null,
      createdAt: new Date("2026-08-02T10:30:00Z"),
      deletedAt: null,
      courier: { id: "cr-1", name: "Pathao Courier", trackingUrl: "https://merchant.pathao.com/tracking?consignment_id=" },
      order: { id: "ord-user-2", orderNumber: "ORD-2002", status: "Processing" },
      items: [],
      trackingEvents: [],
    },
  ];

  await t.test("1. Customer Own Shipment: Successfully returns normalized shipment DTO", async () => {
    prisma.shipment.findFirst = (async (args: any) => {
      const { id, order } = args.where;
      const ship = mockShipments.find(
        (s) => s.id === id && s.order.id === "ord-user-1" && order?.customerId === "cust-1"
      );
      return ship || null;
    }) as any;

    const res = await StorefrontShipmentService.getShipmentById("cust-1", "ship-pathao-1");

    assert.strictEqual(res.id, "ship-pathao-1");
    assert.strictEqual(res.provider, "PATHAO");
    assert.strictEqual(res.providerName, "Pathao Courier");
    assert.strictEqual(res.status, "IN_TRANSIT");
    assert.strictEqual(res.trackingNumber, "CS-PTH-889900");
    assert.strictEqual(res.trackingUrl, "https://merchant.pathao.com/tracking?consignment_id=CS-PTH-889900");
    assert.ok(res.shippedAt);

    // Verify ZERO leakage of sensitive fields
    assert.strictEqual((res as any).providerMetadata, undefined);
    assert.strictEqual((res as any).providerError, undefined);
    assert.strictEqual((res as any).syncMetadata, undefined);
    assert.strictEqual((res as any).merchantOrderId, undefined);
  });

  await t.test("2. IDOR Protection: Customer A cannot access Customer B's shipment", async () => {
    prisma.shipment.findFirst = (async (args: any) => {
      const { id, order } = args.where;
      const ship = mockShipments.find((s) => s.id === id);
      if (!ship) return null;
      const ord = mockOrders.find((o) => o.id === ship.orderId);
      if (ord && ord.customerId === order?.customerId) {
        return ship;
      }
      return null;
    }) as any;

    await assert.rejects(
      async () => {
        // Customer 1 trying to view Customer 2's shipment
        await StorefrontShipmentService.getShipmentById("cust-1", "ship-pending-3");
      },
      (err: any) => {
        assert.strictEqual(err instanceof AppError, true);
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, "SHIPMENT_NOT_FOUND");
        return true;
      }
    );
  });

  await t.test("3. IDOR Protection: Customer A cannot access Customer B's order tracking", async () => {
    prisma.order.findFirst = (async (args: any) => {
      const { id, customerId } = args.where;
      const ord = mockOrders.find((o) => o.id === id && o.customerId === customerId);
      return ord || null;
    }) as any;

    await assert.rejects(
      async () => {
        // cust-1 tries to track cust-2's order
        await StorefrontShipmentService.getOrderTracking("cust-1", "ord-user-2");
      },
      (err: any) => {
        assert.strictEqual(err instanceof AppError, true);
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, "ORDER_NOT_FOUND");
        return true;
      }
    );
  });

  await t.test("4. Missing Shipment: Order exists without shipments returns graceful normalized payload", async () => {
    prisma.order.findFirst = (async () => {
      return {
        id: "ord-user-empty",
        orderNumber: "ORD-EMPTY-001",
        customerId: "cust-1",
        status: "Processing",
        shipments: [],
        timeline: [
          { id: "tl-e1", status: "Order Placed", action: "Created", createdAt: new Date() },
        ],
      };
    }) as any;

    const res = await StorefrontShipmentService.getOrderTracking("cust-1", "ord-user-empty");

    assert.strictEqual(res.orderId, "ord-user-empty");
    assert.strictEqual(res.orderNumber, "ORD-EMPTY-001");
    assert.strictEqual(res.status, "PROCESSING");
    assert.strictEqual(res.provider, null);
    assert.strictEqual(res.providerName, null);
    assert.strictEqual(res.trackingNumber, null);
    assert.strictEqual(res.trackingUrl, null);
    assert.deepStrictEqual(res.shipments, []);
    assert.strictEqual(res.orderTimeline.length, 1);
  });

  await t.test("5. Manual Shipment: Correctly normalized with provider MANUAL", async () => {
    const rawManualShipment = mockShipments[1];
    const dto = mapShipmentToStorefrontDTO(rawManualShipment);

    assert.strictEqual(dto.provider, "MANUAL");
    assert.strictEqual(dto.providerName, "In-House Logistics");
    assert.strictEqual(dto.status, "SHIPPED");
    assert.strictEqual(dto.trackingNumber, "MAN-556677");
    assert.strictEqual(dto.trackingUrl, "https://track.manualcarrier.com/MAN-556677");
    assert.ok(dto.shippedAt);
  });

  await t.test("6. Pathao Shipment: Correctly normalized with provider PATHAO & secure trackingUrl", async () => {
    const rawPathaoShipment = mockShipments[0];
    const dto = mapShipmentToStorefrontDTO(rawPathaoShipment);

    assert.strictEqual(dto.provider, "PATHAO");
    assert.strictEqual(dto.providerName, "Pathao Courier");
    assert.strictEqual(dto.status, "IN_TRANSIT");
    assert.strictEqual(dto.trackingNumber, "CS-PTH-889900");
    assert.strictEqual(dto.trackingUrl, "https://merchant.pathao.com/tracking?consignment_id=CS-PTH-889900");
  });

  await t.test("7. Unavailable Tracking: Gracefully returns null for trackingNumber and trackingUrl", async () => {
    const unavailShipment = mockShipments[2];
    const dto = mapShipmentToStorefrontDTO(unavailShipment);

    assert.strictEqual(dto.status, "PENDING");
    assert.strictEqual(dto.trackingNumber, null);
    assert.strictEqual(dto.trackingUrl, null);
  });

  await t.test("8. Guest Order Security Model: Authorized guest retrieves normalized tracking", async () => {
    prisma.order.findFirst = (async (args: any) => {
      const match = mockOrders.find((o) => o.orderNumber === "ORD-GUEST-3003");
      if (!match) return null;
      return {
        ...match,
        shipments: [mockShipments[1]],
      };
    }) as any;

    const res = await StorefrontShipmentService.getGuestOrderTracking(
      "ORD-GUEST-3003",
      "01911223344"
    );

    assert.strictEqual(res.orderNumber, "ORD-GUEST-3003");
    assert.strictEqual(res.provider, "MANUAL");
    assert.strictEqual(res.providerName, "In-House Logistics");
    assert.strictEqual(res.trackingNumber, "MAN-556677");
    assert.strictEqual(res.status, "SHIPPED");
  });

  await t.test("9. Guest Order Security Model: Unauthorized guest with wrong phone/email rejected with 404", async () => {
    prisma.order.findFirst = (async (args: any) => {
      return {
        ...mockOrders[2],
        shipments: [mockShipments[1]],
      };
    }) as any;

    await assert.rejects(
      async () => {
        // Attacker attempting to track someone's guest order with wrong phone
        await StorefrontShipmentService.getGuestOrderTracking(
          "ORD-GUEST-3003",
          "01700000000"
        );
      },
      (err: any) => {
        assert.strictEqual(err instanceof AppError, true);
        assert.strictEqual(err.statusCode, 404);
        assert.strictEqual(err.code, "ORDER_NOT_FOUND");
        return true;
      }
    );
  });

  await t.test("10. Provider Agnosticism & Normalized Status Contract", () => {
    const validStatuses = [
      "PENDING",
      "PROCESSING",
      "PACKED",
      "SHIPPED",
      "IN_TRANSIT",
      "OUT_FOR_DELIVERY",
      "DELIVERED",
      "FAILED_DELIVERY",
      "RETURNED",
      "CANCELLED",
    ];

    mockShipments.forEach((s) => {
      const dto = mapShipmentToStorefrontDTO(s);
      assert.ok(
        validStatuses.includes(dto.status),
        `Status ${dto.status} must be one of the normalized statuses`
      );
    });
  });
});
