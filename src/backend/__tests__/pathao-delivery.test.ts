import test from "node:test";
import assert from "node:assert";
import { PathaoDeliveryService } from "../integrations/pathao/pathao-delivery.service";
import { prisma } from "../config/db";
import { pathaoClient } from "../integrations/pathao/pathao.client";
import { ShipmentStatus } from "@prisma/client";

test("Pathao Delivery Creation Tests", async (t) => {
  // Store originals
  const originalFindUnique = prisma.order.findUnique;
  const originalFindFirst = prisma.shipment.findFirst;
  const originalCount = prisma.shipment.count;
  const originalCreate = prisma.shipment.create;
  const originalUpdateShipment = prisma.shipment.update;
  const originalUpdateOrder = prisma.order.update;
  const originalGetHttp = pathaoClient.getHttp;

  t.afterEach(() => {
    prisma.order.findUnique = originalFindUnique;
    prisma.shipment.findFirst = originalFindFirst;
    prisma.shipment.count = originalCount;
    prisma.shipment.create = originalCreate;
    prisma.shipment.update = originalUpdateShipment;
    prisma.order.update = originalUpdateOrder;
    pathaoClient.getHttp = originalGetHttp;
  });

  await t.test("1. Successful delivery creation", async () => {
    (prisma.order.findUnique as any) = async () => ({
      id: "ord-1",
      orderNumber: "1001",
      status: "Pending",
      paymentStatus: "Unpaid",
      totalAmount: 1500,
      customer: { firstName: "Rahim", lastName: "Ahmed", phone: "+8801711223344" },
      items: [{ id: "item-1", quantity: 2, warehouseId: "wh-1" }],
    });
    (prisma.shipment.findFirst as any) = async () => null;
    (prisma.shipment.count as any) = async () => 0;
    (prisma.shipment.create as any) = async (args: any) => ({
      id: "ship-1",
      ...args.data,
    });
    let updatedShipmentPayload: any = null;
    (prisma.shipment.update as any) = async (args: any) => {
      updatedShipmentPayload = args.data;
      return { id: "ship-1", ...args.data };
    };
    let updatedOrderPayload: any = null;
    (prisma.order.update as any) = async (args: any) => {
      updatedOrderPayload = args.data;
      return args.data;
    };

    (pathaoClient.getHttp as any) = () => ({
      post: async (_url: string, payload: any) => {
        assert.strictEqual(payload.store_id, 101);
        assert.strictEqual(payload.recipient_name, "Rahim Ahmed");
        assert.strictEqual(payload.recipient_phone, "01711223344");
        assert.strictEqual(payload.amount_to_collect, 1500);
        return {
          data: {
            data: {
              consignment_id: "CONS-PATHAO-999",
              order_status: "Pending",
              delivery_fee: 60,
            },
          },
        };
      },
    });

    const res = await PathaoDeliveryService.createDelivery("ord-1", {
      store_id: 101,
      recipient_city: 1,
      recipient_zone: 2,
      recipient_area: 3,
      recipient_address: "House 12, Road 5, Dhanmondi, Dhaka",
    });

    assert.strictEqual(res.consignmentId, "CONS-PATHAO-999");
    assert.strictEqual(res.status, ShipmentStatus.PROCESSING);
    assert.strictEqual(res.trackingNumber, "CONS-PATHAO-999");
    assert.strictEqual(res.deliveryFee, 60);
    assert.strictEqual(updatedShipmentPayload.providerStatus, "Pending");
    assert.strictEqual(updatedOrderPayload.status, "Processing");
  });

  await t.test("2. Duplicate request (Idempotency - returns existing shipment)", async () => {
    (prisma.order.findUnique as any) = async () => ({
      id: "ord-1",
      orderNumber: "1001",
      status: "Processing",
      items: [{ id: "item-1", quantity: 1 }],
      customer: { firstName: "Rahim", lastName: "Ahmed", phone: "01711223344" },
    });

    const existingShipment = {
      id: "existing-ship-1",
      orderId: "ord-1",
      provider: "pathao",
      consignmentId: "CONS-EXISTING-123",
      status: ShipmentStatus.PROCESSING,
    };
    (prisma.shipment.findFirst as any) = async () => existingShipment;

    const res = await PathaoDeliveryService.createDelivery("ord-1", {
      store_id: 101,
      recipient_city: 1,
      recipient_zone: 2,
      recipient_area: 3,
      recipient_address: "Dhanmondi, Dhaka",
    });

    assert.strictEqual(res.id, "existing-ship-1");
    assert.strictEqual(res.consignmentId, "CONS-EXISTING-123");
  });

  await t.test("3. Duplicate consignment prevention (re-dispatch block)", async () => {
    let postCallCount = 0;

    (prisma.order.findUnique as any) = async () => ({
      id: "ord-1",
      orderNumber: "1001",
      status: "Processing",
      items: [{ id: "item-1", quantity: 1 }],
      customer: { firstName: "Test", lastName: "User", phone: "01711223344" },
    });

    (prisma.shipment.findFirst as any) = async () => ({
      id: "active-consignment",
      consignmentId: "CONS-ALREADY-CREATED",
      status: ShipmentStatus.PROCESSING,
    });

    (pathaoClient.getHttp as any) = () => ({
      post: async () => {
        postCallCount++;
        return {};
      },
    });

    const res = await PathaoDeliveryService.createDelivery("ord-1", {
      store_id: 101,
      recipient_city: 1,
      recipient_zone: 2,
      recipient_area: 3,
      recipient_address: "Gulshan-2, Dhaka",
    });

    assert.strictEqual(res.consignmentId, "CONS-ALREADY-CREATED");
    assert.strictEqual(postCallCount, 0, "External Pathao API must NOT be called for duplicate consignment");
  });

  await t.test("4. Invalid address validation", async () => {
    (prisma.order.findUnique as any) = async () => ({
      id: "ord-1",
      status: "Pending",
      items: [{ id: "item-1", quantity: 1 }],
      customer: { firstName: "John", lastName: "Doe", phone: "01711223344" },
    });
    (prisma.shipment.findFirst as any) = async () => null;

    // Test empty address
    try {
      await PathaoDeliveryService.createDelivery("ord-1", {
        store_id: 101,
        recipient_city: 1,
        recipient_zone: 2,
        recipient_area: 3,
        recipient_address: "   ",
      });
      assert.fail("Should have failed on empty address");
    } catch (err: any) {
      assert.strictEqual(err.code, "INVALID_ADDRESS");
    }

    // Test invalid city/zone/area IDs
    try {
      await PathaoDeliveryService.createDelivery("ord-1", {
        store_id: 101,
        recipient_city: -1,
        recipient_zone: 2,
        recipient_area: 3,
        recipient_address: "Valid Street Address 123",
      });
      assert.fail("Should have failed on negative city");
    } catch (err: any) {
      assert.strictEqual(err.code, "INVALID_LOCATION_MAPPING");
    }
  });

  await t.test("5. Invalid phone validation", async () => {
    (prisma.order.findUnique as any) = async () => ({
      id: "ord-1",
      status: "Pending",
      items: [{ id: "item-1", quantity: 1 }],
      customer: { firstName: "John", lastName: "Doe", phone: "0123456789" }, // Non-standard BD operator prefix
    });
    (prisma.shipment.findFirst as any) = async () => null;

    try {
      await PathaoDeliveryService.createDelivery("ord-1", {
        store_id: 101,
        recipient_city: 1,
        recipient_zone: 2,
        recipient_area: 3,
        recipient_address: "Valid Street Address 123",
      });
      assert.fail("Should have rejected invalid phone format");
    } catch (err: any) {
      assert.strictEqual(err.code, "INVALID_PHONE");
    }

    // Test missing phone entirely
    (prisma.order.findUnique as any) = async () => ({
      id: "ord-1",
      status: "Pending",
      items: [{ id: "item-1", quantity: 1 }],
      customer: { firstName: "John", lastName: "Doe", phone: "" },
    });

    try {
      await PathaoDeliveryService.createDelivery("ord-1", {
        store_id: 101,
        recipient_city: 1,
        recipient_zone: 2,
        recipient_area: 3,
        recipient_address: "Valid Street Address 123",
      });
      assert.fail("Should have rejected empty phone");
    } catch (err: any) {
      assert.strictEqual(err.code, "INVALID_PHONE");
    }
  });

  await t.test("6. Insufficient order data validation", async () => {
    (prisma.shipment.findFirst as any) = async () => null;

    // Non-existent order
    (prisma.order.findUnique as any) = async () => null;
    try {
      await PathaoDeliveryService.createDelivery("missing-ord", {
        store_id: 101,
        recipient_city: 1,
        recipient_zone: 2,
        recipient_area: 3,
        recipient_address: "Dhanmondi",
      });
      assert.fail("Should have rejected non-existent order");
    } catch (err: any) {
      assert.strictEqual(err.code, "ORDER_NOT_FOUND");
    }

    // Order with zero items
    (prisma.order.findUnique as any) = async () => ({
      id: "ord-empty",
      status: "Pending",
      items: [],
      customer: { firstName: "John", lastName: "Doe", phone: "01711223344" },
    });
    try {
      await PathaoDeliveryService.createDelivery("ord-empty", {
        store_id: 101,
        recipient_city: 1,
        recipient_zone: 2,
        recipient_area: 3,
        recipient_address: "Valid Street Address 123",
      });
      assert.fail("Should have rejected order with no items");
    } catch (err: any) {
      assert.strictEqual(err.code, "INSUFFICIENT_ORDER_DATA");
    }

    // Order with cancelled status
    (prisma.order.findUnique as any) = async () => ({
      id: "ord-cancelled",
      status: "Cancelled",
      items: [{ id: "item-1", quantity: 1 }],
      customer: { firstName: "John", lastName: "Doe", phone: "01711223344" },
    });
    try {
      await PathaoDeliveryService.createDelivery("ord-cancelled", {
        store_id: 101,
        recipient_city: 1,
        recipient_zone: 2,
        recipient_area: 3,
        recipient_address: "Valid Street Address 123",
      });
      assert.fail("Should have rejected cancelled order");
    } catch (err: any) {
      assert.strictEqual(err.code, "ORDER_NOT_ELIGIBLE");
    }
  });

  await t.test("7. Pathao timeout handling and retry exhaustion", async () => {
    (prisma.order.findUnique as any) = async () => ({
      id: "ord-timeout",
      orderNumber: "TIMEOUT-101",
      status: "Pending",
      paymentStatus: "Unpaid",
      totalAmount: 500,
      customer: { firstName: "User", lastName: "Test", phone: "01811223344" },
      items: [{ id: "item-1", quantity: 1 }],
    });
    (prisma.shipment.findFirst as any) = async () => null;
    (prisma.shipment.count as any) = async () => 0;
    (prisma.shipment.create as any) = async (args: any) => ({
      id: "ship-timeout",
      ...args.data,
    });

    let updatedStatus = "";
    (prisma.shipment.update as any) = async (args: any) => {
      updatedStatus = args.data.status;
      return { id: "ship-timeout", ...args.data };
    };

    let attempts = 0;
    (pathaoClient.getHttp as any) = () => ({
      post: async () => {
        attempts++;
        const err: any = new Error("timeout of 10000ms exceeded");
        err.code = "ECONNABORTED";
        throw err;
      },
    });

    try {
      await PathaoDeliveryService.createDelivery("ord-timeout", {
        store_id: 101,
        recipient_city: 1,
        recipient_zone: 2,
        recipient_area: 3,
        recipient_address: "Road 1, Banani, Dhaka",
        maxRetries: 2,
        retryDelayMs: 5,
      });
      assert.fail("Should have thrown timeout error");
    } catch (err: any) {
      assert.strictEqual(err.code, "PATHAO_TIMEOUT");
      assert.strictEqual(attempts, 3, "Should have attempted 1 initial + 2 retries");
      assert.strictEqual(updatedStatus, ShipmentStatus.FAILED_DELIVERY);
    }
  });

  await t.test("8. Pathao authentication failure (no endless retries, safe failure state)", async () => {
    (prisma.order.findUnique as any) = async () => ({
      id: "ord-auth",
      orderNumber: "AUTH-101",
      status: "Pending",
      paymentStatus: "Unpaid",
      totalAmount: 500,
      customer: { firstName: "User", lastName: "Test", phone: "01811223344" },
      items: [{ id: "item-1", quantity: 1 }],
    });
    (prisma.shipment.findFirst as any) = async () => null;
    (prisma.shipment.count as any) = async () => 0;
    (prisma.shipment.create as any) = async (args: any) => ({
      id: "ship-auth",
      ...args.data,
    });

    let updatedStatus = "";
    (prisma.shipment.update as any) = async (args: any) => {
      updatedStatus = args.data.status;
      return { id: "ship-auth", ...args.data };
    };

    let attempts = 0;
    (pathaoClient.getHttp as any) = () => ({
      post: async () => {
        attempts++;
        const err: any = new Error("Unauthorized");
        err.response = { status: 401, data: { message: "Invalid or expired credentials" } };
        throw err;
      },
    });

    try {
      await PathaoDeliveryService.createDelivery("ord-auth", {
        store_id: 101,
        recipient_city: 1,
        recipient_zone: 2,
        recipient_area: 3,
        recipient_address: "Road 1, Banani, Dhaka",
        maxRetries: 2,
        retryDelayMs: 5,
      });
      assert.fail("Should have thrown auth error");
    } catch (err: any) {
      assert.strictEqual(err.code, "PATHAO_AUTH_ERROR");
      assert.strictEqual(attempts, 1, "Auth failures must NOT be retried");
      assert.strictEqual(updatedStatus, ShipmentStatus.FAILED_DELIVERY);
    }
  });

  await t.test("9. Pathao validation failure (400 / 422, no retries, customer-safe error)", async () => {
    (prisma.order.findUnique as any) = async () => ({
      id: "ord-val",
      orderNumber: "VAL-101",
      status: "Pending",
      paymentStatus: "Unpaid",
      totalAmount: 500,
      customer: { firstName: "User", lastName: "Test", phone: "01811223344" },
      items: [{ id: "item-1", quantity: 1 }],
    });
    (prisma.shipment.findFirst as any) = async () => null;
    (prisma.shipment.count as any) = async () => 0;
    (prisma.shipment.create as any) = async (args: any) => ({
      id: "ship-val",
      ...args.data,
    });

    let updatedStatus = "";
    (prisma.shipment.update as any) = async (args: any) => {
      updatedStatus = args.data.status;
      return { id: "ship-val", ...args.data };
    };

    let attempts = 0;
    (pathaoClient.getHttp as any) = () => ({
      post: async () => {
        attempts++;
        const err: any = new Error("Unprocessable Entity");
        err.response = {
          status: 422,
          data: { message: "Selected area does not support home delivery" },
        };
        throw err;
      },
    });

    try {
      await PathaoDeliveryService.createDelivery("ord-val", {
        store_id: 101,
        recipient_city: 1,
        recipient_zone: 2,
        recipient_area: 3,
        recipient_address: "Road 1, Banani, Dhaka",
        maxRetries: 2,
        retryDelayMs: 5,
      });
      assert.fail("Should have thrown validation error");
    } catch (err: any) {
      assert.strictEqual(err.code, "PATHAO_VALIDATION_ERROR");
      assert.strictEqual(err.message, "Selected area does not support home delivery");
      assert.strictEqual(attempts, 1, "Validation failures must NOT be retried");
      assert.strictEqual(updatedStatus, ShipmentStatus.FAILED_DELIVERY);
    }
  });

  await t.test("10. Transient failure recovers on retry", async () => {
    (prisma.order.findUnique as any) = async () => ({
      id: "ord-transient",
      orderNumber: "TRANS-101",
      status: "Pending",
      paymentStatus: "Unpaid",
      totalAmount: 500,
      customer: { firstName: "User", lastName: "Test", phone: "01811223344" },
      items: [{ id: "item-1", quantity: 1 }],
    });
    (prisma.shipment.findFirst as any) = async () => null;
    (prisma.shipment.count as any) = async () => 0;
    (prisma.shipment.create as any) = async (args: any) => ({
      id: "ship-transient",
      ...args.data,
    });
    (prisma.shipment.update as any) = async (args: any) => ({
      id: "ship-transient",
      ...args.data,
    });
    (prisma.order.update as any) = async () => {};

    let attempts = 0;
    (pathaoClient.getHttp as any) = () => ({
      post: async () => {
        attempts++;
        if (attempts === 1) {
          const err: any = new Error("Bad Gateway");
          err.response = { status: 502, data: { message: "Temporary upstream issue" } };
          throw err;
        }
        return {
          data: {
            data: {
              consignment_id: "CONS-RECOVERED-123",
              order_status: "Pending",
              delivery_fee: 60,
            },
          },
        };
      },
    });

    const res = await PathaoDeliveryService.createDelivery("ord-transient", {
      store_id: 101,
      recipient_city: 1,
      recipient_zone: 2,
      recipient_area: 3,
      recipient_address: "Road 1, Banani, Dhaka",
      maxRetries: 2,
      retryDelayMs: 5,
    });

    assert.strictEqual(res.consignmentId, "CONS-RECOVERED-123");
    assert.strictEqual(attempts, 2, "Should succeed on second attempt");
  });

  await t.test("11. COD compatibility rules (Paid order rejection of COD > 0)", async () => {
    (prisma.order.findUnique as any) = async () => ({
      id: "ord-paid",
      status: "Pending",
      paymentStatus: "Paid",
      totalAmount: 1000,
      customer: { firstName: "Paid", lastName: "Customer", phone: "01711223344" },
      items: [{ id: "item-1", quantity: 1 }],
    });
    (prisma.shipment.findFirst as any) = async () => null;

    try {
      await PathaoDeliveryService.createDelivery("ord-paid", {
        store_id: 101,
        recipient_city: 1,
        recipient_zone: 2,
        recipient_area: 3,
        recipient_address: "Dhanmondi, Dhaka",
        cod_amount: 500, // Invalid: cannot collect COD on paid order
      });
      assert.fail("Should have rejected COD amount > 0 for Paid order");
    } catch (err: any) {
      assert.strictEqual(err.code, "INVALID_COD_AMOUNT");
    }
  });
});
