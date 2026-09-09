import { prisma } from "../../config/db";
import { pathaoClient } from "./pathao.client";
import { PathaoDeliveryRequest, PathaoDeliveryResponse, PathaoResponse } from "./pathao.types";
import { PathaoStatusSyncService } from "./pathao-sync.service";
import { logger } from "../../config/logger";
import { AppError } from "../../utils/AppError";
import { Shipment, ShipmentStatus } from "@prisma/client";

export interface CreatePathaoDeliveryParams {
  store_id: number;
  recipient_city: number;
  recipient_zone: number;
  recipient_area: number;
  recipient_address: string;
  recipient_name?: string;
  recipient_phone?: string;
  cod_amount?: number;
  item_weight?: number;
  special_instruction?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

export class PathaoDeliveryService {
  /**
   * Generates a stable internal merchant order identifier for idempotency and tracking.
   */
  public static generateMerchantOrderId(orderNumber: string, attempt: number = 1): string {
    return `ORD-${orderNumber}-${attempt}`;
  }

  /**
   * Creates a Pathao delivery consignment from an existing eligible Order.
   */
  public static async createDelivery(
    orderId: string,
    params: CreatePathaoDeliveryParams
  ): Promise<Shipment> {
    // 1. Fetch Order and validate existence
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { customer: true, items: true, shipments: true },
    });

    if (!order) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    // 2. Validate Order eligibility
    if (order.status === "Cancelled" || order.status === "Refunded") {
      throw new AppError(`Cannot create shipment for order in ${order.status} state`, 400, "ORDER_NOT_ELIGIBLE");
    }

    if (!order.items || order.items.length === 0) {
      throw new AppError("Order has no items for delivery", 400, "INSUFFICIENT_ORDER_DATA");
    }

    // 3. Idempotency & Duplicate consignment prevention
    // Check if Pathao consignment already exists for this order
    const existingShipment = await prisma.shipment.findFirst({
      where: {
        orderId,
        provider: "pathao",
        status: { not: ShipmentStatus.CANCELLED },
      },
    });

    if (existingShipment && existingShipment.consignmentId) {
      logger.info(
        `[PathaoDeliveryService] Consignment already exists for order ${orderId}: ${existingShipment.consignmentId}`
      );
      return existingShipment;
    }

    // 4. Validate Recipient Name
    const recipientName = (
      params.recipient_name ||
      (order.customer ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim() : "")
    ).trim();

    if (!recipientName) {
      throw new AppError("Recipient name is required", 400, "INVALID_RECIPIENT_NAME");
    }

    // 5. Validate Recipient Phone
    let recipientPhone = (params.recipient_phone || order.customer?.phone || "").trim();
    if (!recipientPhone) {
      throw new AppError("Recipient phone number is required", 400, "INVALID_PHONE");
    }

    // Normalize BD phone number
    if (recipientPhone.startsWith("+88")) {
      recipientPhone = recipientPhone.slice(3);
    } else if (recipientPhone.startsWith("880")) {
      recipientPhone = recipientPhone.slice(2);
    }
    recipientPhone = recipientPhone.replace(/[\s-]/g, "");

    if (!recipientPhone.match(/^01[3-9]\d{8}$/)) {
      throw new AppError("Invalid recipient phone number format for Pathao", 400, "INVALID_PHONE");
    }

    // 6. Validate Shipping Address
    const recipientAddress = (params.recipient_address || order.shippingAddress || "").trim();
    if (!recipientAddress || recipientAddress.length < 5) {
      throw new AppError("Shipping address is required and must be complete", 400, "INVALID_ADDRESS");
    }

    // 7. Validate Store and Location mapping
    const storeId = Number(params.store_id);
    if (!storeId || storeId <= 0 || isNaN(storeId)) {
      throw new AppError("Valid Pathao store ID is required", 400, "INVALID_STORE");
    }

    const cityId = Number(params.recipient_city);
    const zoneId = Number(params.recipient_zone);
    const areaId = Number(params.recipient_area);

    if (!cityId || cityId <= 0 || !zoneId || zoneId <= 0 || !areaId || areaId <= 0 || isNaN(cityId) || isNaN(zoneId) || isNaN(areaId)) {
      throw new AppError("Pathao city, zone, and area IDs must be valid positive numbers", 400, "INVALID_LOCATION_MAPPING");
    }

    // 8. Validate COD Amount against Order Total & Payment Status
    let amountToCollect = 0;
    const orderTotal = Number(order.totalAmount);

