import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { ShipmentStatus } from "@prisma/client";

export class StorefrontShipmentService {
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
      },
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

  static async getOrderShipments(customerId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId },
      select: { id: true, orderNumber: true, status: true },
    });

    if (!order) {
      throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
    }

    const shipments = await prisma.shipment.findMany({
      where: { orderId },
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

  static async getOrderTracking(customerId: string, orderId: string) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: {
        shipments: {
          include: {
            courier: { select: { name: true, trackingUrl: true } },
            trackingEvents: { orderBy: { timestamp: "desc" } },
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

    const latestShipment = order.shipments[0];
    const trackingUrl =
      latestShipment?.courier?.trackingUrl && latestShipment.trackingNumber
        ? `${latestShipment.courier.trackingUrl}${latestShipment.trackingNumber}`
        : latestShipment?.courier?.trackingUrl || null;

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      shipmentStatus: latestShipment?.status || order.status,
      carrier: latestShipment?.courier?.name || null,
      trackingNumber: latestShipment?.trackingNumber || null,
      trackingUrl,
      shippedAt: latestShipment?.shippedAt || null,
      estimatedDelivery: null,
      deliveredAt: latestShipment?.deliveredAt || null,
      shipments: order.shipments.map((s) => ({
        id: s.id,
        status: s.status,
        carrier: s.courier?.name || null,
        courierName: s.courier?.name || null,
        trackingNumber: s.trackingNumber,
        trackingUrl:
          s.courier?.trackingUrl && s.trackingNumber
            ? `${s.courier.trackingUrl}${s.trackingNumber}`
            : s.courier?.trackingUrl || null,
        shippedAt: s.shippedAt,
        deliveredAt: s.deliveredAt,
        trackingEvents: s.trackingEvents.map((e) => ({
          id: e.id,
          status: e.status,
          location: e.location,
          description: e.description,
          timestamp: e.timestamp,
        })),
      })),
      orderTimeline: order.timeline,
    };
  }

  private static mapShipmentDTO(s: any) {
    const carrier = s.courier?.name || null;
    const trackingUrl =
      s.courier?.trackingUrl && s.trackingNumber
        ? `${s.courier.trackingUrl}${s.trackingNumber}`
        : s.courier?.trackingUrl || null;

    return {
      id: s.id,
      shipmentId: s.id,
      orderId: s.orderId,
      orderNumber: s.order?.orderNumber || null,
      status: s.status,
      carrier,
      courierName: carrier,
      trackingNumber: s.trackingNumber || null,
      trackingUrl,
      shippedAt: s.shippedAt || null,
      estimatedDelivery: null,
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
