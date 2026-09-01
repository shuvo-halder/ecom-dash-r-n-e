import { prisma } from "../config/db";
import { emailService } from "./email.service";
import { AppError } from "../utils/AppError";
import { ShipmentStatus, TrackingStatus, NotificationType, NotificationChannel } from "@prisma/client";

export class AdminShipmentService {
  static async createShipment(orderId: string, courierId: string | undefined, trackingNumber: string | undefined, items: { orderItemId: string, quantity: number }[]) {
    if (!items || items.length === 0) {
      throw new AppError("At least one shipment item is required", 400, "INVALID_ITEMS");
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Lock Order row for transactional consistency
      await tx.order.update({
        where: { id: orderId },
        data: { updatedAt: new Date() },
      });

      // 2. Re-read fresh state with items & shipments under lock
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, shipments: { include: { items: true } } },
      });

      if (!order) {
        throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
      }

      if (order.status === "Cancelled") {
        throw new AppError("Cannot create shipment for cancelled order", 400, "ORDER_CANCELLED");
      }

      // 3. Validate quantities against authoritative order items and existing shipments
      const orderItemMap = new Map(order.items.map(i => [i.id, i]));
      const shippedMap = new Map<string, number>();
      
      for (const shipment of order.shipments) {
        for (const item of shipment.items) {
          shippedMap.set(item.orderItemId, (shippedMap.get(item.orderItemId) || 0) + item.quantity);
        }
      }

      for (const item of items) {
        if (!item.quantity || item.quantity <= 0) {
          throw new AppError("Shipment item quantity must be greater than zero", 400, "INVALID_QUANTITY");
        }

        const orderItem = orderItemMap.get(item.orderItemId);
        if (!orderItem) {
          throw new AppError(`Item ${item.orderItemId} is not part of this order`, 400, "INVALID_ITEM");
        }

        const orderedQty = orderItem.quantity;
        const previouslyShipped = shippedMap.get(item.orderItemId) || 0;
        const remainingToShip = orderedQty - previouslyShipped;

        if (item.quantity > remainingToShip) {
          throw new AppError(
            `Cannot ship ${item.quantity} of item ${item.orderItemId}. Only ${remainingToShip} remaining.`,
            400,
            "EXCEEDS_ORDERED_QUANTITY"
          );
        }

        shippedMap.set(item.orderItemId, previouslyShipped + item.quantity);
      }

      // 4. Create Shipment with ShipmentItems strictly inheriting OrderItem.warehouseId
      const shipment = await tx.shipment.create({
        data: {
          orderId,
          courierId,
          trackingNumber,
          status: ShipmentStatus.PENDING,
          items: {
            create: items.map(i => {
              const orderItem = orderItemMap.get(i.orderItemId)!;
              return {
                orderItemId: i.orderItemId,
                warehouseId: orderItem.warehouseId || null,
                quantity: i.quantity,
              };
            })
          },
          trackingEvents: {
            create: {
              status: TrackingStatus.INFO_RECEIVED,
              description: "Shipment information received"
            }
          }
        },
        include: {
          items: true,
          trackingEvents: true
        }
      });

      if (order.status === "Pending") {
        await tx.order.update({
          where: { id: orderId },
          data: { status: "PROCESSING" }
        });
      }

      await tx.orderTimeline.create({
        data: {
          orderId,
          status: "PROCESSING",
          action: `Shipment created with tracking number ${trackingNumber || 'N/A'}`
        }
      });

      return shipment;
    });
  }

  static async getShipments(options: { page?: number; limit?: number; search?: string; status?: string } = {}) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(50, Math.max(1, options.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = { deletedAt: null };

    if (options.status) {
      where.status = options.status as ShipmentStatus;
    }

    if (options.search) {
      where.OR = [
        { trackingNumber: { contains: options.search } },
        { orderId: { contains: options.search } },
        { courier: { name: { contains: options.search } } }
      ];
    }

    const [shipments, total] = await Promise.all([
      prisma.shipment.findMany({
        where,
        skip,
        take: limit,
        include: {
          order: { include: { customer: true } },
          courier: true,
          items: { include: { orderItem: { include: { product: true } } } },
          trackingEvents: { orderBy: { timestamp: 'desc' } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      prisma.shipment.count({ where })
    ]);

    return {
      shipments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async getShipmentById(id: string) {
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: {
        order: { include: { customer: true } },
        courier: true,
        items: { include: { orderItem: { include: { product: true } } } },
        trackingEvents: { orderBy: { timestamp: 'desc' } }
      }
    });

    if (!shipment) {
      throw new AppError("Shipment not found", 404, "SHIPMENT_NOT_FOUND");
    }

    return shipment;
  }

  static async updateShipmentStatus(
    id: string,
    status: ShipmentStatus,
    location?: string,
    description?: string,
    trackingNumber?: string,
    courierName?: string,
    courierId?: string
  ) {
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: { order: { include: { customer: true } }, courier: true }
    });

    if (!shipment) {
      throw new AppError("Shipment not found", 404, "SHIPMENT_NOT_FOUND");
    }

    const updatedShipmentTransaction = await prisma.$transaction(async (tx) => {
      // 1. Lock and re-verify fresh Order state FIRST before any shipment modifications
      const currentOrder = await tx.order.update({
        where: { id: shipment.orderId },
        data: { updatedAt: new Date() }
      });

      if (!currentOrder || currentOrder.deletedAt) {
        throw new AppError("Order not found", 404, "ORDER_NOT_FOUND");
      }

      if (currentOrder.status === "Cancelled") {
        throw new AppError("Cannot update shipment for a cancelled order", 400, "ORDER_CANCELLED");
      }

      if (currentOrder.status === "Returned") {
        throw new AppError("Cannot update shipment for a returned order", 400, "ORDER_RETURNED");
      }

      let resolvedCourierId = courierId || shipment.courierId;

      if (!resolvedCourierId && courierName) {
        let courierRecord = await tx.courier.findFirst({
          where: { name: { equals: courierName } }
        });
        if (!courierRecord) {
          courierRecord = await tx.courier.create({
            data: { name: courierName }
          });
        }
        resolvedCourierId = courierRecord.id;
      }

      const updatedShipment = await tx.shipment.update({
        where: { id },
        data: {
          status,
          trackingNumber: trackingNumber || shipment.trackingNumber,
          courierId: resolvedCourierId,
          shippedAt: status === "SHIPPED" && !shipment.shippedAt ? new Date() : undefined,
          deliveredAt: status === "DELIVERED" && !shipment.deliveredAt ? new Date() : undefined
        },
        include: { courier: true, order: true }
      });

      let trackingStatus: TrackingStatus = TrackingStatus.INFO_RECEIVED;
      if (status === "SHIPPED" || status === "IN_TRANSIT") trackingStatus = TrackingStatus.IN_TRANSIT;
      if (status === "OUT_FOR_DELIVERY") trackingStatus = TrackingStatus.OUT_FOR_DELIVERY;
      if (status === "DELIVERED") trackingStatus = TrackingStatus.DELIVERED;
      if (status === "FAILED_DELIVERY" || status === "RETURNED") trackingStatus = TrackingStatus.EXCEPTION;

      await tx.trackingEvent.create({
        data: {
          shipmentId: id,
          status: trackingStatus,
          location,
          description: description || `Status updated to ${status}`
        }
      });

      if (status === "DELIVERED") {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: { status: "Delivered" }
        });
        await tx.orderTimeline.create({
          data: { orderId: shipment.orderId, status: "Delivered", action: "Order DELIVERED" }
        });

        if (shipment.order?.customerId) {
          await tx.notification.create({
            data: {
              customerId: shipment.order.customerId,
              orderId: shipment.orderId,
              type: NotificationType.ORDER_DELIVERED,
              channel: NotificationChannel.IN_APP,
              title: "Order Delivered",
              message: `Your order #${shipment.orderId.split("-")[0]} has been delivered.`,
              status: "PENDING"
            }
          });
        }
      } else if (status === "SHIPPED") {
        await tx.order.update({
          where: { id: shipment.orderId },
          data: { status: "Shipped" }
        });
        await tx.orderTimeline.create({
          data: { orderId: shipment.orderId, status: "Shipped", action: "Order SHIPPED" }
        });

        if (shipment.order?.customerId) {
          await tx.notification.create({
            data: {
              customerId: shipment.order.customerId,
              orderId: shipment.orderId,
              type: NotificationType.ORDER_SHIPPED,
              channel: NotificationChannel.IN_APP,
              title: "Order Shipped",
              message: `Your order #${shipment.orderId.split("-")[0]} has been shipped with ${updatedShipment.courier?.name || 'carrier'}. Tracking: ${updatedShipment.trackingNumber || 'N/A'}`,
              status: "PENDING"
            }
          });
        }
      }

      return updatedShipment;
    });

    if (shipment.status !== status) {
      try {
        if (status === "SHIPPED" || status === "DELIVERED") {
          const fullOrder = await prisma.order.findUnique({
            where: { id: shipment.orderId },
            include: { customer: true, items: true }
          });
          
          const orderEmail = fullOrder?.customer?.email || fullOrder?.customerEmail;
          if (fullOrder && orderEmail) {
            const emailRecipient = { email: orderEmail, firstName: fullOrder.customer?.firstName || "Customer" };
            if (status === "SHIPPED") {
              emailService.sendOrderShippedEmail(emailRecipient, updatedShipmentTransaction, fullOrder).catch(() => {});
            } else if (status === "DELIVERED") {
              emailService.sendOrderDeliveredEmail(emailRecipient, updatedShipmentTransaction, fullOrder).catch(() => {});
            }
          }
        }
      } catch (err) {}
    }

    return updatedShipmentTransaction;
    }

  static async deleteShipment(id: string) {
    const shipment = await prisma.shipment.findFirst({
      where: { id, deletedAt: null }
    });
    if (!shipment) {
      throw new AppError("Shipment not found", 404, "SHIPMENT_NOT_FOUND");
    }
    return await prisma.shipment.update({
      where: { id },
      data: { deletedAt: new Date() }
    });
  }
}