    if (order.paymentStatus === "Paid") {
      if (params.cod_amount !== undefined && Number(params.cod_amount) > 0) {
        throw new AppError("Cannot collect COD on an already paid order", 400, "INVALID_COD_AMOUNT");
      }
      amountToCollect = 0;
    } else {
      if (params.cod_amount !== undefined) {
        const customCod = Number(params.cod_amount);
        if (isNaN(customCod) || customCod < 0) {
          throw new AppError("COD amount cannot be negative", 400, "INVALID_COD_AMOUNT");
        }
        if (customCod > orderTotal) {
          throw new AppError("COD amount cannot exceed order total", 400, "INVALID_COD_AMOUNT");
        }
        amountToCollect = customCod;
      } else {
        amountToCollect = orderTotal;
      }
    }

    // 9. Generate stable internal merchant order identifier & idempotency key
    const attemptCount = await prisma.shipment.count({
      where: { orderId, provider: "pathao" },
    });
    const merchantOrderId = this.generateMerchantOrderId(order.orderNumber, attemptCount + 1);
    const idempotencyKey = `pathao-${order.id}-${merchantOrderId}`;

    // 10. Safely create internal Shipment state (PENDING) prior to external call
    const shipment = await prisma.shipment.create({
      data: {
        orderId,
        provider: "pathao",
        status: ShipmentStatus.PENDING,
        merchantOrderId,
        idempotencyKey,
        providerStoreId: storeId,
        codAmount: amountToCollect,
      },
    });

    // 11. Build Pathao Request Payload
    const totalItemQty = order.items.reduce((acc, item) => acc + (item.quantity || 1), 0);
    const requestPayload: PathaoDeliveryRequest = {
      store_id: storeId,
      merchant_order_id: merchantOrderId,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      recipient_address: recipientAddress,
      recipient_city: cityId,
      recipient_zone: zoneId,
      recipient_area: areaId,
      delivery_type: 48, // Standard delivery
      item_type: 2, // Parcel
      item_quantity: totalItemQty,
      item_weight: params.item_weight ? Number(params.item_weight) : 0.5,
      amount_to_collect: amountToCollect,
      special_instruction: params.special_instruction || "",
      item_description: `Order #${order.orderNumber}`,
    };

    // 12. Call Pathao Delivery API with transient retry handling
    const maxRetries = params.maxRetries !== undefined ? params.maxRetries : 2;
    const retryDelayMs = params.retryDelayMs !== undefined ? params.retryDelayMs : 50;

