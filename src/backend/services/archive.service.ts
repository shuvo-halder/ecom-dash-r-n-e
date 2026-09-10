import { Request } from "express";
import { prisma } from "../config/db";
import { AppError } from "../utils/AppError";
import { AuditService } from "./audit.service";
import { ArchiveListQuery, SupportedArchiveEntityType } from "../validators/archive.validator";

export interface FormattedArchiveItem {
  id: string;
  entityType: SupportedArchiveEntityType;
  displayName: string;
  deletedAt: Date;
  status?: string | null;
  slug?: string | null;
  sku?: string | null;
  counts?: Record<string, number>;
  metadata?: Record<string, any>;
  raw: any;
}

export class ArchiveService {
  /**
   * List archived records for a supported entity type.
   */
  public static async listArchived(
    entityType: SupportedArchiveEntityType,
    query: ArchiveListQuery
  ) {
    const page = Math.max(1, query.page || 1);
    const limit = Math.max(1, Math.min(100, query.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {
      deletedAt: { not: null },
    };

    // Date filtering on deletedAt
    if (query.from || query.to) {
      const dateFilter: any = { not: null };
      if (query.from) {
        dateFilter.gte = new Date(query.from);
      }
      if (query.to) {
        const toDate = new Date(query.to);
        toDate.setHours(23, 59, 59, 999);
        dateFilter.lte = toDate;
      }
      where.deletedAt = dateFilter;
    }

    const search = query.search?.trim();

    let records: any[] = [];
    let total = 0;

    switch (entityType) {
      case "products": {
        if (search) {
          where.AND = [
            {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.product.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              name: true,
              slug: true,
              sku: true,
              status: true,
              isActive: true,
              price: true,
              deletedAt: true,
              createdAt: true,
              category: { select: { id: true, name: true, deletedAt: true } },
              brand: { select: { id: true, name: true, deletedAt: true } },
              _count: {
                select: {
                  variants: true,
                  images: true,
                  orderItems: true,
                  reviews: true,
                },
              },
            },
          }),
          prisma.product.count({ where }),
        ]);
        break;
      }

      case "variants": {
        if (search) {
          where.AND = [
            {
              OR: [
                { sku: { contains: search, mode: "insensitive" } },
                { barcode: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.productVariant.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              productId: true,
              sku: true,
              price: true,
              compareAtPrice: true,
              costPrice: true,
              barcode: true,
              isActive: true,
              deletedAt: true,
              createdAt: true,
              product: { select: { id: true, name: true, deletedAt: true } },
              _count: { select: { orderItems: true } },
            },
          }),
          prisma.productVariant.count({ where }),
        ]);
        break;
      }

      case "product-images": {
        if (search) {
          where.AND = [
            {
              OR: [
                { altText: { contains: search, mode: "insensitive" } },
                { originalFilename: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.productImage.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              productId: true,
              imageUrl: true,
              url: true,
              secureUrl: true,
              altText: true,
              originalFilename: true,
              isPrimary: true,
              sortOrder: true,
              deletedAt: true,
              createdAt: true,
              product: { select: { id: true, name: true, deletedAt: true } },
            },
          }),
          prisma.productImage.count({ where }),
        ]);
        break;
      }

      case "categories": {
        if (search) {
          where.AND = [
            {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.category.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              parentId: true,
              isActive: true,
              deletedAt: true,
              createdAt: true,
              parent: { select: { id: true, name: true, deletedAt: true } },
              _count: { select: { products: true, children: true } },
            },
          }),
          prisma.category.count({ where }),
        ]);
        break;
      }

