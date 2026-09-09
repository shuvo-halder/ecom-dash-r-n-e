import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { ShipmentStatus } from "@prisma/client";

export interface NormalizedCourierInfo {
  provider: string;
  providerName: string;
  trackingUrl: string | null;
}

/**
 * Safely resolves and normalizes courier provider info without exposing internal details.
 */
export function resolveCourierProviderInfo(shipment: any): NormalizedCourierInfo {
  if (!shipment) {
    return {
      provider: "UNKNOWN",
      providerName: "Unknown Carrier",
      trackingUrl: null,
    };
  }

  const rawProvider = (shipment.provider || "").toUpperCase().trim();
  const courierName = shipment.courier?.name;
  const trackingNumber = shipment.trackingNumber || shipment.consignmentId || null;

  let provider = "MANUAL";
  let providerName = courierName || "Manual / In-House Courier";
  let trackingUrl = shipment.trackingUrl || null;

  if (rawProvider === "PATHAO" || courierName?.toLowerCase().includes("pathao")) {
    provider = "PATHAO";
    providerName = "Pathao Courier";
    if (!trackingUrl && trackingNumber) {
      trackingUrl = `https://merchant.pathao.com/tracking?consignment_id=${trackingNumber}`;
    }
  } else if (rawProvider === "MANUAL") {
    provider = "MANUAL";
    providerName = courierName || "Manual / In-House Courier";
  } else if (courierName) {
    provider = rawProvider || "COURIER";
    providerName = courierName;
    if (!trackingUrl && shipment.courier?.trackingUrl && trackingNumber) {
      trackingUrl = `${shipment.courier.trackingUrl}${trackingNumber}`;
    }
  } else if (rawProvider) {
    provider = rawProvider;
    providerName = `${rawProvider.charAt(0).toUpperCase()}${rawProvider.slice(1).toLowerCase()} Courier`;
  }

  return {
    provider,
    providerName,
    trackingUrl: trackingUrl || null,
  };
}