    let response: any = null;
    let lastError: any = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        response = await pathaoClient.getHttp().post<PathaoResponse<{ data: PathaoDeliveryResponse }>>(
          "/aladdin/api/v1/orders",
          requestPayload
        );
        lastError = null;
        break; // Success!
      } catch (error: any) {
        lastError = error;
        const status = error.response?.status;
        const isTimeout =
          error.code === "ECONNABORTED" ||
          error.code === "ETIMEDOUT" ||
          (error.message && error.message.toLowerCase().includes("timeout"));
        const isTransient = isTimeout || (status !== undefined && (status >= 500 || status === 429));

        // Permanent validation error or auth failure -> DO NOT retry
        if (!isTransient || attempt === maxRetries) {
          break;
        }

        logger.warn(
          `[PathaoDeliveryService] Transient error on attempt ${attempt + 1}/${maxRetries + 1}. Retrying...`,
          { message: error.message, status }
        );

        if (retryDelayMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        }
      }
    }

    // 13. Handle Failure
    if (lastError || !response) {
      const status = lastError?.response?.status;
      const isTimeout =
        lastError?.code === "ECONNABORTED" ||
        lastError?.code === "ETIMEDOUT" ||
        (lastError?.message && lastError.message.toLowerCase().includes("timeout"));
      const isAuthError = status === 401 || (lastError?.message && lastError.message.toLowerCase().includes("auth"));

      const providerErrorDetails = lastError?.response?.data
        ? JSON.stringify(lastError.response.data)
        : lastError?.message || "Unknown Pathao delivery error";

      logger.error("[PathaoDeliveryService] Pathao delivery creation failed", {
        orderId,
        merchantOrderId,
        status,
        providerError: providerErrorDetails,
      });

      // Update shipment record with safe failure state
      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: ShipmentStatus.FAILED_DELIVERY,
          providerError: providerErrorDetails,
          lastSyncAt: new Date(),
        },
      });

      // Customer-safe error response mapping without leaking provider internals
      if (isTimeout) {
        throw new AppError("Pathao delivery service timed out", 504, "PATHAO_TIMEOUT");
      }
      if (isAuthError) {
        throw new AppError("Pathao courier authentication failed", 502, "PATHAO_AUTH_ERROR");
      }
      if (status === 400 || status === 422) {
        const msg = lastError?.response?.data?.message || "Pathao validation failed";
        throw new AppError(msg, 400, "PATHAO_VALIDATION_ERROR");
      }

      throw new AppError("Failed to create Pathao delivery consignment", 502, "PATHAO_ERROR");
    }

    // 14. Handle Success: Extract consignment data
    const responsePayload = response.data?.data;
    const innerData: PathaoDeliveryResponse = (responsePayload as any)?.data || responsePayload;

    if (!innerData || !innerData.consignment_id) {
      const errorMsg = "Pathao API succeeded but response was missing consignment_id";
      logger.error(`[PathaoDeliveryService] ${errorMsg}`, { responseData: response.data });

      await prisma.shipment.update({
        where: { id: shipment.id },
        data: {
          status: ShipmentStatus.FAILED_DELIVERY,
          providerError: errorMsg,
          lastSyncAt: new Date(),
        },
      });

      throw new AppError("Invalid response received from Pathao courier", 502, "PATHAO_INVALID_RESPONSE");
    }

    const consignmentId = innerData.consignment_id;
    const trackingUrl = `https://merchant.pathao.com/tracking?consignment_id=${consignmentId}`;

    const updatedShipment = await prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: ShipmentStatus.PROCESSING,
        consignmentId,
        trackingNumber: consignmentId,
        trackingUrl,
        providerStatus: innerData.order_status || "Pending",
        deliveryFee: innerData.delivery_fee !== undefined ? innerData.delivery_fee : null,
        codAmount: amountToCollect,
        lastSyncAt: new Date(),
        providerMetadata: {
          ...response.data,
          dispatchedAt: new Date().toISOString(),
        },
      },
    });

    // Update order status to Processing if it was Pending
    if (order.status === "Pending") {
      await prisma.order.update({
        where: { id: orderId },
        data: { status: "Processing" },
      });
    }

    logger.info(`[PathaoDeliveryService] Successfully created consignment ${consignmentId} for order ${orderId}`);
    return updatedShipment;
  }

  /**
   * Refreshes consignment status from Pathao and updates the shipment record.
   */
  public static async refreshStatus(shipmentId: string): Promise<Shipment> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new AppError("Shipment not found", 404, "SHIPMENT_NOT_FOUND");
    }

    if (shipment.provider !== "pathao" || !shipment.consignmentId) {
      throw new AppError("Shipment is not an active Pathao consignment", 400, "INVALID_PROVIDER");
    }

    try {
      const response = await pathaoClient.getHttp().get<PathaoResponse<any>>(
        `/aladdin/api/v1/orders/${shipment.consignmentId}/info`
      );

      const info = response.data?.data;
      const orderStatus = info?.order_status || info?.order_status_slug || shipment.providerStatus;

      if (orderStatus) {
        const syncResult = await PathaoStatusSyncService.applyStatusUpdate(shipmentId, orderStatus, {
          source: "manual",
          payload: response.data,
          location: info?.hub_name || undefined,
        });
        return syncResult.shipment;
      }

      return shipment;
    } catch (error: any) {
      logger.warn(`[PathaoDeliveryService] Error refreshing status for ${shipment.consignmentId}`, {
        error: error.response?.data || error.message,
      });

      const updated = await prisma.shipment.update({
        where: { id: shipmentId },
        data: { lastSyncAt: new Date() },
      });
      return updated;
    }
  }

  /**
   * Cancels a Pathao shipment if eligible.
   */
  public static async cancelDelivery(shipmentId: string, reason?: string): Promise<Shipment> {
    const shipment = await prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new AppError("Shipment not found", 404, "SHIPMENT_NOT_FOUND");
    }

    if (shipment.provider !== "pathao") {
      throw new AppError("Shipment is not a Pathao shipment", 400, "INVALID_PROVIDER");
    }

    if (shipment.status === ShipmentStatus.CANCELLED) {
      throw new AppError("Shipment is already cancelled", 400, "ALREADY_CANCELLED");
    }

    if (shipment.status === ShipmentStatus.DELIVERED) {
      throw new AppError("Cannot cancel a delivered shipment", 400, "CANNOT_CANCEL_DELIVERED");
    }

    if (shipment.consignmentId) {
      try {
        await pathaoClient.getHttp().post(`/aladdin/api/v1/orders/${shipment.consignmentId}/cancel`, {
          reason: reason || "Cancelled by admin",
        });
      } catch (err: any) {
        logger.warn(`[PathaoDeliveryService] Pathao remote cancel reported warning`, {
          error: err.response?.data || err.message,
        });
      }
    }

    const updated = await prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        status: ShipmentStatus.CANCELLED,
        providerStatus: "Cancelled",
        lastSyncAt: new Date(),
      },
    });

    return updated;
  }
}

// Export alias for PathaoShipmentService
export const PathaoShipmentService = PathaoDeliveryService;
