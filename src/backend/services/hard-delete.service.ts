import { Request } from "express";
import { prisma } from "../config/db";
import { AppError } from "../utils/AppError";
import { AuditService } from "./audit.service";
import { MediaUsageService } from "./media-usage.service";
import { MediaService } from "./media.service";
import {
  SUPPORTED_ARCHIVE_ENTITIES,
  SupportedArchiveEntityType,
} from "../validators/archive.validator";

export interface HardDeleteCheckResult {
  allowed: boolean;
  code?: string;
  reason: string;
  dependencies: string[];
  entity?: {
    id: string;
    displayName: string;
    entityType: SupportedArchiveEntityType;
    deletedAt?: Date | null;
  };
}

export interface HardDeleteExecutionResult {
  id: string;
  entityType: SupportedArchiveEntityType;
  displayName: string;
  deletedAt?: Date | null;
  mediaEvaluatedCount?: number;
  mediaDeletedCount?: number;
  auditLogId?: string | null;
}

// Permanently protected financial & fulfillment entities
export const PERMANENTLY_PROTECTED_ENTITIES: readonly SupportedArchiveEntityType[] = [
  "orders",
  "payments",
  "refunds",
  "returns",
  "shipments",
] as const;

export class HardDeleteService {
  /**
   * Pre-flight policy and dependency inspection for an entity before hard deletion.
   * Does NOT alter the database.
   */
  public static async checkHardDeleteSafety(
    entityType: SupportedArchiveEntityType,
    id: string,
    actorUserId?: string | null
  ): Promise<HardDeleteCheckResult> {
    if (!SUPPORTED_ARCHIVE_ENTITIES.includes(entityType)) {
      throw new AppError(
        `Unsupported archive entity type: ${entityType}`,
        400,
        "INVALID_ENTITY_TYPE"
      );
    }

    // 1. Permanently protected financial & historical records
    if (PERMANENTLY_PROTECTED_ENTITIES.includes(entityType)) {
      return {
        allowed: false,
        code: "HARD_DELETE_PROHIBITED",
        reason: `Hard delete is permanently prohibited for '${entityType}'. Financial, fulfillment, tax, and order history records must be retained for audit, legal, and accounting integrity.`,
        dependencies: ["Financial & fulfillment historical records protection policy"],
      };
    }

    // 2. Entity-specific dependency analysis
    switch (entityType) {
      case "products":
        return this.checkProductSafety(id);

      case "variants":
        return this.checkVariantSafety(id);

      case "product-images":
        return this.checkProductImageSafety(id);

      case "categories":
        return this.checkCategorySafety(id);

      case "brands":
        return this.checkBrandSafety(id);

      case "coupons":
        return this.checkCouponSafety(id);

      case "promotions":
        return this.checkPromotionSafety(id);

      case "marketing-campaigns":
        return this.checkMarketingCampaignSafety(id);

      case "banners":
        return this.checkBannerSafety(id);

      case "popups":
        return this.checkPopupSafety(id);

      case "pages":
        return this.checkPageSafety(id);

      case "landing-pages":
        return this.checkLandingPageSafety(id);

      case "blog-posts":
        return this.checkBlogPostSafety(id);

      case "faqs":
        return this.checkFaqSafety(id);

      case "reviews":
        return this.checkReviewSafety(id);

      case "users":
        return this.checkUserSafety(id, actorUserId);

      case "roles":
        return this.checkRoleSafety(id);

      default:
        return {
          allowed: false,
          code: "HARD_DELETE_PROHIBITED",
          reason: `Hard delete policy not defined for '${entityType}'.`,
          dependencies: ["Undefined policy"],
        };
    }
  }