export class StorefrontShipmentService {
  /**
   * Retrieves paginated shipments for an authenticated customer.
   */
  static async getCustomerShipments(
    customerId: string,
    options: { page?: number; limit?: number; status?: string } = {}
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {
      order: {
        customerId,
        deletedAt: null,
      },
      deletedAt: null,
    };

    if (options.status && options.status !== "ALL") {
      where.status = options.status as ShipmentStatus;
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        include: {
          order: { select: { id: true, orderNumber: true, status: true } },
          courier: { select: { id: true, name: true, trackingUrl: true } },
          trackingEvents: { orderBy: { timestamp: "desc" } },
          items: {
            include: {
              warehouse: { select: { id: true, name: true } },
              orderItem: {
                include: {
                  product: {
                    select: {
                      id: true,
                      name: true,
                      images: { select: { url: true, isPrimary: true } },
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.shipment.count({ where }),
    ]);

    const mappedShipments = shipments.map((s) => this.mapShipmentDTO(s));

    return {
      shipments: mappedShipments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves all shipments for a specific order belonging to the customer (IDOR protected).
   */
  static async getOrderShipments(customerId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId, deletedAt: null },
      select: { id: true, orderNumber: true, status: true },
    });

    if (!order) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    const shipments = await prisma.shipment.findMany({
      where: { orderId, deletedAt: null },
      include: {
        order: { select: { id: true, orderNumber: true, status: true } },
        courier: { select: { id: true, name: true, trackingUrl: true } },
        trackingEvents: { orderBy: { timestamp: "desc" } },
        items: {
          include: {
            warehouse: { select: { id: true, name: true } },
            orderItem: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    images: { select: { url: true, isPrimary: true } },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
      },
      shipments: shipments.map((s) => this.mapShipmentDTO(s)),
    };
  }

  /**
   * Retrieves a specific shipment by ID belonging to the authenticated customer (IDOR protected).
   */
  static async getShipmentById(customerId: string, shipmentId: string) {
    const shipment = await prisma.shipment.findFirst({
      where: {
        id: shipmentId,
        deletedAt: null,
        order: { customerId, deletedAt: null },
      },
      include: {
        order: { select: { id: true, orderNumber: true, status: true } },
        courier: { select: { id: true, name: true, trackingUrl: true } },
        trackingEvents: { orderBy: { timestamp: "desc" } },
        items: {
          include: {
            warehouse: { select: { id: true, name: true } },
            orderItem: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    images: { select: { url: true, isPrimary: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!shipment) {
      throw new AppError("Shipment not found", 404, "SHIPMENT_NOT_FOUND");
    }

    return this.mapShipmentDTO(shipment);
  }

  /**
   * Retrieves normalized order tracking information for an authenticated customer (IDOR protected).
   */
  static async getOrderTracking(customerId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId, deletedAt: null },
      include: {
        shipments: {
          where: { deletedAt: null },
          include: {
            courier: { select: { name: true, trackingUrl: true } },
            trackingEvents: { orderBy: { timestamp: "desc" } },
            items: {
              include: {
                warehouse: { select: { id: true, name: true } },
                orderItem: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        name: true,
                        images: { select: { url: true, isPrimary: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        timeline: {
          orderBy: { createdAt: "asc" },
          select: { id: true, status: true, action: true, createdAt: true },
        },
      },
    });

    if (!order) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    return this.buildOrderTrackingPayload(order);
  }

  /**
   * Retrieves tracking information for guest orders based on order number and matching phone or email.
   * Enforces guest security and IDOR protection.
   */
  static async getGuestOrderTracking(orderNumber: string, phoneOrEmail: string) {
    if (!orderNumber || !phoneOrEmail) {
      throw new AppError("Order number and contact (phone or email) are required", 400, "VALIDATION_ERROR");
    }

    const cleanInput = phoneOrEmail.trim().toLowerCase();

    const order = await prisma.order.findFirst({
      where: {
        OR: [
          { orderNumber: { equals: orderNumber.trim(), mode: "insensitive" } },
          { id: orderNumber.trim() },
        ],
        deletedAt: null,
      },
      include: {
        shipments: {
          where: { deletedAt: null },
          include: {
            courier: { select: { name: true, trackingUrl: true } },
            trackingEvents: { orderBy: { timestamp: "desc" } },
            items: {
              include: {
                warehouse: { select: { id: true, name: true } },
                orderItem: {
                  include: {
                    product: {
                      select: {
                        id: true,
                        name: true,
                        images: { select: { url: true, isPrimary: true } },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        timeline: {
          orderBy: { createdAt: "asc" },
          select: { id: true, status: true, action: true, createdAt: true },
        },
      },
    });

    if (!order) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    // Guest security verification: Ensure phone or email matches the order record
    const emailMatches = Boolean(
      order.customerEmail && order.customerEmail.toLowerCase().trim() === cleanInput
    );

    const shippingStr = (order.shippingAddress || "").toLowerCase();
    const billingStr = (order.billingAddress || "").toLowerCase();
    const normalizedDigits = cleanInput.replace(/\D/g, "");

    const phoneMatches = Boolean(
      normalizedDigits.length >= 7 &&
        (shippingStr.includes(normalizedDigits) || billingStr.includes(normalizedDigits))
    );

    const emailInAddressMatches = Boolean(
      cleanInput.includes("@") &&
        (shippingStr.includes(cleanInput) || billingStr.includes(cleanInput))
    );

    if (!emailMatches && !phoneMatches && !emailInAddressMatches) {
      // IDOR protection: Do not leak whether the order exists with different contact
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    return this.buildOrderTrackingPayload(order);
  }

  /**
   * Helper that builds the canonical Storefront tracking payload.
   */
  public static buildOrderTrackingPayload(order: any) {
    const shipments = order.shipments || [];
    const latestShipment = shipments[0] || null;
    const providerInfo = latestShipment ? resolveCourierProviderInfo(latestShipment) : null;
    const trackingNumber = latestShipment
      ? latestShipment.trackingNumber || latestShipment.consignmentId || null
      : null;

    // Map order status to normalized uppercase status if no shipment exists yet
    const orderStatusStr = String(order.status || "").toUpperCase();
    const fallbackStatus =
      orderStatusStr === "DELIVERED"
        ? "DELIVERED"
        : orderStatusStr === "SHIPPED"
        ? "SHIPPED"
        : orderStatusStr === "PROCESSING"
        ? "PROCESSING"
        : orderStatusStr === "CANCELLED"
        ? "CANCELLED"
        : "PENDING";

    const normalizedStatus = latestShipment ? latestShipment.status : fallbackStatus;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      provider: providerInfo?.provider || null,
      providerName: providerInfo?.providerName || null,
      status: normalizedStatus,
      shipmentStatus: normalizedStatus,
      carrier: providerInfo?.providerName || null,
      courierName: providerInfo?.providerName || null,
      trackingNumber,
      trackingUrl: providerInfo?.trackingUrl || null,
      shippedAt: latestShipment?.shippedAt || null,
      estimatedDelivery: (latestShipment as any)?.estimatedDelivery || null,
      estimatedDeliveryAt: (latestShipment as any)?.estimatedDelivery || null,
      deliveredAt: latestShipment?.deliveredAt || null,
      shipments: shipments.map((s: any) => this.mapShipmentDTO(s)),
      orderTimeline: (order.timeline || []).map((t: any) => ({
        id: t.id,
        status: t.status,
        action: t.action,
        createdAt: t.createdAt,
      })),
    };
  }

  /**
   * Canonical mapper for customer-facing Shipment DTO.
   * Excludes sensitive provider credentials, metadata, and error details.
   */
  public static mapShipmentDTO(s: any) {
    const providerInfo = resolveCourierProviderInfo(s);
    const trackingNumber = s.trackingNumber || s.consignmentId || null;

    return {
      id: s.id,
      shipmentId: s.id,
      orderId: s.orderId,
      orderNumber: s.order?.orderNumber || null,
      provider: providerInfo.provider,
      providerName: providerInfo.providerName,
      status: s.status,
      shipmentStatus: s.status,
      carrier: providerInfo.providerName,
      courierName: providerInfo.providerName,
      trackingNumber,
      trackingUrl: providerInfo.trackingUrl,
      shippedAt: s.shippedAt || null,
      estimatedDelivery: (s as any).estimatedDelivery || null,
      estimatedDeliveryAt: (s as any).estimatedDelivery || null,
      deliveredAt: s.deliveredAt || null,
      createdAt: s.createdAt,
      items: (s.items || []).map((item: any) => {
        const imgs = item.orderItem?.product?.images || [];
        const primaryImg = imgs.find((img: any) => img.isPrimary) || imgs[0];
        return {
          id: item.id,
          orderItemId: item.orderItemId,
          quantity: item.quantity,
          productName: item.orderItem?.product?.name || null,
          productImage: primaryImg?.url || null,
          warehouseName: item.warehouse?.name || null,
        };
      }),
      trackingEvents: (s.trackingEvents || []).map((e: any) => ({
        id: e.id,
        status: e.status,
        location: e.location,
        description: e.description,
        timestamp: e.timestamp,
      })),
    };
  }
}
