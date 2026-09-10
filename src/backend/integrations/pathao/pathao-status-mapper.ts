import { ShipmentStatus, TrackingStatus } from "@prisma/client";

export interface PathaoStatusMappingResult {
  rawStatus: string;
  internalShipmentStatus: ShipmentStatus;
  trackingEventStatus: TrackingStatus;
  suggestedOrderStatus?: "Processing" | "Shipped" | "Delivered";
  isTerminal: boolean;
  description: string;
}

/**
 * Normalizes input raw status/event strings from Pathao API and Webhooks.
 */
function normalizeStatusKey(rawStatus: string): string {
  if (!rawStatus) return "";
  return rawStatus
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
}

/**
 * Maps Pathao courier status codes and webhook events into internal domain statuses.
 *
 * Pathao Status -> Internal Shipment Status -> Internal Order Status where appropriate.
 * Raw Pathao statuses are preserved only in providerStatus and are NOT used as primary business state.
 */
export function mapPathaoStatus(rawStatusOrEvent: string): PathaoStatusMappingResult {
  const key = normalizeStatusKey(rawStatusOrEvent);

  switch (key) {
    // 1. Created / Pending
    case "ORDER_CREATED":
    case "PENDING":
    case "PICKUP_REQUESTED":
    case "ORDER_PICKUP_REQUESTED":
    case "ASSIGNED_FOR_PICKUP":
    case "ORDER_ASSIGNED_FOR_PICKUP":
      return {
        rawStatus: rawStatusOrEvent,
        internalShipmentStatus: ShipmentStatus.PROCESSING,
        trackingEventStatus: TrackingStatus.INFO_RECEIVED,
        suggestedOrderStatus: "Processing",
        isTerminal: false,
        description: "Shipment registered with Pathao courier; awaiting parcel pickup",
      };

    // 2. Picked / Shipped
    case "ORDER_PICKED":
    case "PICKED":
      return {
        rawStatus: rawStatusOrEvent,
        internalShipmentStatus: ShipmentStatus.SHIPPED,
        trackingEventStatus: TrackingStatus.IN_TRANSIT,
        suggestedOrderStatus: "Shipped",
        isTerminal: false,
        description: "Parcel successfully picked up by Pathao courier from merchant store",
      };

    // 3. In Transit / Hub Transfer
    case "ORDER_IN_TRANSIT":
    case "IN_TRANSIT":
    case "HUB_TRANSFER":
    case "RECEIVED_AT_HUB":
      return {
        rawStatus: rawStatusOrEvent,
        internalShipmentStatus: ShipmentStatus.IN_TRANSIT,
        trackingEventStatus: TrackingStatus.IN_TRANSIT,
        suggestedOrderStatus: "Shipped",
        isTerminal: false,
        description: "Parcel in transit through Pathao logistics network",
      };

    // 4. Out For Delivery
    case "ORDER_OUT_FOR_DELIVERY":
    case "OUT_FOR_DELIVERY":
    case "ASSIGNED_FOR_DELIVERY":
      return {
        rawStatus: rawStatusOrEvent,
        internalShipmentStatus: ShipmentStatus.OUT_FOR_DELIVERY,
        trackingEventStatus: TrackingStatus.OUT_FOR_DELIVERY,
        suggestedOrderStatus: "Shipped",
        isTerminal: false,
        description: "Rider dispatched for final delivery to recipient",
      };

    // 5. Delivered
    case "ORDER_DELIVERED":
    case "DELIVERED":
    case "ORDER_PARTIAL_DELIVERY":
    case "PARTIAL_DELIVERY":
    case "PAYMENT_INVOICED":
    case "PAID":
      return {
        rawStatus: rawStatusOrEvent,
        internalShipmentStatus: ShipmentStatus.DELIVERED,
        trackingEventStatus: TrackingStatus.DELIVERED,
        suggestedOrderStatus: "Delivered",
        isTerminal: true,
        description: "Parcel successfully delivered to recipient",
      };

    // 6. Delivery Failed / Exception
    case "ORDER_DELIVERY_FAILED":
    case "DELIVERY_FAILED":
    case "FAILED_DELIVERY":
    case "ON_HOLD":
    case "DELIVERY_POSTPONED":
      return {
        rawStatus: rawStatusOrEvent,
        internalShipmentStatus: ShipmentStatus.FAILED_DELIVERY,
        trackingEventStatus: TrackingStatus.EXCEPTION,
        suggestedOrderStatus: undefined, // Do not change order status on retryable failure
        isTerminal: false,
        description: "Delivery attempt was unsuccessful; rescheduling may occur",
      };

    // 7. Returns
    case "ORDER_RETURN_INITIATED":
    case "RETURN_INITIATED":
    case "ORDER_RETURN_IN_TRANSIT":
    case "RETURN_IN_TRANSIT":
    case "ORDER_RETURNED_TO_MERCHANT":
    case "RETURNED_TO_MERCHANT":
    case "RETURN":
    case "RETURNED":
      return {
        rawStatus: rawStatusOrEvent,
        internalShipmentStatus: ShipmentStatus.RETURNED,
        trackingEventStatus: TrackingStatus.EXCEPTION,
        suggestedOrderStatus: undefined, // Admin must review returns; avoid uncontrolled order cancellation
        isTerminal: true,
        description: "Parcel is being returned to the merchant",
      };

    // 8. Cancelled
    case "ORDER_CANCELLED":
    case "CANCELLED":
    case "ORDER_CANCELED":
    case "CANCELED":
      return {
        rawStatus: rawStatusOrEvent,
        internalShipmentStatus: ShipmentStatus.CANCELLED,
        trackingEventStatus: TrackingStatus.EXCEPTION,
        suggestedOrderStatus: undefined, // Only cancel shipment, leave order intact for re-dispatch
        isTerminal: true,
        description: "Consignment cancelled in Pathao courier",
      };

    // Default fallback
    default:
      return {
        rawStatus: rawStatusOrEvent,
        internalShipmentStatus: ShipmentStatus.PROCESSING,
        trackingEventStatus: TrackingStatus.INFO_RECEIVED,
        suggestedOrderStatus: undefined,
        isTerminal: false,
        description: `Pathao status updated: ${rawStatusOrEvent}`,
      };
  }
}

/**
 * Resolves the next internal Order status according to the valid order lifecycle.
 *
 * Rules:
 * - Compatible forward transitions:
 *     Pending -> Processing -> Shipped -> Delivered
 * - Terminal states (Delivered, Cancelled, Refunded) MUST NEVER be regressed or modified.
 * - Does not change payment or refund states.
 */
export function resolveNextOrderStatus(
  currentOrderStatus: string,
  suggestedOrderStatus?: "Processing" | "Shipped" | "Delivered"
): string | null {
  if (!suggestedOrderStatus) return null;

  const current = currentOrderStatus.trim();
  if (current.toLowerCase() === suggestedOrderStatus.toLowerCase()) return null;

  // Never overwrite or regress terminal order states
  const terminalStates = ["Delivered", "Cancelled", "Refunded"];
  if (terminalStates.some((s) => s.toLowerCase() === current.toLowerCase())) {
    return null;
  }

  // Allowed transitions based on current order state:
  if (current.toLowerCase() === "pending") {
    return suggestedOrderStatus;
  }

  if (current.toLowerCase() === "processing") {
    if (suggestedOrderStatus === "Shipped" || suggestedOrderStatus === "Delivered") {
      return suggestedOrderStatus;
    }
  }

  if (current.toLowerCase() === "shipped") {
    if (suggestedOrderStatus === "Delivered") {
      return suggestedOrderStatus;
    }
  }

  return null;
}
