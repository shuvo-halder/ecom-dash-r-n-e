import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../config/db";
import { AdminShipmentService } from "../services/shipment.service";
import { courierRegistry } from "../integrations/courier/courier-provider.registry";
import { CourierConfigService } from "../integrations/courier/courier-config.service";
import { ShipmentStatus } from "@prisma/client";

test("STEP 22 — Provider-Agnostic Shipment Creation Workflow", async (t) => {
  // Save originals
  const originalFindUniqueShipment = prisma.shipment.findUnique;
  const originalTransaction = prisma.$transaction;
  const origClientId = process.env.PATHAO_CLIENT_ID;
  const origClientSecret = process.env.PATHAO_CLIENT_SECRET;
  const origUsername = process.env.PATHAO_USERNAME;
  const origPassword = process.env.PATHAO_PASSWORD;

  // Clear Pathao env credentials to guarantee it is unconfigured
  delete process.env.PATHAO_CLIENT_ID;
  delete process.env.PATHAO_CLIENT_SECRET;
  delete process.env.PATHAO_USERNAME;
  delete process.env.PATHAO_PASSWORD;
  CourierConfigService.clearCache();

  t.afterEach(() => {
    prisma.shipment.findUnique = originalFindUniqueShipment;
    prisma.$transaction = originalTransaction;
  });

  t.after(() => {
    process.env.PATHAO_CLIENT_ID = origClientId;
    process.env.PATHAO_CLIENT_SECRET = origClientSecret;
    process.env.PATHAO_USERNAME = origUsername;
    process.env.PATHAO_PASSWORD = origPassword;
    CourierConfigService.clearCache();
  });

  await t.test("1. Architecture Rule: Business logic does not contain hardcoded if (provider === 'PATHAO')", () => {
    const shipmentServicePath = path.join(
      process.cwd(),
      "src/backend/services/shipment.service.ts"
    );
    const code = fs.readFileSync(shipmentServicePath, "utf-8");

    assert.ok(
      !code.includes('if (provider === "PATHAO")') &&
        !code.includes('if (provider === "pathao")') &&
        !code.includes("if (provider === 'PATHAO')") &&
        !code.includes("if (provider === 'pathao')"),
      "AdminShipmentService must not contain hardcoded provider checks"
    );
  });

  await t.test("2. Pathao: If selected while not configured, returns PATHAO_NOT_CONFIGURED without fake shipment", async () => {
    // Ensure Pathao adapter reports not configured
    const pathaoAdapter = courierRegistry.getProvider("pathao");
    assert.strictEqual(pathaoAdapter.isConfigured(), false);

    let shipmentCreated = false;
    let orderStatusChanged = false;

    const mockOrder = {
      id: "ord-test-1",
      orderNumber: "1001",
      status: "Pending",
      totalAmount: 1200,
      paymentStatus: "Unpaid",
      shippingAddress: "Dhanmondi, Dhaka",
      customer: { firstName: "Rahim", lastName: "Ahmed", phone: "+8801711223344" },
      items: [{ id: "oi-1", productName: "Shirt", quantity: 2, price: 600, warehouseId: "wh-1" }],
      shipments: [],
    };

    const mockTx: any = {
      order: {
        update: async (args: any) => {
          if (args.data.status) orderStatusChanged = true;
          return mockOrder;
        },
        findUnique: async () => mockOrder,
      },
      shipment: {
        create: async () => {
          shipmentCreated = true;
          return { id: "fake-shipment" };
        },
      },
      orderTimeline: {
        create: async () => ({ id: "tl-1" }),
      },
    };

    (prisma.shipment.findUnique as any) = async () => null;
    (prisma.$transaction as any) = async (cb: any) => cb(mockTx);

    let thrownError: any = null;
    try {
      await AdminShipmentService.createShipment({
        orderId: "ord-test-1",
        provider: "pathao",
        notes: "Attempting unconfigured Pathao dispatch",
      });
    } catch (err: any) {
      thrownError = err;
    }

    assert.ok(thrownError, "Should throw error when Pathao is not configured");
    assert.strictEqual(
      thrownError.code,
      "PATHAO_NOT_CONFIGURED",
      `Expected error code PATHAO_NOT_CONFIGURED, got ${thrownError.code}`
    );
    assert.strictEqual(shipmentCreated, false, "Do not create a fake shipment");
    assert.strictEqual(orderStatusChanged, false, "Do not change order status incorrectly");
  });

  await t.test("3. Manual Courier: Shipment creation works and normalizes tracking, status, fee, and notes", async () => {
    let createdShipmentData: any = null;
    let updatedOrderStatus: string | null = null;
    let timelineCreated: any = null;

    const mockOrder = {
      id: "ord-test-2",
      orderNumber: "1002",
      status: "Pending",
      totalAmount: 1500,
      paymentStatus: "Unpaid",
      shippingAddress: "Gulshan 2, Dhaka",
      customer: { firstName: "Karim", lastName: "Hasan", phone: "+8801811223344" },
      items: [{ id: "oi-2", productName: "Pants", quantity: 2, price: 750, warehouseId: "wh-2" }],
      shipments: [],
    };

    const mockTx: any = {
      order: {
        update: async (args: any) => {
          if (args.data.status) updatedOrderStatus = args.data.status;
          return mockOrder;
        },
        findUnique: async () => mockOrder,
      },
      shipment: {
        create: async (args: any) => {
          createdShipmentData = args.data;
          return {
            id: "ship-manual-1",
            ...args.data,
          };
        },
      },
      orderTimeline: {
        create: async (args: any) => {
          timelineCreated = args.data;
          return { id: "tl-2", ...args.data };
        },
      },
    };

    (prisma.shipment.findUnique as any) = async () => null;
    (prisma.$transaction as any) = async (cb: any) => cb(mockTx);

    const customTracking = "MAN-CUSTOM-999";
    const testFee = 80;
    const testNotes = "Special fragile package dispatch";

    const result = await AdminShipmentService.createShipment({
      orderId: "ord-test-2",
      provider: "manual",
      trackingNumber: customTracking,
      deliveryFee: testFee,
      notes: testNotes,
      status: "SHIPPED",
    });

    assert.ok(result, "Shipment must be returned");
    assert.strictEqual(createdShipmentData.provider, "manual");
    assert.strictEqual(createdShipmentData.trackingNumber, customTracking);
    assert.strictEqual(createdShipmentData.deliveryFee, testFee);
    assert.strictEqual(createdShipmentData.status, ShipmentStatus.SHIPPED);
    assert.strictEqual(createdShipmentData.providerMetadata?.notes, testNotes);
    assert.strictEqual(updatedOrderStatus, "Shipped");
    assert.ok(timelineCreated?.action.includes("Manual"));
  });

  await t.test("4. Idempotency: Duplicate active shipment prevention", async () => {
    const mockOrderWithActiveShipment = {
      id: "ord-test-3",
      orderNumber: "1003",
      status: "Shipped",
      items: [{ id: "oi-3", productName: "Shoes", quantity: 1, price: 1000 }],
      shipments: [
        {
          id: "existing-ship-1",
          trackingNumber: "MAN-EXISTING-123",
          status: ShipmentStatus.SHIPPED,
          items: [{ orderItemId: "oi-3", quantity: 1 }],
        },
      ],
    };

    const mockTx: any = {
      order: {
        update: async () => mockOrderWithActiveShipment,
        findUnique: async () => mockOrderWithActiveShipment,
      },
    };

    (prisma.shipment.findUnique as any) = async () => null;
    (prisma.$transaction as any) = async (cb: any) => cb(mockTx);

    let duplicateError: any = null;
    try {
      await AdminShipmentService.createShipment({
        orderId: "ord-test-3",
        provider: "manual",
        trackingNumber: "MAN-SECOND-ATTEMPT",
      });
    } catch (err: any) {
      duplicateError = err;
    }

    assert.ok(duplicateError, "Must reject duplicate active shipment");
    assert.strictEqual(duplicateError.code, "ACTIVE_SHIPMENT_EXISTS");
  });

  await t.test("5. Idempotency Key: Supplying existing idempotencyKey returns existing shipment safely", async () => {
    const existingShipment = {
      id: "ship-idemp-100",
      idempotencyKey: "unique-key-12345",
      provider: "manual",
      trackingNumber: "MAN-IDEMP-001",
      status: ShipmentStatus.SHIPPED,
    };

    (prisma.shipment.findUnique as any) = async (args: any) => {
      if (args.where.idempotencyKey === "unique-key-12345") {
        return existingShipment;
      }
      return null;
    };

    const result = await AdminShipmentService.createShipment({
      orderId: "any-order-id",
      provider: "manual",
      idempotencyKey: "unique-key-12345",
    });

    assert.strictEqual(result.id, "ship-idemp-100");
    assert.strictEqual(result.trackingNumber, "MAN-IDEMP-001");
  });

  await t.test("6. Order State Validation: Rejects cancelled orders", async () => {
    const cancelledOrder = {
      id: "ord-cancelled",
      orderNumber: "1004",
      status: "Cancelled",
      items: [{ id: "oi-4", quantity: 1, price: 100 }],
      shipments: [],
    };

    const mockTx: any = {
      order: {
        update: async () => cancelledOrder,
        findUnique: async () => cancelledOrder,
      },
    };

    (prisma.shipment.findUnique as any) = async () => null;
    (prisma.$transaction as any) = async (cb: any) => cb(mockTx);

    let cancelError: any = null;
    try {
      await AdminShipmentService.createShipment({
        orderId: "ord-cancelled",
        provider: "manual",
      });
    } catch (err: any) {
      cancelError = err;
    }

    assert.ok(cancelError);
    assert.strictEqual(cancelError.code, "ORDER_CANCELLED");
  });

  await t.test("7. Order State Validation: Rejects delivered orders", async () => {
    const deliveredOrder = {
      id: "ord-delivered",
      orderNumber: "1005",
      status: "delivered",
      items: [{ id: "oi-5", quantity: 1, price: 100 }],
      shipments: [],
    };

    const mockTx: any = {
      order: {
        update: async () => deliveredOrder,
        findUnique: async () => deliveredOrder,
      },
    };

    (prisma.shipment.findUnique as any) = async () => null;
    (prisma.$transaction as any) = async (cb: any) => cb(mockTx);

    let deliveredError: any = null;
    try {
      await AdminShipmentService.createShipment({
        orderId: "ord-delivered",
        provider: "manual",
      });
    } catch (err: any) {
      deliveredError = err;
    }

    assert.ok(deliveredError);
    assert.strictEqual(deliveredError.code, "ORDER_ALREADY_DELIVERED");
  });

  await t.test("8. Items Validation: Rejects if requested item quantity exceeds remaining to ship", async () => {
    const orderWithItems = {
      id: "ord-exceed",
      orderNumber: "1006",
      status: "Pending",
      items: [{ id: "oi-6", productName: "Cap", quantity: 2, price: 100 }],
      shipments: [],
    };

    const mockTx: any = {
      order: {
        update: async () => orderWithItems,
        findUnique: async () => orderWithItems,
      },
    };

    (prisma.shipment.findUnique as any) = async () => null;
    (prisma.$transaction as any) = async (cb: any) => cb(mockTx);

    let exceedError: any = null;
    try {
      await AdminShipmentService.createShipment({
        orderId: "ord-exceed",
        provider: "manual",
        items: [{ orderItemId: "oi-6", quantity: 5 }],
      });
    } catch (err: any) {
      exceedError = err;
    }

    assert.ok(exceedError);
    assert.strictEqual(exceedError.code, "EXCEEDS_ORDERED_QUANTITY");
  });
});