      case "brands": {
        if (search) {
          where.AND = [
            {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.brand.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              name: true,
              slug: true,
              description: true,
              website: true,
              isActive: true,
              deletedAt: true,
              createdAt: true,
              _count: { select: { products: true } },
            },
          }),
          prisma.brand.count({ where }),
        ]);
        break;
      }

      case "orders": {
        if (search) {
          where.AND = [
            {
              OR: [
                { orderNumber: { contains: search, mode: "insensitive" } },
                { customerEmail: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.order.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              orderNumber: true,
              customerId: true,
              customerEmail: true,
              status: true,
              paymentStatus: true,
              totalAmount: true,
              paymentMethod: true,
              deletedAt: true,
              createdAt: true,
              customer: { select: { id: true, firstName: true, lastName: true, email: true } },
              _count: {
                select: {
                  items: true,
                  shipments: true,
                  payments: true,
                  refunds: true,
                  returnRequests: true,
                },
              },
            },
          }),
          prisma.order.count({ where }),
        ]);
        break;
      }

      case "payments": {
        if (search) {
          where.AND = [
            {
              OR: [
                { transactionReference: { contains: search, mode: "insensitive" } },
                { currency: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.payment.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              orderId: true,
              customerId: true,
              provider: true,
              amount: true,
              currency: true,
              status: true,
              transactionReference: true,
              paidAt: true,
              deletedAt: true,
              createdAt: true,
              order: { select: { id: true, orderNumber: true, deletedAt: true } },
              _count: { select: { transactions: true, refunds: true } },
            },
          }),
          prisma.payment.count({ where }),
        ]);
        break;
      }

      case "refunds": {
        if (search) {
          where.AND = [
            {
              OR: [
                { reason: { contains: search, mode: "insensitive" } },
                { transactionReference: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.refund.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              paymentId: true,
              orderId: true,
              customerId: true,
              amount: true,
              currency: true,
              status: true,
              reason: true,
              transactionReference: true,
              completedAt: true,
              deletedAt: true,
              createdAt: true,
              order: { select: { id: true, orderNumber: true, deletedAt: true } },
              payment: { select: { id: true, provider: true, deletedAt: true } },
            },
          }),
          prisma.refund.count({ where }),
        ]);
        break;
      }

      case "returns": {
        if (search) {
          where.AND = [
            {
              OR: [
                { reason: { contains: search, mode: "insensitive" } },
                { adminNotes: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.returnRequest.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              orderId: true,
              customerId: true,
              status: true,
              reason: true,
              adminNotes: true,
              deletedAt: true,
              createdAt: true,
              order: { select: { id: true, orderNumber: true, deletedAt: true } },
              _count: { select: { items: true } },
            },
          }),
          prisma.returnRequest.count({ where }),
        ]);
        break;
      }

      case "shipments": {
        if (search) {
          where.AND = [
            {
              OR: [
                { trackingNumber: { contains: search, mode: "insensitive" } },
                { consignmentId: { contains: search, mode: "insensitive" } },
                { provider: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.shipment.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              orderId: true,
              trackingNumber: true,
              status: true,
              provider: true,
              consignmentId: true,
              deletedAt: true,
              createdAt: true,
              order: { select: { id: true, orderNumber: true, deletedAt: true } },
              _count: { select: { items: true } },
            },
          }),
          prisma.shipment.count({ where }),
        ]);
        break;
      }

      case "coupons": {
        if (search) {
          where.AND = [{ code: { contains: search, mode: "insensitive" } }];
        }
        [records, total] = await Promise.all([
          prisma.coupon.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              code: true,
              discountType: true,
              discountValue: true,
              validFrom: true,
              validUntil: true,
              isActive: true,
              usedCount: true,
              usageLimit: true,
              deletedAt: true,
              createdAt: true,
              _count: { select: { orders: true } },
            },
          }),
          prisma.coupon.count({ where }),
        ]);
        break;
      }

      case "promotions": {
        if (search) {
          where.AND = [{ name: { contains: search, mode: "insensitive" } }];
        }
        [records, total] = await Promise.all([
          prisma.promotion.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              name: true,
              type: true,
              discountType: true,
              discountValue: true,
              priority: true,
              isActive: true,
              startDate: true,
              endDate: true,
              deletedAt: true,
              createdAt: true,
            },
          }),
          prisma.promotion.count({ where }),
        ]);
        break;
      }

      case "marketing-campaigns": {
        if (search) {
          where.AND = [
            {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { subject: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.marketingCampaign.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              name: true,
              type: true,
              subject: true,
              status: true,
              scheduledAt: true,
              sentAt: true,
              deletedAt: true,
              createdAt: true,
            },
          }),
          prisma.marketingCampaign.count({ where }),
        ]);
        break;
      }

      case "banners": {
        if (search) {
          where.AND = [
            {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { linkUrl: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.banner.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              title: true,
              desktopImage: true,
              linkUrl: true,
              isActive: true,
              priority: true,
              startDate: true,
              endDate: true,
              deletedAt: true,
              createdAt: true,
            },
          }),
          prisma.banner.count({ where }),
        ]);
        break;
      }

      case "popups": {
        if (search) {
          where.AND = [
            {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { headline: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.popup.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              title: true,
              type: true,
              headline: true,
              couponCode: true,
              isActive: true,
              deletedAt: true,
              createdAt: true,
            },
          }),
          prisma.popup.count({ where }),
        ]);
        break;
      }

      case "pages": {
        if (search) {
          where.AND = [
            {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.page.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              pageType: true,
              publishedAt: true,
              deletedAt: true,
              createdAt: true,
              _count: { select: { versions: true } },
            },
          }),
          prisma.page.count({ where }),
        ]);
        break;
      }

      case "landing-pages": {
        if (search) {
          where.AND = [
            {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.landingPage.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
              deletedAt: true,
              createdAt: true,
            },
          }),
          prisma.landingPage.count({ where }),
        ]);
        break;
      }

      case "blog-posts": {
        if (search) {
          where.AND = [
            {
              OR: [
                { title: { contains: search, mode: "insensitive" } },
                { slug: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.blogPost.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              publishedAt: true,
              categoryId: true,
              deletedAt: true,
              createdAt: true,
              category: { select: { id: true, name: true } },
              _count: { select: { tags: true } },
            },
          }),
          prisma.blogPost.count({ where }),
        ]);
        break;
      }

      case "faqs": {
        if (search) {
          where.AND = [
            {
              OR: [
                { question: { contains: search, mode: "insensitive" } },
                { answer: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.fAQ.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              question: true,
              answer: true,
              categoryId: true,
              orderIndex: true,
              isActive: true,
              deletedAt: true,
              createdAt: true,
              category: { select: { id: true, name: true } },
            },
          }),
          prisma.fAQ.count({ where }),
        ]);
        break;
      }

      case "reviews": {
        if (search) {
          where.AND = [
            {
              OR: [
                { customerName: { contains: search, mode: "insensitive" } },
                { headline: { contains: search, mode: "insensitive" } },
                { comment: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.review.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              productId: true,
              customerName: true,
              customerEmail: true,
              rating: true,
              headline: true,
              comment: true,
              status: true,
              isApproved: true,
              deletedAt: true,
              createdAt: true,
              product: { select: { id: true, name: true, deletedAt: true } },
              _count: { select: { images: true } },
            },
          }),
          prisma.review.count({ where }),
        ]);
        break;
      }

      case "users": {
        if (search) {
          where.AND = [
            {
              OR: [
                { email: { contains: search, mode: "insensitive" } },
                { firstName: { contains: search, mode: "insensitive" } },
                { lastName: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              roleId: true,
              isActive: true,
              deletedAt: true,
              createdAt: true,
              role: { select: { id: true, name: true, deletedAt: true } },
              _count: { select: { assignedOrders: true, activityLogs: true } },
            },
          }),
          prisma.user.count({ where }),
        ]);
        break;
      }

      case "roles": {
        if (search) {
          where.AND = [
            {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
              ],
            },
          ];
        }
        [records, total] = await Promise.all([
          prisma.role.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deletedAt: "desc" },
            select: {
              id: true,
              name: true,
              description: true,
              deletedAt: true,
              createdAt: true,
              _count: { select: { users: true, permissions: true } },
            },
          }),
          prisma.role.count({ where }),
        ]);
        break;
      }

      default:
        throw new AppError(`Unsupported archive entity type: ${entityType}`, 400, "INVALID_ENTITY_TYPE");
    }

    const formattedData: FormattedArchiveItem[] = records.map((item) =>
      this.formatArchiveRecord(entityType, item)
    );

    return {
      items: formattedData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Standardizes display attributes across disparate Prisma models.
   */
  private static formatArchiveRecord(
    entityType: SupportedArchiveEntityType,
    item: any
  ): FormattedArchiveItem {
    let displayName = "Archived Record";
    let status = item.status !== undefined ? String(item.status) : null;
    let slug: string | null = item.slug || null;
    let sku: string | null = item.sku || null;
    const counts = item._count || undefined;

    switch (entityType) {
      case "products":
        displayName = item.name || "Product";
        break;
      case "variants":
        displayName = `${item.product?.name || "Product"} (${item.sku})`;
        sku = item.sku;
        status = item.isActive ? "Active" : "Inactive";
        break;
      case "product-images":
        displayName = item.altText || item.originalFilename || "Product Image";
        break;
      case "categories":
        displayName = item.name || "Category";
        status = item.isActive ? "Active" : "Inactive";
        break;
      case "brands":
        displayName = item.name || "Brand";
        status = item.isActive ? "Active" : "Inactive";
        break;
      case "orders":
        displayName = `Order #${item.orderNumber}`;
        break;
      case "payments":
        displayName = item.transactionReference || `Payment (${item.provider})`;
        break;
      case "refunds":
        displayName = item.transactionReference || `Refund for Order #${item.order?.orderNumber || item.orderId}`;
        break;
      case "returns":
        displayName = `Return for Order #${item.order?.orderNumber || item.orderId}`;
        break;
      case "shipments":
        displayName = item.trackingNumber || item.consignmentId || `Shipment (${item.provider || "Manual"})`;
        break;
      case "coupons":
        displayName = item.code;
        sku = item.code;
        status = item.isActive ? "Active" : "Inactive";
        break;
      case "promotions":
        displayName = item.name;
        status = item.isActive ? "Active" : "Inactive";
        break;
      case "marketing-campaigns":
        displayName = item.name;
        break;
      case "banners":
        displayName = item.title;
        status = item.isActive ? "Active" : "Inactive";
        break;
      case "popups":
        displayName = item.title;
        status = item.isActive ? "Active" : "Inactive";
        break;
      case "pages":
        displayName = item.title;
        break;
      case "landing-pages":
        displayName = item.name;
        break;
      case "blog-posts":
        displayName = item.title;
        break;
      case "faqs":
        displayName = item.question;
        status = item.isActive ? "Active" : "Inactive";
        break;
      case "reviews":
        displayName = item.headline || `Review by ${item.customerName || "Customer"}`;
        break;
      case "users":
        displayName = `${item.firstName || ""} ${item.lastName || ""}`.trim() || item.email;
        status = item.isActive ? "Active" : "Inactive";
        break;
      case "roles":
        displayName = item.name;
        break;
    }

    return {
      id: item.id,
      entityType,
      displayName,
      deletedAt: item.deletedAt,
      status,
      slug,
      sku,
      counts,
      raw: item,
    };
  }

  /**
   * Safe entity restoration orchestrator.
   */
  public static async restoreEntity(
    entityType: SupportedArchiveEntityType,
    id: string,
    actorUserId: string | null,
    req?: Request
  ) {
    switch (entityType) {
      case "products":
        return this.restoreProduct(id, actorUserId, req);
      case "variants":
        return this.restoreProductVariant(id, actorUserId, req);
      case "product-images":
        return this.restoreProductImage(id, actorUserId, req);
      case "categories":
        return this.restoreCategory(id, actorUserId, req);
      case "brands":
        return this.restoreBrand(id, actorUserId, req);
      case "orders":
        return this.restoreOrder(id, actorUserId, req);
      case "payments":
        return this.restorePayment(id, actorUserId, req);
      case "refunds":
        return this.restoreRefund(id, actorUserId, req);
      case "returns":
        return this.restoreReturnRequest(id, actorUserId, req);
      case "shipments":
        return this.restoreShipment(id, actorUserId, req);
      case "coupons":
        return this.restoreCoupon(id, actorUserId, req);
      case "promotions":
        return this.restorePromotion(id, actorUserId, req);
      case "marketing-campaigns":
        return this.restoreMarketingCampaign(id, actorUserId, req);
      case "banners":
        return this.restoreBanner(id, actorUserId, req);
      case "popups":
        return this.restorePopup(id, actorUserId, req);
      case "pages":
        return this.restorePage(id, actorUserId, req);
      case "landing-pages":
        return this.restoreLandingPage(id, actorUserId, req);
      case "blog-posts":
        return this.restoreBlogPost(id, actorUserId, req);
      case "faqs":
        return this.restoreFAQ(id, actorUserId, req);
      case "reviews":
        return this.restoreReview(id, actorUserId, req);
      case "users":
        return this.restoreUser(id, actorUserId, req);
      case "roles":
        return this.restoreRole(id, actorUserId, req);
      default:
        throw new AppError(`Unsupported archive entity type: ${entityType}`, 400, "INVALID_ENTITY_TYPE");
    }
  }

  // =========================================================================
  // ENTITY-SPECIFIC RESTORE IMPLEMENTATIONS
  // =========================================================================

  private static async restoreProduct(id: string, actorUserId: string | null, req?: Request) {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        brand: true,
        variants: true,
      },
    });

    if (!product) {
      throw new AppError("Product not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!product.deletedAt) {
      throw new AppError("Product is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    // 1. Verify parent category exists and is not archived
    if (!product.category || product.category.deletedAt !== null) {
      throw new AppError(
        "Cannot restore product because its category is archived or missing. Restore the category first.",
        409,
        "RESTORE_PARENT_ARCHIVED"
      );
    }

    // 2. Verify brand if assigned
    if (product.brandId && product.brand && product.brand.deletedAt !== null) {
      throw new AppError(
        "Cannot restore product because associated brand is archived. Restore the brand first.",
        409,
        "RESTORE_PARENT_ARCHIVED"
      );
    }

    // 3. Check slug collision against active products
    const activeSlug = await prisma.product.findFirst({
      where: {
        slug: product.slug,
        deletedAt: null,
        id: { not: id },
      },
    });
    if (activeSlug) {
      throw new AppError(
        `Cannot restore product. Slug '${product.slug}' is already in use by another active product.`,
        409,
        "RESTORE_SLUG_CONFLICT"
      );
    }

    // 4. Check standalone SKU collision if set
    if (product.sku) {
      const [activeProdSku, activeVarSku] = await Promise.all([
        prisma.product.findFirst({
          where: { sku: product.sku, deletedAt: null, id: { not: id } },
        }),
        prisma.productVariant.findFirst({
          where: { sku: product.sku, deletedAt: null },
        }),
      ]);
      if (activeProdSku || activeVarSku) {
        throw new AppError(
          `Cannot restore product. SKU '${product.sku}' is already in use by an active product or variant.`,
          409,
          "RESTORE_SKU_CONFLICT"
        );
      }
    }

    // 5. Check co-archived variant SKUs against active records
    const coArchivedVariants = product.variants.filter(
      (v) => v.deletedAt && product.deletedAt && Math.abs(v.deletedAt.getTime() - product.deletedAt.getTime()) < 5000
    );

    for (const variant of coArchivedVariants) {
      const [varSkuConflict, prodSkuConflict] = await Promise.all([
        prisma.productVariant.findFirst({
          where: { sku: variant.sku, deletedAt: null, id: { not: variant.id } },
        }),
        prisma.product.findFirst({
          where: { sku: variant.sku, deletedAt: null, id: { not: id } },
        }),
      ]);
      if (varSkuConflict || prodSkuConflict) {
        throw new AppError(
          `Cannot restore product. Child variant SKU '${variant.sku}' is already in use by another active record.`,
          409,
          "RESTORE_SKU_CONFLICT"
        );
      }
    }

    const archiveTime = product.deletedAt;

    // 6. Execute atomic transaction to restore product and co-archived children
    const [restoredProduct] = await prisma.$transaction([
      prisma.product.update({
        where: { id },
        data: {
          deletedAt: null,
          isActive: false, // Restore to inactive/draft operational state
          status: "Draft",
        },
      }),
      // Restore variants that were co-archived with this product
      prisma.productVariant.updateMany({
        where: {
          productId: id,
          deletedAt: {
            gte: new Date(archiveTime.getTime() - 5000),
            lte: new Date(archiveTime.getTime() + 5000),
          },
        },
        data: {
          deletedAt: null,
          isActive: false,
        },
      }),
      // Restore product images that were co-archived with this product
      prisma.productImage.updateMany({
        where: {
          productId: id,
          deletedAt: {
            gte: new Date(archiveTime.getTime() - 5000),
            lte: new Date(archiveTime.getTime() + 5000),
          },
        },
        data: {
          deletedAt: null,
        },
      }),
      // Restore inventory records that were co-archived with this product
      prisma.inventory.updateMany({
        where: {
          productId: id,
          deletedAt: {
            gte: new Date(archiveTime.getTime() - 5000),
            lte: new Date(archiveTime.getTime() + 5000),
          },
        },
        data: {
          deletedAt: null,
        },
      }),
    ]);

    await AuditService.createLog(
      actorUserId,
      "RESTORE_PRODUCT",
      "Product",
      id,
      null,
      {
        identifier: product.name,
        slug: product.slug,
        previousDeletedAt: product.deletedAt,
        restoredStatus: "Draft",
        isActive: false,
        coArchivedVariantsCount: coArchivedVariants.length,
      },
      req
    );

    return restoredProduct;
  }

  private static async restoreCategory(id: string, actorUserId: string | null, req?: Request) {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { parent: true },
    });

    if (!category) {
      throw new AppError("Category not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!category.deletedAt) {
      throw new AppError("Category is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    // Verify parent category if parentId is set
    if (category.parentId) {
      if (!category.parent || category.parent.deletedAt !== null) {
        throw new AppError(
          "Cannot restore category because its parent category is archived or missing. Restore the parent category first.",
          409,
          "RESTORE_PARENT_ARCHIVED"
        );
      }
    }

    // Check slug collision
    const activeSlug = await prisma.category.findFirst({
      where: { slug: category.slug, deletedAt: null, id: { not: id } },
    });
    if (activeSlug) {
      throw new AppError(
        `Cannot restore category. Slug '${category.slug}' is already in use by an active category.`,
        409,
        "RESTORE_SLUG_CONFLICT"
      );
    }

    const restored = await prisma.category.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: true,
      },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_CATEGORY",
      "Category",
      id,
      null,
      {
        identifier: category.name,
        slug: category.slug,
        previousDeletedAt: category.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreBrand(id: string, actorUserId: string | null, req?: Request) {
    const brand = await prisma.brand.findUnique({ where: { id } });

    if (!brand) {
      throw new AppError("Brand not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!brand.deletedAt) {
      throw new AppError("Brand is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    const activeSlug = await prisma.brand.findFirst({
      where: { slug: brand.slug, deletedAt: null, id: { not: id } },
    });
    if (activeSlug) {
      throw new AppError(
        `Cannot restore brand. Slug '${brand.slug}' is already in use by an active brand.`,
        409,
        "RESTORE_SLUG_CONFLICT"
      );
    }

    const restored = await prisma.brand.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: true,
      },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_BRAND",
      "Brand",
      id,
      null,
      {
        identifier: brand.name,
        slug: brand.slug,
        previousDeletedAt: brand.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreProductVariant(id: string, actorUserId: string | null, req?: Request) {
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!variant) {
      throw new AppError("Product variant not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!variant.deletedAt) {
      throw new AppError("Product variant is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    if (!variant.product || variant.product.deletedAt !== null) {
      throw new AppError(
        "Cannot restore variant because its parent product is archived. Restore the product first.",
        409,
        "RESTORE_PARENT_ARCHIVED"
      );
    }

    const [activeVarSku, activeProdSku] = await Promise.all([
      prisma.productVariant.findFirst({
        where: { sku: variant.sku, deletedAt: null, id: { not: id } },
      }),
      prisma.product.findFirst({
        where: { sku: variant.sku, deletedAt: null },
      }),
    ]);
    if (activeVarSku || activeProdSku) {
      throw new AppError(
        `Cannot restore variant. SKU '${variant.sku}' is already in use by an active variant or product.`,
        409,
        "RESTORE_SKU_CONFLICT"
      );
    }

    const archiveTime = variant.deletedAt;

    const [restored] = await prisma.$transaction([
      prisma.productVariant.update({
        where: { id },
        data: {
          deletedAt: null,
          isActive: false,
        },
      }),
      prisma.inventory.updateMany({
        where: {
          variantId: id,
          deletedAt: {
            gte: new Date(archiveTime.getTime() - 5000),
            lte: new Date(archiveTime.getTime() + 5000),
          },
        },
        data: { deletedAt: null },
      }),
    ]);

    await AuditService.createLog(
      actorUserId,
      "RESTORE_PRODUCT_VARIANT",
      "ProductVariant",
      id,
      null,
      {
        sku: variant.sku,
        productId: variant.productId,
        previousDeletedAt: variant.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreProductImage(id: string, actorUserId: string | null, req?: Request) {
    const image = await prisma.productImage.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!image) {
      throw new AppError("Product image not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!image.deletedAt) {
      throw new AppError("Product image is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    if (!image.product || image.product.deletedAt !== null) {
      throw new AppError(
        "Cannot restore image because parent product is archived. Restore the product first.",
        409,
        "RESTORE_PARENT_ARCHIVED"
      );
    }

    const restored = await prisma.productImage.update({
      where: { id },
      data: { deletedAt: null },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_PRODUCT_IMAGE",
      "ProductImage",
      id,
      null,
      {
        productId: image.productId,
        filename: image.originalFilename,
        previousDeletedAt: image.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreOrder(id: string, actorUserId: string | null, req?: Request) {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { customer: true },
    });

    if (!order) {
      throw new AppError("Order not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!order.deletedAt) {
      throw new AppError("Order is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    const archiveTime = order.deletedAt;

    // Restore order and co-archived financial/fulfillment records atomically
    const [restoredOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: { deletedAt: null },
      }),
      prisma.payment.updateMany({
        where: {
          orderId: id,
          deletedAt: {
            gte: new Date(archiveTime.getTime() - 5000),
            lte: new Date(archiveTime.getTime() + 5000),
          },
        },
        data: { deletedAt: null },
      }),
      prisma.refund.updateMany({
        where: {
          orderId: id,
          deletedAt: {
            gte: new Date(archiveTime.getTime() - 5000),
            lte: new Date(archiveTime.getTime() + 5000),
          },
        },
        data: { deletedAt: null },
      }),
      prisma.returnRequest.updateMany({
        where: {
          orderId: id,
          deletedAt: {
            gte: new Date(archiveTime.getTime() - 5000),
            lte: new Date(archiveTime.getTime() + 5000),
          },
        },
        data: { deletedAt: null },
      }),
      prisma.shipment.updateMany({
        where: {
          orderId: id,
          deletedAt: {
            gte: new Date(archiveTime.getTime() - 5000),
            lte: new Date(archiveTime.getTime() + 5000),
          },
        },
        data: { deletedAt: null },
      }),
      prisma.orderTimeline.create({
        data: {
          orderId: id,
          status: order.status,
          action: `Order restored from archive by admin user ${actorUserId || "system"}.`,
          userId: actorUserId,
          userName: "Admin",
        },
      }),
    ]);

    await AuditService.createLog(
      actorUserId,
      "RESTORE_ORDER",
      "Order",
      id,
      null,
      {
        orderNumber: order.orderNumber,
        status: order.status,
        paymentStatus: order.paymentStatus,
        previousDeletedAt: order.deletedAt,
      },
      req
    );

    return restoredOrder;
  }

  private static async restorePayment(id: string, actorUserId: string | null, req?: Request) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!payment) {
      throw new AppError("Payment not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!payment.deletedAt) {
      throw new AppError("Payment is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    if (!payment.order || payment.order.deletedAt !== null) {
      throw new AppError(
        "Cannot restore payment because parent order is archived. Restore the order first.",
        409,
        "RESTORE_PARENT_ARCHIVED"
      );
    }

    const restored = await prisma.payment.update({
      where: { id },
      data: { deletedAt: null },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_PAYMENT",
      "Payment",
      id,
      null,
      {
        orderId: payment.orderId,
        amount: payment.amount,
        transactionReference: payment.transactionReference,
        previousDeletedAt: payment.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreRefund(id: string, actorUserId: string | null, req?: Request) {
    const refund = await prisma.refund.findUnique({
      where: { id },
      include: { order: true, payment: true },
    });

    if (!refund) {
      throw new AppError("Refund not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!refund.deletedAt) {
      throw new AppError("Refund is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    if (!refund.order || refund.order.deletedAt !== null) {
      throw new AppError(
        "Cannot restore refund because parent order is archived. Restore the order first.",
        409,
        "RESTORE_PARENT_ARCHIVED"
      );
    }
    if (!refund.payment || refund.payment.deletedAt !== null) {
      throw new AppError(
        "Cannot restore refund because associated payment is archived. Restore the payment first.",
        409,
        "RESTORE_PARENT_ARCHIVED"
      );
    }

    const restored = await prisma.refund.update({
      where: { id },
      data: { deletedAt: null },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_REFUND",
      "Refund",
      id,
      null,
      {
        orderId: refund.orderId,
        paymentId: refund.paymentId,
        amount: refund.amount,
        previousDeletedAt: refund.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreReturnRequest(id: string, actorUserId: string | null, req?: Request) {
    const returnReq = await prisma.returnRequest.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!returnReq) {
      throw new AppError("Return request not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!returnReq.deletedAt) {
      throw new AppError("Return request is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    if (!returnReq.order || returnReq.order.deletedAt !== null) {
      throw new AppError(
        "Cannot restore return request because parent order is archived. Restore the order first.",
        409,
        "RESTORE_PARENT_ARCHIVED"
      );
    }

    const restored = await prisma.returnRequest.update({
      where: { id },
      data: { deletedAt: null },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_RETURN",
      "ReturnRequest",
      id,
      null,
      {
        orderId: returnReq.orderId,
        reason: returnReq.reason,
        previousDeletedAt: returnReq.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreShipment(id: string, actorUserId: string | null, req?: Request) {
    const shipment = await prisma.shipment.findUnique({
      where: { id },
      include: { order: true },
    });

    if (!shipment) {
      throw new AppError("Shipment not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!shipment.deletedAt) {
      throw new AppError("Shipment is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    if (!shipment.order || shipment.order.deletedAt !== null) {
      throw new AppError(
        "Cannot restore shipment because parent order is archived. Restore the order first.",
        409,
        "RESTORE_PARENT_ARCHIVED"
      );
    }

    const restored = await prisma.shipment.update({
      where: { id },
      data: { deletedAt: null },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_SHIPMENT",
      "Shipment",
      id,
      null,
      {
        orderId: shipment.orderId,
        trackingNumber: shipment.trackingNumber,
        consignmentId: shipment.consignmentId,
        previousDeletedAt: shipment.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreCoupon(id: string, actorUserId: string | null, req?: Request) {
    const coupon = await prisma.coupon.findUnique({ where: { id } });

    if (!coupon) {
      throw new AppError("Coupon not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!coupon.deletedAt) {
      throw new AppError("Coupon is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    const activeCode = await prisma.coupon.findFirst({
      where: { code: coupon.code, deletedAt: null, id: { not: id } },
    });
    if (activeCode) {
      throw new AppError(
        `Cannot restore coupon. Code '${coupon.code}' is already in use by an active coupon.`,
        409,
        "RESTORE_CODE_CONFLICT"
      );
    }

    const restored = await prisma.coupon.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: false, // Restored inactive for safety review
      },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_COUPON",
      "Coupon",
      id,
      null,
      {
        code: coupon.code,
        previousDeletedAt: coupon.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restorePromotion(id: string, actorUserId: string | null, req?: Request) {
    const promotion = await prisma.promotion.findUnique({ where: { id } });

    if (!promotion) {
      throw new AppError("Promotion not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!promotion.deletedAt) {
      throw new AppError("Promotion is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    const restored = await prisma.promotion.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: false,
      },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_PROMOTION",
      "Promotion",
      id,
      null,
      {
        name: promotion.name,
        previousDeletedAt: promotion.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreMarketingCampaign(id: string, actorUserId: string | null, req?: Request) {
    const campaign = await prisma.marketingCampaign.findUnique({ where: { id } });

    if (!campaign) {
      throw new AppError("Marketing campaign not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!campaign.deletedAt) {
      throw new AppError("Marketing campaign is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    const restored = await prisma.marketingCampaign.update({
      where: { id },
      data: {
        deletedAt: null,
        status: "Draft",
      },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_MARKETING_CAMPAIGN",
      "MarketingCampaign",
      id,
      null,
      {
        name: campaign.name,
        previousDeletedAt: campaign.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreBanner(id: string, actorUserId: string | null, req?: Request) {
    const banner = await prisma.banner.findUnique({ where: { id } });

    if (!banner) {
      throw new AppError("Banner not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!banner.deletedAt) {
      throw new AppError("Banner is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    const restored = await prisma.banner.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: false,
      },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_BANNER",
      "Banner",
      id,
      null,
      {
        title: banner.title,
        previousDeletedAt: banner.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restorePopup(id: string, actorUserId: string | null, req?: Request) {
    const popup = await prisma.popup.findUnique({ where: { id } });

    if (!popup) {
      throw new AppError("Popup not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!popup.deletedAt) {
      throw new AppError("Popup is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    const restored = await prisma.popup.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: false,
      },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_POPUP",
      "Popup",
      id,
      null,
      {
        title: popup.title,
        previousDeletedAt: popup.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restorePage(id: string, actorUserId: string | null, req?: Request) {
    const page = await prisma.page.findUnique({ where: { id } });

    if (!page) {
      throw new AppError("Page not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!page.deletedAt) {
      throw new AppError("Page is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    const activeSlug = await prisma.page.findFirst({
      where: { slug: page.slug, deletedAt: null, id: { not: id } },
    });
    if (activeSlug) {
      throw new AppError(
        `Cannot restore page. Slug '${page.slug}' is already in use by an active page.`,
        409,
        "RESTORE_SLUG_CONFLICT"
      );
    }

    const restored = await prisma.page.update({
      where: { id },
      data: {
        deletedAt: null,
        status: "DRAFT",
      },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_PAGE",
      "Page",
      id,
      null,
      {
        title: page.title,
        slug: page.slug,
        previousDeletedAt: page.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreLandingPage(id: string, actorUserId: string | null, req?: Request) {
    const landingPage = await prisma.landingPage.findUnique({ where: { id } });

    if (!landingPage) {
      throw new AppError("Landing page not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!landingPage.deletedAt) {
      throw new AppError("Landing page is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    const activeSlug = await prisma.landingPage.findFirst({
      where: { slug: landingPage.slug, deletedAt: null, id: { not: id } },
    });
    if (activeSlug) {
      throw new AppError(
        `Cannot restore landing page. Slug '${landingPage.slug}' is already in use by an active landing page.`,
        409,
        "RESTORE_SLUG_CONFLICT"
      );
    }

    const restored = await prisma.landingPage.update({
      where: { id },
      data: {
        deletedAt: null,
        status: "DRAFT",
      },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_LANDING_PAGE",
      "LandingPage",
      id,
      null,
      {
        name: landingPage.name,
        slug: landingPage.slug,
        previousDeletedAt: landingPage.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreBlogPost(id: string, actorUserId: string | null, req?: Request) {
    const blogPost = await prisma.blogPost.findUnique({ where: { id } });

    if (!blogPost) {
      throw new AppError("Blog post not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!blogPost.deletedAt) {
      throw new AppError("Blog post is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    const activeSlug = await prisma.blogPost.findFirst({
      where: { slug: blogPost.slug, deletedAt: null, id: { not: id } },
    });
    if (activeSlug) {
      throw new AppError(
        `Cannot restore blog post. Slug '${blogPost.slug}' is already in use by an active blog post.`,
        409,
        "RESTORE_SLUG_CONFLICT"
      );
    }

    const restored = await prisma.blogPost.update({
      where: { id },
      data: {
        deletedAt: null,
        status: "DRAFT",
      },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_BLOG_POST",
      "BlogPost",
      id,
      null,
      {
        title: blogPost.title,
        slug: blogPost.slug,
        previousDeletedAt: blogPost.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreFAQ(id: string, actorUserId: string | null, req?: Request) {
    const faq = await prisma.fAQ.findUnique({ where: { id } });

    if (!faq) {
      throw new AppError("FAQ not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!faq.deletedAt) {
      throw new AppError("FAQ is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    const restored = await prisma.fAQ.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: false,
      },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_FAQ",
      "FAQ",
      id,
      null,
      {
        question: faq.question,
        previousDeletedAt: faq.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreReview(id: string, actorUserId: string | null, req?: Request) {
    const review = await prisma.review.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!review) {
      throw new AppError("Review not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!review.deletedAt) {
      throw new AppError("Review is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    if (!review.product || review.product.deletedAt !== null) {
      throw new AppError(
        "Cannot restore review because parent product is archived. Restore the product first.",
        409,
        "RESTORE_PARENT_ARCHIVED"
      );
    }

    const restored = await prisma.review.update({
      where: { id },
      data: { deletedAt: null },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_REVIEW",
      "Review",
      id,
      null,
      {
        productId: review.productId,
        headline: review.headline,
        previousDeletedAt: review.deletedAt,
      },
      req
    );

    return restored;
  }

  private static async restoreUser(id: string, actorUserId: string | null, req?: Request) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });

    if (!user) {
      throw new AppError("User not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!user.deletedAt) {
      throw new AppError("User is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    // 1. Email uniqueness check among active users
    const emailConflict = await prisma.user.findFirst({
      where: { email: user.email, deletedAt: null, id: { not: id } },
    });
    if (emailConflict) {
      throw new AppError(
        `Cannot restore user. Email '${user.email}' is already in use by an active user.`,
        409,
        "RESTORE_EMAIL_CONFLICT"
      );
    }

    // 2. Assigned role check
    if (!user.role || user.role.deletedAt !== null) {
      throw new AppError(
        `Cannot restore user because assigned role '${user.role?.name || "unknown"}' is archived. Restore the role first.`,
        409,
        "RESTORE_PARENT_ARCHIVED"
      );
    }

    const restored = await prisma.user.update({
      where: { id },
      data: {
        deletedAt: null,
        isActive: false, // Restored inactive for administrator credential verification
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roleId: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_USER",
      "User",
      id,
      user.id,
      {
        email: user.email,
        roleName: user.role.name,
        previousDeletedAt: user.deletedAt,
        isActive: false,
      },
      req
    );

    return restored;
  }

  private static async restoreRole(id: string, actorUserId: string | null, req?: Request) {
    const role = await prisma.role.findUnique({ where: { id } });

    if (!role) {
      throw new AppError("Role not found in archive", 404, "ARCHIVE_ENTITY_NOT_FOUND");
    }
    if (!role.deletedAt) {
      throw new AppError("Role is already active and not archived", 400, "ENTITY_ALREADY_ACTIVE");
    }

    const nameConflict = await prisma.role.findFirst({
      where: { name: role.name, deletedAt: null, id: { not: id } },
    });
    if (nameConflict) {
      throw new AppError(
        `Cannot restore role. Name '${role.name}' is already in use by an active role.`,
        409,
        "RESTORE_NAME_CONFLICT"
      );
    }

    const restored = await prisma.role.update({
      where: { id },
      data: { deletedAt: null },
    });

    await AuditService.createLog(
      actorUserId,
      "RESTORE_ROLE",
      "Role",
      id,
      null,
      {
        name: role.name,
        previousDeletedAt: role.deletedAt,
      },
      req
    );

    return restored;
  }
}
