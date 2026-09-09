import test from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import { PathaoStatusSyncService } from "../integrations/pathao/pathao-sync.service";
import { PathaoConfig } from "../integrations/pathao/pathao.config";
import { pathaoClient } from "../integrations/pathao/pathao.client";
import { prisma } from "../config/db";
import { ShipmentStatus, TrackingStatus } from "@prisma/client";
import { errorHandler } from "../middlewares/errorHandler";
import pathaoRouter from "../routes/pathao.routes";

test("Pathao Status Synchronization & Webhook Tests (STEP 20G)", async (t) => {
  const originalFindUniqueShipment = prisma.shipment.findUnique;
  const originalFindFirstShipment = prisma.shipment.findFirst;
  const originalFindManyShipment = prisma.shipment.findMany;
  const originalUpdateShipment = prisma.shipment.update;
  const originalCreateTracking = prisma.trackingEvent.create;
  const originalUpdateOrder = prisma.order.update;
  const originalTransaction = prisma.$transaction;
  const originalGetHttp = pathaoClient.getHttp;
  const originalWebhookSecret = PathaoConfig.webhookSecret;

  t.afterEach(() => {
    prisma.shipment.findUnique = originalFindUniqueShipment;
    prisma.shipment.findFirst = originalFindFirstShipment;
    prisma.shipment.findMany = originalFindManyShipment;
    prisma.shipment.update = originalUpdateShipment;
    prisma.trackingEvent.create = originalCreateTracking;
    prisma.order.update = originalUpdateOrder;
    prisma.$transaction = originalTransaction;
    pathaoClient.getHttp = originalGetHttp;
    PathaoConfig.webhookSecret = originalWebhookSecret;
  });

  const app = express();
  app.use(express.json());
  app.use("/api/v1/pathao", pathaoRouter);
  app.use(errorHandler);

  await t.test("1. Webhook Signature Verification - blocks unauthorized calls", async () => {
    PathaoConfig.webhookSecret = "secret-key-xyz-987";

    // Request without signature header
    const resNoSig = await request(app)
      .post("/api/v1/pathao/webhook")
      .send({
        consignment_id: "CS-12345",
        order_status: "Delivered",
      });

    assert.strictEqual(resNoSig.status, 401);
    assert.strictEqual(resNoSig.body.success, false);
    assert.strictEqual(resNoSig.body.error.code, "UNAUTHORIZED_WEBHOOK");
    // Ensure no secret leakage in error response
    assert.strictEqual(JSON.stringify(resNoSig.body).includes("secret-key-xyz-987"), false);

    // Request with invalid signature
    const resBadSig = await request(app)
      .post("/api/v1/pathao/webhook")
      .set("X-PATHAO-Signature", "wrong-signature")
      .send({
        consignment_id: "CS-12345",
        order_status: "Delivered",
      });

    assert.strictEqual(resBadSig.status, 401);
    assert.strictEqual(resBadSig.body.success, false);
    assert.strictEqual(resBadSig.body.error.code, "UNAUTHORIZED_WEBHOOK");
  });

  await t.test("2. Webhook Signature Verification - accepts valid signature and sets acknowledgement header", async () => {
    const testSecret = "my-pathao-webhook-secret-456";
    PathaoConfig.webhookSecret = testSecret;

    const mockShipment = {
      id: "shipment-uuid-1",
      orderId: "order-uuid-1",
      provider: "pathao",
      consignmentId: "CS-VALID-999",
      merchantOrderId: "ORD-100-1",
      status: ShipmentStatus.PROCESSING,
      providerStatus: "Pending",
      order: {
        id: "order-uuid-1",
        status: "Processing",
      },
    };

    let trackingEventCreated = false;
    let orderUpdated = false;

    (prisma.shipment.findFirst as any) = async () => mockShipment;
    (prisma.shipment.findUnique as any) = async () => mockShipment;
    (prisma.$transaction as any) = async (ops: any[]) => {
      trackingEventCreated = true;
      orderUpdated = true;
      return [
        {
          ...mockShipment,
          status: ShipmentStatus.SHIPPED,
          providerStatus: "Picked",
          shippedAt: new Date(),
        },
      ];
    };

    const res = await request(app)
      .post("/api/v1/pathao/webhook")
      .set("X-PATHAO-Signature", testSecret)
      .send({
        consignment_id: "CS-VALID-999",
        order_status: "Picked",
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "success");
    // Verifies Pathao acknowledgement header requirement
    assert.strictEqual(
      res.headers["x-pathao-merchant-webhook-integration-secret"],
      testSecret
    );
    assert.strictEqual(trackingEventCreated, true);
    assert.strictEqual(orderUpdated, true);
  });

  await t.test("3. Webhook Payload Validation - requires identifier and status", async () => {
    PathaoConfig.webhookSecret = ""; // Open for testing payload validation

    // Missing both consignment_id and merchant_order_id
    const resNoId = await request(app)
      .post("/api/v1/pathao/webhook")
      .send({
        order_status: "In_Transit",
      });

    assert.strictEqual(resNoId.status, 400);
    assert.strictEqual(resNoId.body.success, false);
    assert.strictEqual(resNoId.body.error.code, "MISSING_IDENTIFIER");

    // Missing status
    const resNoStatus = await request(app)
      .post("/api/v1/pathao/webhook")
      .send({
        consignment_id: "CS-12345",
      });

    assert.strictEqual(resNoStatus.status, 400);
    assert.strictEqual(resNoStatus.body.success, false);
    assert.strictEqual(resNoStatus.body.error.code, "MISSING_STATUS");
  });

  await t.test("4. Idempotency & Duplicate Event Handling - prevents duplicate updates and events", async () => {
    PathaoConfig.webhookSecret = "";

    const deliveredShipment = {
      id: "shipment-uuid-delivered",
      orderId: "order-uuid-delivered",
      provider: "pathao",
      consignmentId: "CS-ALREADY-DELIVERED",
      status: ShipmentStatus.DELIVERED,
      providerStatus: "Delivered",
      order: {
        id: "order-uuid-delivered",
        status: "Delivered",
      },
    };

    let transactionCalled = false;
    (prisma.shipment.findFirst as any) = async () => deliveredShipment;
    (prisma.shipment.findUnique as any) = async () => deliveredShipment;
    (prisma.shipment.update as any) = async ({ data }: any) => {
      return { ...deliveredShipment, lastSyncAt: data.lastSyncAt };
    };
    (prisma.$transaction as any) = async () => {
      transactionCalled = true;
      return [];
    };

    // Send duplicate Delivered status event
    const res = await request(app)
      .post("/api/v1/pathao/webhook")
      .send({
        consignment_id: "CS-ALREADY-DELIVERED",
        order_status: "Delivered",
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "success");
    assert.strictEqual(res.body.data.duplicate, true);
    // Crucial check: atomic transaction was NOT executed, preventing duplicate TrackingEvents and Order updates
    assert.strictEqual(transactionCalled, false);
  });

  await t.test("5. Polling Engine - filters out completed/cancelled and handles transient errors gracefully", async () => {
    let queriedFilter: any = null;

    (prisma.shipment.findMany as any) = async ({ where }: any) => {
      queriedFilter = where;
      return [
        {
          id: "shipment-active-1",
          orderId: "order-active-1",
          provider: "pathao",
          consignmentId: "CS-ACTIVE-1",
          status: ShipmentStatus.PROCESSING,
          providerStatus: "Pending",
          order: { id: "order-active-1", status: "Processing" },
        },
        {
          id: "shipment-active-2",
          orderId: "order-active-2",
          provider: "pathao",
          consignmentId: "CS-ACTIVE-2",
          status: ShipmentStatus.IN_TRANSIT,
          providerStatus: "In_Transit",
          order: { id: "order-active-2", status: "Shipped" },
        },
      ];
    };

    (prisma.shipment.findUnique as any) = async ({ where }: any) => {
      if (where.id === "shipment-active-1") {
        return {
          id: "shipment-active-1",
          orderId: "order-active-1",
          provider: "pathao",
          consignmentId: "CS-ACTIVE-1",
          status: ShipmentStatus.PROCESSING,
          providerStatus: "Pending",
          order: { id: "order-active-1", status: "Processing" },
        };
      }
      return {
        id: "shipment-active-2",
        orderId: "order-active-2",
        provider: "pathao",
        consignmentId: "CS-ACTIVE-2",
        status: ShipmentStatus.IN_TRANSIT,
        providerStatus: "In_Transit",
        order: { id: "order-active-2", status: "Shipped" },
      };
    };

    (prisma.$transaction as any) = async (ops: any[]) => {
      return [{ id: "shipment-active-1", status: ShipmentStatus.SHIPPED }];
    };

    (prisma.shipment.update as any) = async () => ({});

    // Mock Pathao HTTP: first consignment succeeds with Delivered, second throws network timeout
    (pathaoClient.getHttp as any) = () => ({
      get: async (url: string) => {
        if (url.includes("CS-ACTIVE-1")) {
          return {
            data: {
              data: {
                order_status: "Delivered",
                hub_name: "Dhaka Central",
              },
            },
          };
        }
        throw new Error("ETIMEDOUT: Connection to Pathao gateway timed out");
      },
    });

    const stats = await PathaoStatusSyncService.syncActiveShipments(10);

    // Verify polling query avoided completed / cancelled / returned shipments
    assert.ok(queriedFilter);
    assert.strictEqual(queriedFilter.provider, "pathao");
    assert.deepStrictEqual(queriedFilter.status.notIn, [
      ShipmentStatus.DELIVERED,
      ShipmentStatus.CANCELLED,
      ShipmentStatus.RETURNED,
    ]);

    // Verify error isolation: 2 shipments processed, 1 successfully updated, 1 transient error captured without crashing
    assert.strictEqual(stats.processed, 2);
    assert.strictEqual(stats.updated, 1);
    assert.strictEqual(stats.errors, 1);
  });
});