  /**
   * Executes transactional hard delete following pre-flight verification.
   */
  public static async hardDeleteEntity(
    entityType: SupportedArchiveEntityType,
    id: string,
    reason: string,
    actorUserId: string | null,
    req?: Request
  ): Promise<HardDeleteExecutionResult> {
    const trimmedReason = (reason || "").trim();
    if (!trimmedReason || trimmedReason.length < 3) {
      throw new AppError(
        "A valid reason (minimum 3 characters) is required for hard delete.",
        400,
        "HARD_DELETE_REASON_REQUIRED"
      );
    }

    // Run full safety evaluation
    const safety = await this.checkHardDeleteSafety(entityType, id, actorUserId);
    if (!safety.allowed) {
      throw new AppError(
        safety.reason,
        400,
        safety.code || "HARD_DELETE_DEPENDENCY_EXISTS",
        true,
        { dependencies: safety.dependencies }
      );
    }

    let executionResult: HardDeleteExecutionResult;

    switch (entityType) {
      case "products":
        executionResult = await this.executeProductHardDelete(id);
        break;

      case "variants":
        executionResult = await this.executeVariantHardDelete(id);
        break;

      case "product-images":
        executionResult = await this.executeProductImageHardDelete(id);
        break;

      case "categories":
        executionResult = await this.executeCategoryHardDelete(id);
        break;

      case "brands":
        executionResult = await this.executeBrandHardDelete(id);
        break;

      case "coupons":
        executionResult = await this.executeCouponHardDelete(id);
        break;

      case "promotions":
        executionResult = await this.executePromotionHardDelete(id);
        break;

      case "marketing-campaigns":
        executionResult = await this.executeMarketingCampaignHardDelete(id);
        break;

      case "banners":
        executionResult = await this.executeBannerHardDelete(id);
        break;

      case "popups":
        executionResult = await this.executePopupHardDelete(id);
        break;

      case "pages":
        executionResult = await this.executePageHardDelete(id);
        break;

      case "landing-pages":
        executionResult = await this.executeLandingPageHardDelete(id);
        break;

      case "blog-posts":
        executionResult = await this.executeBlogPostHardDelete(id);
        break;

      case "faqs":
        executionResult = await this.executeFaqHardDelete(id);
        break;

      case "reviews":
        executionResult = await this.executeReviewHardDelete(id);
        break;

      case "users":
        executionResult = await this.executeUserHardDelete(id);
        break;

      case "roles":
        executionResult = await this.executeRoleHardDelete(id);
        break;

      default:
        throw new AppError(
          `Hard delete execution is not supported for ${entityType}`,
          400,
          "HARD_DELETE_PROHIBITED"
        );
    }

    // Comprehensive Audit Log creation
    try {
      await AuditService.createLog(
        actorUserId,
        "HARD_DELETE",
        entityType,
        id,
        executionResult.displayName || null,
        {
          entityType,
          entityId: id,
          displayName: executionResult.displayName,
          reason: trimmedReason,
          dependenciesChecked: safety.dependencies,
          mediaEvaluatedCount: executionResult.mediaEvaluatedCount || 0,
          mediaDeletedCount: executionResult.mediaDeletedCount || 0,
        },
        req
      );
    } catch (auditErr: any) {
      console.warn(`[AUDIT] Failed to record hard delete audit log: ${auditErr?.message}`);
    }

    return executionResult;
  }

  // =========================================================================
  // 1. PRODUCTS POLICY & EXECUTION
  // =========================================================================

