import test from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import { PathaoDeliveryService } from "../integrations/pathao/pathao-delivery.service";
import { PathaoLocationService } from "../integrations/pathao/pathao.service";
import { prisma } from "../config/db";
import { pathaoClient } from "../integrations/pathao/pathao.client";
import { ShipmentStatus } from "@prisma/client";
import pathaoRouter from "../routes/pathao.routes";

test("Pathao Admin Shipment Management Tests (STEP 20F)", async (t) => {
  const originalFindUniqueOrder = prisma.order.findUnique;
  const originalFindFirstOrder = prisma.order.findFirst;
  const originalFindUniqueShipment = prisma.shipment.findUnique;
  const originalFindFirstShipment = prisma.shipment.findFirst;
  const originalCountShipment = prisma.shipment.count;
  const originalCreateShipment = prisma.shipment.create;
  const originalUpdateShipment = prisma.shipment.update;
  const originalUpdateOrder = prisma.order.update;
  const originalGetHttp = pathaoClient.getHttp;

  t.afterEach(() => {
    prisma.order.findUnique = originalFindUniqueOrder;
    prisma.order.findFirst = originalFindFirstOrder;
    prisma.shipment.findUnique = originalFindUniqueShipment;
    prisma.shipment.findFirst = originalFindFirstShipment;
    prisma.shipment.count = originalCountShipment;
    prisma.shipment.create = originalCreateShipment;
    prisma.shipment.update = originalUpdateShipment;
    prisma.order.update = originalUpdateOrder;
    pathaoClient.getHttp = originalGetHttp;
    PathaoLocationService.clearCache();
  });

  // 1. UI Loading (Locations & Stores)
  await t.test("1. UI Loading - successfully loads cities, zones, areas, and stores for Admin UI", async () => {
    (pathaoClient.getHttp as any) = () => ({
      get: async (url: string) => {
        if (url.includes("/city-list")) {
          return { data: { type: "success", code: 200, data: { data: [{ city_id: 1, city_name: "Dhaka" }] } } };
        }
        if (url.includes("/zone-list")) {
          return { data: { type: "success", code: 200, data: { data: [{ zone_id: 10, zone_name: "Mirpur" }] } } };
        }
        if (url.includes("/area-list")) {
          return {
            data: {
              type: "success",
              code: 200,
              data: {
                data: [{ area_id: 100, area_name: "Section 10", home_delivery_available: true, pickup_available: true }],
              },
            },
          };
        }
        if (url.includes("/stores")) {
          return {
            data: {
              type: "success",
              code: 200,
              data: {
                data: [{ store_id: 5, store_name: "Dhaka Hub", store_address: "Road 1", city_id: 1, zone_id: 10, area_id: 100 }],
              },
            },
          };
        }
        throw new Error("Unhandled endpoint");
      },
    });

    const cities = await PathaoLocationService.getCities();
    assert.strictEqual(cities.length, 1);
    assert.strictEqual(cities[0].city_name, "Dhaka");

    const zones = await PathaoLocationService.getZones(1);
    assert.strictEqual(zones.length, 1);
    assert.strictEqual(zones[0].zone_name, "Mirpur");

    const areas = await PathaoLocationService.getAreas(10);
    assert.strictEqual(areas.length, 1);
    assert.strictEqual(areas[0].area_name, "Section 10");

    const stores = await PathaoLocationService.getStores();
    assert.strictEqual(stores.length, 1);
    assert.strictEqual(stores[0].store_name, "Dhaka Hub");
  });

  // 2. Successful Shipment Creation
  await t.test("2. Successful shipment creation - generates consignment and updates tracking metadata", async () => {
    (prisma.order.findUnique as any) = async () => ({
      id: "order-step20f-1",
      orderNumber: "ORD-2001",
      status: "Pending",
      paymentStatus: "Unpaid",
      totalAmount: 2200,
      customer: { firstName: "Karim", lastName: "Chowdhury", phone: "01812345678" },
      items: [{ id: "item-1", quantity: 1, warehouseId: "wh-1" }],
    });
    (prisma.shipment.findFirst as any) = async () => null;
    (prisma.shipment.count as any) = async () => 0;
    (prisma.shipment.create as any) = async (args: any) => ({
      id: "ship-step20f-1",
      ...args.data,
    });
    let updatedShipment: any = null;
    (prisma.shipment.update as any) = async (args: any) => {
      updatedShipment = { id: "ship-step20f-1", ...args.data };
      return updatedShipment;
    };
    (prisma.order.update as any) = async (args: any) => args.data;

    (pathaoClient.getHttp as any) = () => ({
      post: async (_url: string, payload: any) => {
        assert.strictEqual(payload.recipient_phone, "01812345678");
        assert.strictEqual(payload.recipient_name, "Karim Chowdhury");
        assert.strictEqual(payload.amount_to_collect, 2200);
        return {
          data: {
            data: {
              consignment_id: "CONS-20F-777",
              order_status: "Pending",
              delivery_fee: 70,
            },
          },
        };
      },
    });

    const shipment = await PathaoDeliveryService.createDelivery("order-step20f-1", {
      store_id: 5,
      recipient_city: 1,
      recipient_zone: 10,
      recipient_area: 100,
      recipient_address: "House 5, Road 2, Mirpur 10",
    });

    assert.strictEqual(shipment.consignmentId, "CONS-20F-777");
    assert.strictEqual(shipment.status, ShipmentStatus.PROCESSING);
    assert.strictEqual(shipment.deliveryFee, 70);
    assert.strictEqual(shipment.providerStatus, "Pending");
    assert.strictEqual(shipment.trackingUrl, "https://merchant.pathao.com/tracking?consignment_id=CONS-20F-777");
  });

  // 3. Duplicate Prevention (Idempotency)
  await t.test("3. Duplicate prevention - prevents creating duplicate shipment for same order", async () => {
    (prisma.order.findUnique as any) = async () => ({
      id: "order-step20f-1",
      orderNumber: "ORD-2001",
      status: "Processing",
      customer: { firstName: "Karim", lastName: "Chowdhury", phone: "01812345678" },
      items: [{ id: "item-1", quantity: 1 }],
    });

    const existingActiveShipment = {
      id: "ship-step20f-1",
      orderId: "order-step20f-1",
      consignmentId: "CONS-20F-777",
      provider: "pathao",
      status: ShipmentStatus.PROCESSING,
      providerStatus: "Pending",
    };

    (prisma.shipment.findFirst as any) = async () => existingActiveShipment;

    let externalApiCalled = false;
    (pathaoClient.getHttp as any) = () => ({
      post: async () => {
        externalApiCalled = true;
        return { data: { data: {} } };
      },
    });

    const result = await PathaoDeliveryService.createDelivery("order-step20f-1", {
      store_id: 5,
      recipient_city: 1,
      recipient_zone: 10,
      recipient_area: 100,
      recipient_address: "House 5, Road 2, Mirpur 10",
    });

    assert.strictEqual(externalApiCalled, false, "External Pathao API must NOT be called for duplicate dispatch");
    assert.strictEqual(result.id, existingActiveShipment.id);
    assert.strictEqual(result.consignmentId, "CONS-20F-777");
  });

  // 4. Error Handling
  await t.test("4. Error handling - rejects invalid recipient phone or missing address", async () => {
    (prisma.order.findUnique as any) = async () => ({
      id: "order-bad-phone",
      orderNumber: "ORD-BAD",
      status: "Pending",
      customer: { firstName: "Bad", lastName: "Phone", phone: "123" },
      items: [{ id: "item-1", quantity: 1 }],
    });
    (prisma.shipment.findFirst as any) = async () => null;

    try {
      await PathaoDeliveryService.createDelivery("order-bad-phone", {
        store_id: 5,
        recipient_city: 1,
        recipient_zone: 10,
        recipient_area: 100,
        recipient_address: "Dhaka",
        recipient_phone: "invalid_phone",
      });
      assert.fail("Should have thrown validation error for phone");
    } catch (err: any) {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, "INVALID_PHONE");
    }
  });

  // 5. Status Refresh
  await t.test("5. Status refresh - queries Pathao order info and updates DB shipment record", async () => {
    const existingShipment = {
      id: "ship-to-refresh",
      orderId: "ord-1",
      provider: "pathao",
      consignmentId: "CONS-20F-777",
      status: ShipmentStatus.PROCESSING,
      providerStatus: "Pending",
      lastSyncAt: new Date(Date.now() - 3600000),
    };

    (prisma.shipment.findUnique as any) = async () => existingShipment;

    let updateArgs: any = null;
    (prisma.shipment.update as any) = async (args: any) => {
      updateArgs = args.data;
      return { ...existingShipment, ...args.data };
    };

    (pathaoClient.getHttp as any) = () => ({
      get: async (url: string) => {
        assert.ok(url.includes("/CONS-20F-777/info"));
        return {
          data: {
            data: {
              order_status: "Delivered",
            },
          },
        };
      },
    });

    const refreshed = await PathaoDeliveryService.refreshStatus("ship-to-refresh");

    assert.strictEqual(refreshed.providerStatus, "Delivered");
    assert.strictEqual(refreshed.status, ShipmentStatus.DELIVERED);
    assert.ok(refreshed.deliveredAt);
    assert.ok(updateArgs.lastSyncAt);
  });

  // 6. Cancellation Eligibility
  await t.test("6. Cancellation - cancels pending shipment and blocks cancellation of delivered shipment", async () => {
    // 6a: Valid cancellation of pending shipment
    const pendingShipment = {
      id: "ship-pending",
      provider: "pathao",
      consignmentId: "CONS-CANCEL-1",
      status: ShipmentStatus.PROCESSING,
      providerStatus: "Pending",
    };
    (prisma.shipment.findUnique as any) = async () => pendingShipment;
    (prisma.shipment.update as any) = async (args: any) => ({ ...pendingShipment, ...args.data });

    let pathaoCancelCalled = false;
    (pathaoClient.getHttp as any) = () => ({
      post: async (url: string) => {
        if (url.includes("/CONS-CANCEL-1/cancel")) {
          pathaoCancelCalled = true;
          return { data: { success: true } };
        }
        return { data: {} };
      },
    });

    const cancelled = await PathaoDeliveryService.cancelDelivery("ship-pending", "Admin test cancellation");
    assert.strictEqual(cancelled.status, ShipmentStatus.CANCELLED);
    assert.strictEqual(cancelled.providerStatus, "Cancelled");
    assert.strictEqual(pathaoCancelCalled, true);

    // 6b: Block cancellation of delivered shipment
    const deliveredShipment = {
      id: "ship-delivered",
      provider: "pathao",
      consignmentId: "CONS-DELIVERED",
      status: ShipmentStatus.DELIVERED,
      providerStatus: "Delivered",
    };
    (prisma.shipment.findUnique as any) = async () => deliveredShipment;

    try {
      await PathaoDeliveryService.cancelDelivery("ship-delivered");
      assert.fail("Should have rejected cancellation of delivered shipment");
    } catch (err: any) {
      assert.strictEqual(err.statusCode, 400);
      assert.strictEqual(err.code, "CANNOT_CANCEL_DELIVERED");
    }
  });

  // 7. Unauthorized Admin Access & RBAC Protection
  await t.test("7. Unauthorized Admin Access - enforces authentication and RBAC permissions", async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/v1/pathao", pathaoRouter);

    // Request without auth header should fail with 401 Unauthorized
    const resNoAuth = await request(app).get("/api/v1/pathao/cities");
    assert.strictEqual(resNoAuth.status, 401);

    const resShipNoAuth = await request(app)
      .post("/api/v1/pathao/orders/ord-1/ship")
      .send({ store_id: 1, recipient_city: 1, recipient_zone: 1, recipient_area: 1, recipient_address: "Dhaka" });
    assert.strictEqual(resShipNoAuth.status, 401);

    const resRefreshNoAuth = await request(app).post("/api/v1/pathao/shipments/ship-1/refresh");
    assert.strictEqual(resRefreshNoAuth.status, 401);

    const resCancelNoAuth = await request(app).post("/api/v1/pathao/shipments/ship-1/cancel");
    assert.strictEqual(resCancelNoAuth.status, 401);
  });
});
