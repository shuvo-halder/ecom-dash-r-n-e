import test from "node:test";
import assert from "node:assert";
import { ShipmentStatus, TrackingStatus } from "@prisma/client";
import {
  mapPathaoStatus,
  resolveNextOrderStatus,
} from "../integrations/pathao/pathao-status-mapper";

test("Pathao Status Mapper Unit Tests (STEP 20G)", async (t) => {
  await t.test("1. Map Pathao Created / Pending statuses", () => {
    const statuses = [
      "ORDER_CREATED",
      "Pending",
      "PENDING",
      "Pickup_Requested",
      "ORDER_PICKUP_REQUESTED",
      "Assigned_For_Pickup",
      "ORDER_ASSIGNED_FOR_PICKUP",
    ];

    for (const status of statuses) {
      const result = mapPathaoStatus(status);
      assert.strictEqual(
        result.internalShipmentStatus,
        ShipmentStatus.PROCESSING,
        `Failed for status: ${status}`
      );
      assert.strictEqual(result.trackingEventStatus, TrackingStatus.INFO_RECEIVED);
      assert.strictEqual(result.suggestedOrderStatus, "Processing");
      assert.strictEqual(result.isTerminal, false);
      assert.ok(result.description.length > 0);
    }
  });

  await t.test("2. Map Pathao Picked / In-Transit statuses", () => {
    // Picked
    const pickedResult = mapPathaoStatus("ORDER_PICKED");
    assert.strictEqual(pickedResult.internalShipmentStatus, ShipmentStatus.SHIPPED);
    assert.strictEqual(pickedResult.trackingEventStatus, TrackingStatus.IN_TRANSIT);
    assert.strictEqual(pickedResult.suggestedOrderStatus, "Shipped");
    assert.strictEqual(pickedResult.isTerminal, false);

    const pickedRaw = mapPathaoStatus("Picked");
    assert.strictEqual(pickedRaw.internalShipmentStatus, ShipmentStatus.SHIPPED);

    // In Transit
    const transitStatuses = ["ORDER_IN_TRANSIT", "In_Transit", "Hub_Transfer", "Received_At_Hub"];
    for (const status of transitStatuses) {
      const res = mapPathaoStatus(status);
      assert.strictEqual(res.internalShipmentStatus, ShipmentStatus.IN_TRANSIT, `Failed for: ${status}`);
      assert.strictEqual(res.trackingEventStatus, TrackingStatus.IN_TRANSIT);
      assert.strictEqual(res.suggestedOrderStatus, "Shipped");
      assert.strictEqual(res.isTerminal, false);
    }

    // Out For Delivery
    const outForDelivery = mapPathaoStatus("ORDER_OUT_FOR_DELIVERY");
    assert.strictEqual(outForDelivery.internalShipmentStatus, ShipmentStatus.OUT_FOR_DELIVERY);
    assert.strictEqual(outForDelivery.trackingEventStatus, TrackingStatus.OUT_FOR_DELIVERY);
    assert.strictEqual(outForDelivery.suggestedOrderStatus, "Shipped");
  });

  await t.test("3. Map Pathao Delivered and Paid statuses", () => {
    const deliveredStatuses = [
      "ORDER_DELIVERED",
      "Delivered",
      "ORDER_PARTIAL_DELIVERY",
      "Partial_Delivery",
      "Payment_Invoiced",
      "Paid",
    ];

    for (const status of deliveredStatuses) {
      const result = mapPathaoStatus(status);
      assert.strictEqual(
        result.internalShipmentStatus,
        ShipmentStatus.DELIVERED,
        `Failed for status: ${status}`
      );
      assert.strictEqual(result.trackingEventStatus, TrackingStatus.DELIVERED);
      assert.strictEqual(result.suggestedOrderStatus, "Delivered");
      assert.strictEqual(result.isTerminal, true);
    }
  });

  await t.test("4. Map Pathao Delivery Failure & Exceptions", () => {
    const failureStatuses = [
      "ORDER_DELIVERY_FAILED",
      "Delivery_Failed",
      "Failed_Delivery",
      "On_Hold",
      "Delivery_Postponed",
    ];

    for (const status of failureStatuses) {
      const result = mapPathaoStatus(status);
      assert.strictEqual(
        result.internalShipmentStatus,
        ShipmentStatus.FAILED_DELIVERY,
        `Failed for status: ${status}`
      );
      assert.strictEqual(result.trackingEventStatus, TrackingStatus.EXCEPTION);
      // Delivery failure should NOT automatically cancel or change the order status
      assert.strictEqual(result.suggestedOrderStatus, undefined);
      assert.strictEqual(result.isTerminal, false);
    }
  });

  await t.test("5. Map Pathao Returns", () => {
    const returnStatuses = [
      "ORDER_RETURN_INITIATED",
      "Return_Initiated",
      "ORDER_RETURN_IN_TRANSIT",
      "Return_In_Transit",
      "ORDER_RETURNED_TO_MERCHANT",
      "Returned_To_Merchant",
      "Return",
      "Returned",
    ];

    for (const status of returnStatuses) {
      const result = mapPathaoStatus(status);
      assert.strictEqual(
        result.internalShipmentStatus,
        ShipmentStatus.RETURNED,
        `Failed for status: ${status}`
      );
      assert.strictEqual(result.trackingEventStatus, TrackingStatus.EXCEPTION);
      // Returns require administrative review; do NOT automatically mutate order or trigger refunds
      assert.strictEqual(result.suggestedOrderStatus, undefined);
      assert.strictEqual(result.isTerminal, true);
    }
  });

  await t.test("6. Map Pathao Cancellation", () => {
    const cancelStatuses = ["ORDER_CANCELLED", "Cancelled", "Canceled", "ORDER_CANCELED"];

    for (const status of cancelStatuses) {
      const result = mapPathaoStatus(status);
      assert.strictEqual(
        result.internalShipmentStatus,
        ShipmentStatus.CANCELLED,
        `Failed for status: ${status}`
      );
      assert.strictEqual(result.trackingEventStatus, TrackingStatus.EXCEPTION);
      // Shipment is cancelled, but order stays intact for potential re-dispatch
      assert.strictEqual(result.suggestedOrderStatus, undefined);
      assert.strictEqual(result.isTerminal, true);
    }
  });

  await t.test("7. Order Lifecycle Transitions - valid forward progression", () => {
    // From Pending
    assert.strictEqual(resolveNextOrderStatus("Pending", "Processing"), "Processing");
    assert.strictEqual(resolveNextOrderStatus("Pending", "Shipped"), "Shipped");
    assert.strictEqual(resolveNextOrderStatus("Pending", "Delivered"), "Delivered");

    // From Processing
    assert.strictEqual(resolveNextOrderStatus("Processing", "Shipped"), "Shipped");
    assert.strictEqual(resolveNextOrderStatus("Processing", "Delivered"), "Delivered");
    assert.strictEqual(resolveNextOrderStatus("Processing", "Processing"), null);

    // From Shipped
    assert.strictEqual(resolveNextOrderStatus("Shipped", "Delivered"), "Delivered");
    assert.strictEqual(resolveNextOrderStatus("Shipped", "Shipped"), null);
  });

  await t.test("8. Order Lifecycle Protection - blocks regressions & terminal mutation", () => {
    // Cannot regress from Shipped to Processing
    assert.strictEqual(resolveNextOrderStatus("Shipped", "Processing"), null);

    // Cannot regress or mutate Delivered order
    assert.strictEqual(resolveNextOrderStatus("Delivered", "Shipped"), null);
    assert.strictEqual(resolveNextOrderStatus("Delivered", "Processing"), null);
    assert.strictEqual(resolveNextOrderStatus("Delivered", "Delivered"), null);

    // Cannot mutate Cancelled order
    assert.strictEqual(resolveNextOrderStatus("Cancelled", "Processing"), null);
    assert.strictEqual(resolveNextOrderStatus("Cancelled", "Shipped"), null);
    assert.strictEqual(resolveNextOrderStatus("Cancelled", "Delivered"), null);

    // Cannot mutate Refunded order
    assert.strictEqual(resolveNextOrderStatus("Refunded", "Processing"), null);
    assert.strictEqual(resolveNextOrderStatus("Refunded", "Shipped"), null);
    assert.strictEqual(resolveNextOrderStatus("Refunded", "Delivered"), null);

    // Undefined suggestion returns null
    assert.strictEqual(resolveNextOrderStatus("Processing", undefined), null);
  });
});