  private static async checkProductSafety(id: string): Promise<HardDeleteCheckResult> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        variants: true,
      },
    });

    if (!product) {
      throw new AppError("Product not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!product.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Product must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Product is currently active"],
        entity: { id, displayName: product.name, entityType: "products", deletedAt: null },
      };
    }

    const dependencies: string[] = [];

    // Check direct order items
    const directOrderItems = await prisma.orderItem.count({ where: { productId: id } });
    if (directOrderItems > 0) {
      dependencies.push(`${directOrderItems} historical order item(s) reference this product`);
    }

    // Check variant order items
    const variantOrderItems = await prisma.orderItem.count({
      where: { productVariant: { productId: id } },
    });
    if (variantOrderItems > 0) {
      dependencies.push(`${variantOrderItems} historical order item(s) reference this product's variants`);
    }

    // Check reviews
    const reviews = await prisma.review.count({ where: { productId: id } });
    if (reviews > 0) {
      dependencies.push(`${reviews} customer review(s) are associated with this product`);
    }

    // Check shipment/return items referencing images
    const shipmentImages = await prisma.shipmentItem.count({
      where: { ProductImage: { productId: id } },
    });
    if (shipmentImages > 0) {
      dependencies.push(`${shipmentImages} shipment item(s) reference this product's images`);
    }

    const returnImages = await prisma.returnItem.count({
      where: { ProductImage: { productId: id } },
    });
    if (returnImages > 0) {
      dependencies.push(`${returnImages} return item(s) reference this product's images`);
    }

    if (dependencies.length > 0) {
      return {
        allowed: false,
        code: "HARD_DELETE_PRODUCT_BLOCKED",
        reason: `Product cannot be hard deleted due to active historical dependencies: ${dependencies.join("; ")}`,
        dependencies,
        entity: { id, displayName: product.name, entityType: "products", deletedAt: product.deletedAt },
      };
    }

    return {
      allowed: true,
      reason: "Product has no blocking historical dependencies and is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: product.name, entityType: "products", deletedAt: product.deletedAt },
    };
  }

  private static async executeProductHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        images: true,
        variants: true,
      },
    });

    if (!product) {
      throw new AppError("Product not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    const candidateMedia = product.images
      .map((img) => img.cloudinaryPublicId || img.secureUrl || img.url)
      .filter(Boolean);

    // Atomic transaction for all related non-historical records
    await prisma.$transaction(async (tx) => {
      // Re-verify inside transaction that no orderItem appeared concurrently
      const orderItems = await tx.orderItem.count({
        where: {
          OR: [{ productId: id }, { productVariant: { productId: id } }],
        },
      });
      if (orderItems > 0) {
        throw new AppError(
          "Concurrent order item detected. Aborting hard delete.",
          400,
          "HARD_DELETE_PRODUCT_BLOCKED"
        );
      }

      // 1. Delete shopping cart items
      await tx.cartItem.deleteMany({ where: { productId: id } });
      for (const variant of product.variants) {
        await tx.cartItem.deleteMany({ where: { variantId: variant.id } });
      }

      // 2. Delete wishlist items
      await tx.wishlistItem.deleteMany({ where: { productId: id } });

      // 3. Delete variant attribute values
      for (const variant of product.variants) {
        await tx.variantAttributeValue.deleteMany({ where: { variantId: variant.id } });
      }

      // 4. Delete product tags
      await tx.productTag.deleteMany({ where: { productId: id } });

      // 5. Delete inventories
      await tx.inventory.deleteMany({
        where: {
          OR: [
            { productId: id },
            { variantId: { in: product.variants.map((v) => v.id) } },
          ],
        },
      });

      // 6. Delete variants
      await tx.productVariant.deleteMany({ where: { productId: id } });

      // 7. Delete product images
      await tx.productImage.deleteMany({ where: { productId: id } });

      // 8. Delete product
      await tx.product.delete({ where: { id } });
    });

    // Post-transaction media asset safety check:
    // Shared media assets must NEVER be deleted. Only uniquely unreferenced assets may be pruned.
    let mediaDeletedCount = 0;
    for (const mediaId of candidateMedia) {
      if (!mediaId) continue;
      try {
        const usage = await MediaUsageService.checkAssetUsage(mediaId);
        if (!usage.used) {
          try {
            await MediaService.deleteAsset(mediaId);
            mediaDeletedCount++;
          } catch {
            // Keep media if deletion throws or is uncertain
          }
        }
      } catch {
        // Keep media on error
      }
    }

    return {
      id,
      entityType: "products",
      displayName: product.name,
      deletedAt: product.deletedAt,
      mediaEvaluatedCount: candidateMedia.length,
      mediaDeletedCount,
    };
  }

  // =========================================================================
  // 2. VARIANTS POLICY & EXECUTION
  // =========================================================================

  private static async checkVariantSafety(id: string): Promise<HardDeleteCheckResult> {
    const variant = await prisma.productVariant.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!variant) {
      throw new AppError("Product variant not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!variant.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Variant must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Variant is currently active"],
        entity: { id, displayName: variant.sku, entityType: "variants", deletedAt: null },
      };
    }

    const orderItems = await prisma.orderItem.count({ where: { productVariantId: id } });
    if (orderItems > 0) {
      return {
        allowed: false,
        code: "HARD_DELETE_DEPENDENCY_EXISTS",
        reason: `Variant '${variant.sku}' cannot be hard deleted because it is referenced in ${orderItems} historical order item(s).`,
        dependencies: [`${orderItems} historical order item(s)`],
        entity: { id, displayName: variant.sku, entityType: "variants", deletedAt: variant.deletedAt },
      };
    }

    return {
      allowed: true,
      reason: "Variant has no blocking order dependencies and is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: variant.sku, entityType: "variants", deletedAt: variant.deletedAt },
    };
  }

  private static async executeVariantHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const variant = await prisma.productVariant.findUnique({ where: { id } });
    if (!variant) {
      throw new AppError("Variant not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      const orderItems = await tx.orderItem.count({ where: { productVariantId: id } });
      if (orderItems > 0) {
        throw new AppError(
          "Variant is referenced in order items. Aborting hard delete.",
          400,
          "HARD_DELETE_DEPENDENCY_EXISTS"
        );
      }

      await tx.cartItem.deleteMany({ where: { variantId: id } });
      await tx.variantAttributeValue.deleteMany({ where: { variantId: id } });
      await tx.inventory.deleteMany({ where: { variantId: id } });
      await tx.productImage.updateMany({
        where: { productVariantId: id },
        data: { productVariantId: null },
      });
      await tx.productVariant.delete({ where: { id } });
    });

    return {
      id,
      entityType: "variants",
      displayName: variant.sku,
      deletedAt: variant.deletedAt,
    };
  }

  // =========================================================================
  // 3. PRODUCT IMAGES POLICY & EXECUTION
  // =========================================================================

  private static async checkProductImageSafety(id: string): Promise<HardDeleteCheckResult> {
    const image = await prisma.productImage.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!image) {
      throw new AppError("Product image not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    const dependencies: string[] = [];
    const shipmentItems = await prisma.shipmentItem.count({ where: { productImageId: id } });
    if (shipmentItems > 0) {
      dependencies.push(`${shipmentItems} shipment item(s) reference this image`);
    }

    const returnItems = await prisma.returnItem.count({ where: { productImageId: id } });
    if (returnItems > 0) {
      dependencies.push(`${returnItems} return item(s) reference this image`);
    }

    if (dependencies.length > 0) {
      return {
        allowed: false,
        code: "HARD_DELETE_DEPENDENCY_EXISTS",
        reason: `Product image cannot be hard deleted because it is referenced in fulfillment records: ${dependencies.join(", ")}`,
        dependencies,
        entity: { id, displayName: image.originalFilename || image.altText || id, entityType: "product-images", deletedAt: image.deletedAt },
      };
    }

    return {
      allowed: true,
      reason: "Product image has no blocking fulfillment dependencies.",
      dependencies: [],
      entity: { id, displayName: image.originalFilename || image.altText || id, entityType: "product-images", deletedAt: image.deletedAt },
    };
  }

  private static async executeProductImageHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const image = await prisma.productImage.findUnique({ where: { id } });
    if (!image) {
      throw new AppError("Product image not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    const mediaRef = image.cloudinaryPublicId || image.secureUrl || image.url;

    await prisma.$transaction(async (tx) => {
      const shipmentOrReturn = await tx.shipmentItem.count({ where: { productImageId: id } });
      if (shipmentOrReturn > 0) {
        throw new AppError("Image is referenced in shipments. Aborting.", 400, "HARD_DELETE_DEPENDENCY_EXISTS");
      }
      await tx.productImage.delete({ where: { id } });
    });

    let mediaDeletedCount = 0;
    if (mediaRef) {
      try {
        const usage = await MediaUsageService.checkAssetUsage(mediaRef);
        if (!usage.used) {
          try {
            await MediaService.deleteAsset(mediaRef);
            mediaDeletedCount++;
          } catch {
            // Keep media
          }
        }
      } catch {
        // Keep media
      }
    }

    return {
      id,
      entityType: "product-images",
      displayName: image.originalFilename || image.altText || id,
      deletedAt: image.deletedAt,
      mediaEvaluatedCount: mediaRef ? 1 : 0,
      mediaDeletedCount,
    };
  }

  // =========================================================================
  // 4. CATEGORIES POLICY & EXECUTION
  // =========================================================================

  private static async checkCategorySafety(id: string): Promise<HardDeleteCheckResult> {
    const category = await prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new AppError("Category not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!category.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Category must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Category is currently active"],
        entity: { id, displayName: category.name, entityType: "categories", deletedAt: null },
      };
    }

    const dependencies: string[] = [];
    const children = await prisma.category.count({ where: { parentId: id } });
    if (children > 0) {
      dependencies.push(`${children} child subcategorie(s) depend on this category`);
    }

    const products = await prisma.product.count({ where: { categoryId: id } });
    if (products > 0) {
      dependencies.push(`${products} product(s) are assigned to this category`);
    }

    if (dependencies.length > 0) {
      return {
        allowed: false,
        code: "HARD_DELETE_DEPENDENCY_EXISTS",
        reason: `Cannot hard delete category: ${dependencies.join("; ")}. Reassign or remove dependent entities first.`,
        dependencies,
        entity: { id, displayName: category.name, entityType: "categories", deletedAt: category.deletedAt },
      };
    }

    return {
      allowed: true,
      reason: "Category has no dependent children or products and is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: category.name, entityType: "categories", deletedAt: category.deletedAt },
    };
  }

  private static async executeCategoryHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const category = await prisma.category.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!category) {
      throw new AppError("Category not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    const candidateMedia = [
      category.image,
      category.icon,
      ...category.images.map((img) => img.cloudinaryPublicId || img.secureUrl),
    ].filter(Boolean) as string[];

    await prisma.$transaction(async (tx) => {
      const children = await tx.category.count({ where: { parentId: id } });
      if (children > 0) {
        throw new AppError("Subcategories exist. Aborting.", 400, "HARD_DELETE_DEPENDENCY_EXISTS");
      }
      const products = await tx.product.count({ where: { categoryId: id } });
      if (products > 0) {
        throw new AppError("Assigned products exist. Aborting.", 400, "HARD_DELETE_DEPENDENCY_EXISTS");
      }

      await tx.categoryImage.deleteMany({ where: { categoryId: id } });
      await tx.category.delete({ where: { id } });
    });

    let mediaDeletedCount = 0;
    for (const media of candidateMedia) {
      try {
        const usage = await MediaUsageService.checkAssetUsage(media);
        if (!usage.used) {
          try {
            await MediaService.deleteAsset(media);
            mediaDeletedCount++;
          } catch {
            // Keep media
          }
        }
      } catch {
        // Keep media
      }
    }

    return {
      id,
      entityType: "categories",
      displayName: category.name,
      deletedAt: category.deletedAt,
      mediaEvaluatedCount: candidateMedia.length,
      mediaDeletedCount,
    };
  }

  // =========================================================================
  // 5. BRANDS POLICY & EXECUTION
  // =========================================================================

  private static async checkBrandSafety(id: string): Promise<HardDeleteCheckResult> {
    const brand = await prisma.brand.findUnique({ where: { id } });
    if (!brand) {
      throw new AppError("Brand not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!brand.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Brand must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Brand is currently active"],
        entity: { id, displayName: brand.name, entityType: "brands", deletedAt: null },
      };
    }

    const products = await prisma.product.count({ where: { brandId: id } });
    if (products > 0) {
      return {
        allowed: false,
        code: "HARD_DELETE_DEPENDENCY_EXISTS",
        reason: `Cannot hard delete brand because ${products} product(s) are assigned to it. Reassign or remove brand associations first.`,
        dependencies: [`${products} product(s) reference this brand`],
        entity: { id, displayName: brand.name, entityType: "brands", deletedAt: brand.deletedAt },
      };
    }

    return {
      allowed: true,
      reason: "Brand has no associated products and is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: brand.name, entityType: "brands", deletedAt: brand.deletedAt },
    };
  }

  private static async executeBrandHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const brand = await prisma.brand.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!brand) {
      throw new AppError("Brand not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    const candidateMedia = [
      brand.logoUrl,
      ...brand.images.map((img) => img.cloudinaryPublicId || img.secureUrl),
    ].filter(Boolean) as string[];

    await prisma.$transaction(async (tx) => {
      const products = await tx.product.count({ where: { brandId: id } });
      if (products > 0) {
        throw new AppError("Assigned products exist. Aborting.", 400, "HARD_DELETE_DEPENDENCY_EXISTS");
      }

      await tx.brandImage.deleteMany({ where: { brandId: id } });
      await tx.brand.delete({ where: { id } });
    });

    let mediaDeletedCount = 0;
    for (const media of candidateMedia) {
      try {
        const usage = await MediaUsageService.checkAssetUsage(media);
        if (!usage.used) {
          try {
            await MediaService.deleteAsset(media);
            mediaDeletedCount++;
          } catch {
            // Keep media
          }
        }
      } catch {
        // Keep media
      }
    }

    return {
      id,
      entityType: "brands",
      displayName: brand.name,
      deletedAt: brand.deletedAt,
      mediaEvaluatedCount: candidateMedia.length,
      mediaDeletedCount,
    };
  }

  // =========================================================================
  // 6. COUPONS POLICY & EXECUTION
  // =========================================================================

  private static async checkCouponSafety(id: string): Promise<HardDeleteCheckResult> {
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new AppError("Coupon not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!coupon.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Coupon must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Coupon is currently active"],
        entity: { id, displayName: coupon.code, entityType: "coupons", deletedAt: null },
      };
    }

    const orders = await prisma.order.count({ where: { couponId: id } });
    if (orders > 0) {
      return {
        allowed: false,
        code: "HARD_DELETE_DEPENDENCY_EXISTS",
        reason: `Cannot hard delete coupon '${coupon.code}' because it was applied to ${orders} historical order(s). Retaining coupon record is required for order and financial audit integrity.`,
        dependencies: [`${orders} historical order(s)`],
        entity: { id, displayName: coupon.code, entityType: "coupons", deletedAt: coupon.deletedAt },
      };
    }

    return {
      allowed: true,
      reason: "Coupon has no historical orders and is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: coupon.code, entityType: "coupons", deletedAt: coupon.deletedAt },
    };
  }

  private static async executeCouponHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const coupon = await prisma.coupon.findUnique({ where: { id } });
    if (!coupon) {
      throw new AppError("Coupon not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      const orders = await tx.order.count({ where: { couponId: id } });
      if (orders > 0) {
        throw new AppError("Coupon was applied to orders. Aborting.", 400, "HARD_DELETE_DEPENDENCY_EXISTS");
      }
      await tx.coupon.delete({ where: { id } });
    });

    return {
      id,
      entityType: "coupons",
      displayName: coupon.code,
      deletedAt: coupon.deletedAt,
    };
  }

  // =========================================================================
  // 7. PROMOTIONS POLICY & EXECUTION
  // =========================================================================

  private static async checkPromotionSafety(id: string): Promise<HardDeleteCheckResult> {
    const promotion = await prisma.promotion.findUnique({ where: { id } });
    if (!promotion) {
      throw new AppError("Promotion not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!promotion.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Promotion must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Promotion is currently active"],
        entity: { id, displayName: promotion.name, entityType: "promotions", deletedAt: null },
      };
    }

    return {
      allowed: true,
      reason: "Promotion is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: promotion.name, entityType: "promotions", deletedAt: promotion.deletedAt },
    };
  }

  private static async executePromotionHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const promotion = await prisma.promotion.findUnique({ where: { id } });
    if (!promotion) {
      throw new AppError("Promotion not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      await tx.promotion.delete({ where: { id } });
    });

    return {
      id,
      entityType: "promotions",
      displayName: promotion.name,
      deletedAt: promotion.deletedAt,
    };
  }

  // =========================================================================
  // 8. MARKETING CAMPAIGNS POLICY & EXECUTION
  // =========================================================================

  private static async checkMarketingCampaignSafety(id: string): Promise<HardDeleteCheckResult> {
    const campaign = await prisma.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new AppError("Marketing campaign not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!campaign.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Campaign must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Campaign is currently active"],
        entity: { id, displayName: campaign.name, entityType: "marketing-campaigns", deletedAt: null },
      };
    }

    if (campaign.status === "Sent" || campaign.sentAt) {
      return {
        allowed: false,
        code: "HARD_DELETE_DEPENDENCY_EXISTS",
        reason: "Cannot hard delete sent marketing campaigns with historical delivery and conversion metrics.",
        dependencies: ["Historical campaign metrics and transmission records"],
        entity: { id, displayName: campaign.name, entityType: "marketing-campaigns", deletedAt: campaign.deletedAt },
      };
    }

    return {
      allowed: true,
      reason: "Campaign is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: campaign.name, entityType: "marketing-campaigns", deletedAt: campaign.deletedAt },
    };
  }

  private static async executeMarketingCampaignHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const campaign = await prisma.marketingCampaign.findUnique({ where: { id } });
    if (!campaign) {
      throw new AppError("Campaign not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      if (campaign.status === "Sent" || campaign.sentAt) {
        throw new AppError("Sent campaign cannot be deleted.", 400, "HARD_DELETE_DEPENDENCY_EXISTS");
      }
      await tx.marketingCampaign.delete({ where: { id } });
    });

    return {
      id,
      entityType: "marketing-campaigns",
      displayName: campaign.name,
      deletedAt: campaign.deletedAt,
    };
  }

  // =========================================================================
  // 9. BANNERS POLICY & EXECUTION
  // =========================================================================

  private static async checkBannerSafety(id: string): Promise<HardDeleteCheckResult> {
    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new AppError("Banner not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!banner.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Banner must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Banner is currently active"],
        entity: { id, displayName: banner.title, entityType: "banners", deletedAt: null },
      };
    }

    return {
      allowed: true,
      reason: "Banner is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: banner.title, entityType: "banners", deletedAt: banner.deletedAt },
    };
  }

  private static async executeBannerHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const banner = await prisma.banner.findUnique({ where: { id } });
    if (!banner) {
      throw new AppError("Banner not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    const candidateMedia = [banner.desktopImage, banner.mobileImage].filter(Boolean) as string[];

    await prisma.$transaction(async (tx) => {
      await tx.banner.delete({ where: { id } });
    });

    let mediaDeletedCount = 0;
    for (const media of candidateMedia) {
      try {
        const usage = await MediaUsageService.checkAssetUsage(media);
        if (!usage.used) {
          try {
            await MediaService.deleteAsset(media);
            mediaDeletedCount++;
          } catch {
            // Keep media
          }
        }
      } catch {
        // Keep media
      }
    }

    return {
      id,
      entityType: "banners",
      displayName: banner.title,
      deletedAt: banner.deletedAt,
      mediaEvaluatedCount: candidateMedia.length,
      mediaDeletedCount,
    };
  }

  // =========================================================================
  // 10. POPUPS POLICY & EXECUTION
  // =========================================================================

  private static async checkPopupSafety(id: string): Promise<HardDeleteCheckResult> {
    const popup = await prisma.popup.findUnique({ where: { id } });
    if (!popup) {
      throw new AppError("Popup not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!popup.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Popup must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Popup is currently active"],
        entity: { id, displayName: popup.title, entityType: "popups", deletedAt: null },
      };
    }

    return {
      allowed: true,
      reason: "Popup is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: popup.title, entityType: "popups", deletedAt: popup.deletedAt },
    };
  }

  private static async executePopupHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const popup = await prisma.popup.findUnique({ where: { id } });
    if (!popup) {
      throw new AppError("Popup not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    const candidateMedia = [popup.imageUrl].filter(Boolean) as string[];

    await prisma.$transaction(async (tx) => {
      await tx.popup.delete({ where: { id } });
    });

    let mediaDeletedCount = 0;
    for (const media of candidateMedia) {
      try {
        const usage = await MediaUsageService.checkAssetUsage(media);
        if (!usage.used) {
          try {
            await MediaService.deleteAsset(media);
            mediaDeletedCount++;
          } catch {
            // Keep media
          }
        }
      } catch {
        // Keep media
      }
    }

    return {
      id,
      entityType: "popups",
      displayName: popup.title,
      deletedAt: popup.deletedAt,
      mediaEvaluatedCount: candidateMedia.length,
      mediaDeletedCount,
    };
  }

  // =========================================================================
  // 11. PAGES POLICY & EXECUTION
  // =========================================================================

  private static async checkPageSafety(id: string): Promise<HardDeleteCheckResult> {
    const page = await prisma.page.findUnique({ where: { id } });
    if (!page) {
      throw new AppError("Page not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!page.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Page must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Page is currently active"],
        entity: { id, displayName: page.title, entityType: "pages", deletedAt: null },
      };
    }

    return {
      allowed: true,
      reason: "Page is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: page.title, entityType: "pages", deletedAt: page.deletedAt },
    };
  }

  private static async executePageHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const page = await prisma.page.findUnique({ where: { id } });
    if (!page) {
      throw new AppError("Page not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      await tx.pageVersion.deleteMany({ where: { pageId: id } });
      await tx.page.delete({ where: { id } });
      if (page.seoMetadataId) {
        await tx.seoMetadata.delete({ where: { id: page.seoMetadataId } });
      }
    });

    return {
      id,
      entityType: "pages",
      displayName: page.title,
      deletedAt: page.deletedAt,
    };
  }

  // =========================================================================
  // 12. LANDING PAGES POLICY & EXECUTION
  // =========================================================================

  private static async checkLandingPageSafety(id: string): Promise<HardDeleteCheckResult> {
    const landingPage = await prisma.landingPage.findUnique({ where: { id } });
    if (!landingPage) {
      throw new AppError("Landing page not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!landingPage.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Landing page must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Landing page is currently active"],
        entity: { id, displayName: landingPage.name, entityType: "landing-pages", deletedAt: null },
      };
    }

    return {
      allowed: true,
      reason: "Landing page is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: landingPage.name, entityType: "landing-pages", deletedAt: landingPage.deletedAt },
    };
  }

  private static async executeLandingPageHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const landingPage = await prisma.landingPage.findUnique({ where: { id } });
    if (!landingPage) {
      throw new AppError("Landing page not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      await tx.landingPage.delete({ where: { id } });
      if (landingPage.seoMetadataId) {
        await tx.seoMetadata.delete({ where: { id: landingPage.seoMetadataId } });
      }
    });

    return {
      id,
      entityType: "landing-pages",
      displayName: landingPage.name,
      deletedAt: landingPage.deletedAt,
    };
  }

  // =========================================================================
  // 13. BLOG POSTS POLICY & EXECUTION
  // =========================================================================

  private static async checkBlogPostSafety(id: string): Promise<HardDeleteCheckResult> {
    const post = await prisma.blogPost.findUnique({ where: { id } });
    if (!post) {
      throw new AppError("Blog post not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!post.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Blog post must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Blog post is currently active"],
        entity: { id, displayName: post.title, entityType: "blog-posts", deletedAt: null },
      };
    }

    return {
      allowed: true,
      reason: "Blog post is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: post.title, entityType: "blog-posts", deletedAt: post.deletedAt },
    };
  }

  private static async executeBlogPostHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const post = await prisma.blogPost.findUnique({
      where: { id },
      include: { tags: true },
    });

    if (!post) {
      throw new AppError("Blog post not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    const candidateMedia = post.featuredImageId ? [post.featuredImageId] : [];

    await prisma.$transaction(async (tx) => {
      await tx.blogPost.update({
        where: { id },
        data: { tags: { set: [] } },
      });
      await tx.blogPost.delete({ where: { id } });
      if (post.seoMetadataId) {
        await tx.seoMetadata.delete({ where: { id: post.seoMetadataId } });
      }
    });

    let mediaDeletedCount = 0;
    for (const media of candidateMedia) {
      try {
        const usage = await MediaUsageService.checkAssetUsage(media);
        if (!usage.used) {
          try {
            await MediaService.deleteAsset(media);
            mediaDeletedCount++;
          } catch {
            // Keep media
          }
        }
      } catch {
        // Keep media
      }
    }

    return {
      id,
      entityType: "blog-posts",
      displayName: post.title,
      deletedAt: post.deletedAt,
      mediaEvaluatedCount: candidateMedia.length,
      mediaDeletedCount,
    };
  }

  // =========================================================================
  // 14. FAQS POLICY & EXECUTION
  // =========================================================================

  private static async checkFaqSafety(id: string): Promise<HardDeleteCheckResult> {
    const faq = await prisma.fAQ.findUnique({ where: { id } });
    if (!faq) {
      throw new AppError("FAQ not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!faq.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "FAQ must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["FAQ is currently active"],
        entity: { id, displayName: faq.question, entityType: "faqs", deletedAt: null },
      };
    }

    return {
      allowed: true,
      reason: "FAQ is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: faq.question, entityType: "faqs", deletedAt: faq.deletedAt },
    };
  }

  private static async executeFaqHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const faq = await prisma.fAQ.findUnique({ where: { id } });
    if (!faq) {
      throw new AppError("FAQ not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      await tx.fAQ.delete({ where: { id } });
    });

    return {
      id,
      entityType: "faqs",
      displayName: faq.question,
      deletedAt: faq.deletedAt,
    };
  }

  // =========================================================================
  // 15. REVIEWS POLICY & EXECUTION
  // =========================================================================

  private static async checkReviewSafety(id: string): Promise<HardDeleteCheckResult> {
    const review = await prisma.review.findUnique({ where: { id } });
    if (!review) {
      throw new AppError("Review not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (!review.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "Review must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["Review is currently active"],
        entity: { id, displayName: review.headline || review.comment?.substring(0, 30) || id, entityType: "reviews", deletedAt: null },
      };
    }

    if (review.orderItemId) {
      return {
        allowed: false,
        code: "HARD_DELETE_DEPENDENCY_EXISTS",
        reason: "Cannot hard delete customer review linked to verified order purchase history.",
        dependencies: ["Verified order item purchase history link"],
        entity: { id, displayName: review.headline || review.comment?.substring(0, 30) || id, entityType: "reviews", deletedAt: review.deletedAt },
      };
    }

    return {
      allowed: true,
      reason: "Review is unlinked from order history and eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: review.headline || review.comment?.substring(0, 30) || id, entityType: "reviews", deletedAt: review.deletedAt },
    };
  }

  private static async executeReviewHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const review = await prisma.review.findUnique({
      where: { id },
      include: { images: true },
    });

    if (!review) {
      throw new AppError("Review not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      if (review.orderItemId) {
        throw new AppError("Cannot delete verified purchase review.", 400, "HARD_DELETE_DEPENDENCY_EXISTS");
      }
      await tx.reviewImage.deleteMany({ where: { reviewId: id } });
      await tx.review.delete({ where: { id } });
    });

    return {
      id,
      entityType: "reviews",
      displayName: review.headline || review.comment?.substring(0, 30) || id,
      deletedAt: review.deletedAt,
    };
  }

  // =========================================================================
  // 16. USERS POLICY & EXECUTION
  // =========================================================================

  private static async checkUserSafety(
    id: string,
    actorUserId?: string | null
  ): Promise<HardDeleteCheckResult> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError("User not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    if (actorUserId && user.id === actorUserId) {
      return {
        allowed: false,
        code: "HARD_DELETE_PROHIBITED",
        reason: "Cannot hard delete your own user account.",
        dependencies: ["Self-deletion protection policy"],
        entity: { id, displayName: user.email, entityType: "users", deletedAt: user.deletedAt },
      };
    }

    if (!user.deletedAt) {
      return {
        allowed: false,
        code: "ENTITY_NOT_ARCHIVED",
        reason: "User must be archived/soft-deleted before it can be permanently hard deleted.",
        dependencies: ["User is currently active"],
        entity: { id, displayName: user.email, entityType: "users", deletedAt: null },
      };
    }

    const dependencies: string[] = [];
    const activityLogs = await prisma.activityLog.count({ where: { userId: id } });
    if (activityLogs > 0) {
      dependencies.push(`${activityLogs} activity/audit log(s) reference this user`);
    }

    const assignedOrders = await prisma.order.count({ where: { assignedStaffId: id } });
    if (assignedOrders > 0) {
      dependencies.push(`${assignedOrders} order(s) are assigned to this user`);
    }

    if (dependencies.length > 0) {
      return {
        allowed: false,
        code: "HARD_DELETE_DEPENDENCY_EXISTS",
        reason: `Cannot hard delete user with existing audit logs or order assignments: ${dependencies.join("; ")}. User records must be preserved for audit trail integrity.`,
        dependencies,
        entity: { id, displayName: user.email, entityType: "users", deletedAt: user.deletedAt },
      };
    }

    return {
      allowed: true,
      reason: "User has no audit logs or order assignments and is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: user.email, entityType: "users", deletedAt: user.deletedAt },
    };
  }

  private static async executeUserHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new AppError("User not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    await prisma.$transaction(async (tx) => {
      const logs = await tx.activityLog.count({ where: { userId: id } });
      if (logs > 0) {
        throw new AppError("User has activity logs. Aborting.", 400, "HARD_DELETE_DEPENDENCY_EXISTS");
      }
      const orders = await tx.order.count({ where: { assignedStaffId: id } });
      if (orders > 0) {
        throw new AppError("User is assigned to orders. Aborting.", 400, "HARD_DELETE_DEPENDENCY_EXISTS");
      }

      await tx.refreshToken.deleteMany({ where: { userId: id } });
      await tx.user.delete({ where: { id } });
    });

    return {
      id,
      entityType: "users",
      displayName: user.email,
      deletedAt: user.deletedAt,
    };
  }

  // =========================================================================
  // 17. ROLES POLICY & EXECUTION
  // =========================================================================

  private static async checkRoleSafety(id: string): Promise<HardDeleteCheckResult> {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new AppError("Role not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    const protectedRoleNames = ["SuperAdmin", "Super Admin", "Admin", "Staff", "Customer"];
    if (protectedRoleNames.includes(role.name)) {
      return {
        allowed: false,
        code: "HARD_DELETE_PROHIBITED",
        reason: `System core role '${role.name}' cannot be hard deleted.`,
        dependencies: ["System role protection policy"],
        entity: { id, displayName: role.name, entityType: "roles", deletedAt: role.deletedAt },
      };
    }

    const userCount = await prisma.user.count({ where: { roleId: id } });
    if (userCount > 0) {
      return {
        allowed: false,
        code: "HARD_DELETE_DEPENDENCY_EXISTS",
        reason: `Cannot hard delete role '${role.name}' because ${userCount} user(s) are assigned to it. Reassign or remove assigned users first.`,
        dependencies: [`${userCount} assigned user(s)`],
        entity: { id, displayName: role.name, entityType: "roles", deletedAt: role.deletedAt },
      };
    }

    return {
      allowed: true,
      reason: "Role has no assigned users and is eligible for safe permanent removal.",
      dependencies: [],
      entity: { id, displayName: role.name, entityType: "roles", deletedAt: role.deletedAt },
    };
  }

  private static async executeRoleHardDelete(id: string): Promise<HardDeleteExecutionResult> {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { permissions: true },
    });

    if (!role) {
      throw new AppError("Role not found", 404, "HARD_DELETE_ENTITY_NOT_FOUND");
    }

    const protectedRoleNames = ["SuperAdmin", "Super Admin", "Admin", "Staff", "Customer"];
    if (protectedRoleNames.includes(role.name)) {
      throw new AppError(
        `System core role '${role.name}' cannot be hard deleted.`,
        400,
        "HARD_DELETE_PROHIBITED"
      );
    }

    await prisma.$transaction(async (tx) => {
      const userCount = await tx.user.count({ where: { roleId: id } });
      if (userCount > 0) {
        throw new AppError("Role has assigned users. Aborting.", 400, "HARD_DELETE_DEPENDENCY_EXISTS");
      }

      // Disconnect all role permissions
      await tx.role.update({
        where: { id },
        data: { permissions: { set: [] } },
      });
      await tx.role.delete({ where: { id } });
    });

    return {
      id,
      entityType: "roles",
      displayName: role.name,
      deletedAt: role.deletedAt,
    };
  }
}
