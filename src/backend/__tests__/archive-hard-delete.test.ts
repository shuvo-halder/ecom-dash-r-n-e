import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../config/db";
import { HardDeleteService } from "../services/hard-delete.service";
import { MediaUsageService } from "../services/media-usage.service";
import { MediaService } from "../services/media.service";
import { AuditService } from "../services/audit.service";
import { requireHardDeletePermission } from "../routes/archive.routes";

test("Archive Hard Delete Safety System", async (t) => {
  await t.test("1. Financial/Historical Protection - Prohibits hard delete of orders, payments, refunds, returns, shipments", async () => {
    const protectedEntities = ["orders", "payments", "refunds", "returns", "shipments"] as const;

    for (const entityType of protectedEntities) {
      const check = await HardDeleteService.checkHardDeleteSafety(entityType, "any-id");
      assert.equal(check.allowed, false);
      assert.equal(check.code, "HARD_DELETE_PROHIBITED");
      assert.match(check.reason, /permanently prohibited/i);

      await assert.rejects(
        async () => {
          await HardDeleteService.hardDeleteEntity(
            entityType,
            "any-id",
            "Attempt to delete historical financial record",
            "superadmin-1"
          );
        },
        (err: any) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "HARD_DELETE_PROHIBITED");
          return true;
        }
      );
    }
  });

  await t.test("2. Active Entity Protection - Blocks hard delete if entity is not soft-deleted first", async () => {
    const origFindUnique = prisma.product.findUnique;
    try {
      (prisma.product.findUnique as any) = async () => ({
        id: "prod-active",
        name: "Active Product",
        deletedAt: null, // Active!
        images: [],
        variants: [],
      });

      const check = await HardDeleteService.checkHardDeleteSafety("products", "prod-active");
      assert.equal(check.allowed, false);
      assert.equal(check.code, "ENTITY_NOT_ARCHIVED");
      assert.match(check.reason, /must be archived\/soft-deleted/i);
    } finally {
      prisma.product.findUnique = origFindUnique;
    }
  });

  await t.test("3. Reason Validation - Requires non-empty reason of at least 3 characters", async () => {
    await assert.rejects(
      async () => {
        await HardDeleteService.hardDeleteEntity("products", "prod-1", "", "admin-id");
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "HARD_DELETE_REASON_REQUIRED");
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await HardDeleteService.hardDeleteEntity("products", "prod-1", "  no ", "admin-id");
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "HARD_DELETE_REASON_REQUIRED");
        return true;
      }
    );
  });

  await t.test("4. Product Dependency Protection - Blocks product with historical order items or reviews", async () => {
    const origFindUnique = prisma.product.findUnique;
    const origOrderItemCount = prisma.orderItem.count;
    const origReviewCount = prisma.review.count;
    const origShipmentCount = prisma.shipmentItem.count;
    const origReturnCount = prisma.returnItem.count;

    try {
      (prisma.product.findUnique as any) = async () => ({
        id: "prod-ordered",
        name: "Ordered Product",
        deletedAt: new Date("2026-09-01"),
        images: [],
        variants: [],
      });

      (prisma.shipmentItem.count as any) = async () => 0;
      (prisma.returnItem.count as any) = async () => 0;

      // Case A: Has historical order items
      (prisma.orderItem.count as any) = async (args: any) => {
        if (args?.where?.productId === "prod-ordered") return 5;
        return 0;
      };
      (prisma.review.count as any) = async () => 0;

      const checkOrders = await HardDeleteService.checkHardDeleteSafety("products", "prod-ordered");
      assert.equal(checkOrders.allowed, false);
      assert.equal(checkOrders.code, "HARD_DELETE_PRODUCT_BLOCKED");
      assert.match(checkOrders.reason, /historical order item\(s\)/i);

      // Case B: Has customer reviews
      (prisma.orderItem.count as any) = async () => 0;
      (prisma.review.count as any) = async () => 3;

      const checkReviews = await HardDeleteService.checkHardDeleteSafety("products", "prod-ordered");
      assert.equal(checkReviews.allowed, false);
      assert.equal(checkReviews.code, "HARD_DELETE_PRODUCT_BLOCKED");
      assert.match(checkReviews.reason, /customer review\(s\)/i);
    } finally {
      prisma.product.findUnique = origFindUnique;
      prisma.orderItem.count = origOrderItemCount;
      prisma.review.count = origReviewCount;
      prisma.shipmentItem.count = origShipmentCount;
      prisma.returnItem.count = origReturnCount;
    }
  });

  await t.test("5. Product Safe Hard Delete - Cascades cleanups atomically and checks media safely", async () => {
    const origFindUnique = prisma.product.findUnique;
    const origOrderItemCount = prisma.orderItem.count;
    const origReviewCount = prisma.review.count;
    const origShipmentCount = prisma.shipmentItem.count;
    const origReturnCount = prisma.returnItem.count;
    const origTransaction = prisma.$transaction;
    const origAuditLog = AuditService.createLog;
    const origCheckUsage = MediaUsageService.checkAssetUsage;
    const origDeleteAsset = MediaService.deleteAsset;

    try {
      const mockProduct = {
        id: "prod-clean",
        name: "Clean Product",
        slug: "clean-product",
        sku: "PROD-CLEAN",
        deletedAt: new Date("2026-09-01"),
        images: [
          { id: "img-1", cloudinaryPublicId: "prod_img_1", url: "https://res.cloudinary.com/img1.jpg" },
        ],
        variants: [{ id: "var-1", sku: "PROD-CLEAN-SM" }],
      };

      (prisma.product.findUnique as any) = async () => mockProduct;
      (prisma.orderItem.count as any) = async () => 0;
      (prisma.review.count as any) = async () => 0;
      (prisma.shipmentItem.count as any) = async () => 0;
      (prisma.returnItem.count as any) = async () => 0;

      const executedTxSteps: string[] = [];
      (prisma.$transaction as any) = async (cb: any) => {
        const fakeTx = {
          orderItem: { count: async () => 0 },
          cartItem: {
            deleteMany: async () => {
              executedTxSteps.push("cartItem.deleteMany");
            },
          },
          wishlistItem: {
            deleteMany: async () => {
              executedTxSteps.push("wishlistItem.deleteMany");
            },
          },
          variantAttributeValue: {
            deleteMany: async () => {
              executedTxSteps.push("variantAttributeValue.deleteMany");
            },
          },
          productTag: {
            deleteMany: async () => {
              executedTxSteps.push("productTag.deleteMany");
            },
          },
          inventory: {
            deleteMany: async () => {
              executedTxSteps.push("inventory.deleteMany");
            },
          },
          productVariant: {
            deleteMany: async () => {
              executedTxSteps.push("productVariant.deleteMany");
            },
          },
          productImage: {
            deleteMany: async () => {
              executedTxSteps.push("productImage.deleteMany");
            },
          },
          product: {
            delete: async () => {
              executedTxSteps.push("product.delete");
            },
          },
        };
        return cb(fakeTx);
      };

      let auditLogged = false;
      (AuditService.createLog as any) = async (actorId: string, action: string, entityType: string) => {
        assert.equal(action, "HARD_DELETE");
        assert.equal(entityType, "products");
        auditLogged = true;
      };

      // Mock media usage: image is not used anywhere else
      let mediaPruned = false;
      (MediaUsageService.checkAssetUsage as any) = async (assetId: string) => {
        assert.equal(assetId, "prod_img_1");
        return { used: false, count: 0, references: [] };
      };
      (MediaService.deleteAsset as any) = async (assetId: string) => {
        if (assetId === "prod_img_1") mediaPruned = true;
        return true;
      };

      const result = await HardDeleteService.hardDeleteEntity(
        "products",
        "prod-clean",
        "Permanent decommissioning of discontinued item",
        "superadmin-123"
      );

      assert.equal(result.id, "prod-clean");
      assert.equal(result.displayName, "Clean Product");
      assert.ok(executedTxSteps.includes("cartItem.deleteMany"));
      assert.ok(executedTxSteps.includes("product.delete"));
      assert.equal(auditLogged, true, "Audit log must be created");
      assert.equal(mediaPruned, true, "Unused media asset should be safely pruned");
    } finally {
      prisma.product.findUnique = origFindUnique;
      prisma.orderItem.count = origOrderItemCount;
      prisma.review.count = origReviewCount;
      prisma.shipmentItem.count = origShipmentCount;
      prisma.returnItem.count = origReturnCount;
      prisma.$transaction = origTransaction;
      AuditService.createLog = origAuditLog;
      MediaUsageService.checkAssetUsage = origCheckUsage;
      MediaService.deleteAsset = origDeleteAsset;
    }
  });

  await t.test("6. Category & Brand Safety - Blocks categories and brands with dependent relations", async () => {
    const origCatFindUnique = prisma.category.findUnique;
    const origCatCount = prisma.category.count;
    const origProdCount = prisma.product.count;
    const origBrandFindUnique = prisma.brand.findUnique;

    try {
      (prisma.category.findUnique as any) = async () => ({
        id: "cat-1",
        name: "Electronics",
        deletedAt: new Date("2026-09-01"),
      });

      // Child subcategories exist
      (prisma.category.count as any) = async () => 2;
      (prisma.product.count as any) = async () => 0;

      const catCheck = await HardDeleteService.checkHardDeleteSafety("categories", "cat-1");
      assert.equal(catCheck.allowed, false);
      assert.equal(catCheck.code, "HARD_DELETE_DEPENDENCY_EXISTS");
      assert.match(catCheck.reason, /child subcategorie\(s\)/i);

      // Brand with assigned products
      (prisma.brand.findUnique as any) = async () => ({
        id: "brand-1",
        name: "Nike",
        deletedAt: new Date("2026-09-01"),
      });
      (prisma.product.count as any) = async () => 14;

      const brandCheck = await HardDeleteService.checkHardDeleteSafety("brands", "brand-1");
      assert.equal(brandCheck.allowed, false);
      assert.equal(brandCheck.code, "HARD_DELETE_DEPENDENCY_EXISTS");
      assert.match(brandCheck.reason, /product\(s\) are assigned to it/i);
    } finally {
      prisma.category.findUnique = origCatFindUnique;
      prisma.category.count = origCatCount;
      prisma.product.count = origProdCount;
      prisma.brand.findUnique = origBrandFindUnique;
    }
  });

  await t.test("7. Coupon Safety - Prohibits deleting coupons applied to historical orders", async () => {
    const origCouponFindUnique = prisma.coupon.findUnique;
    const origOrderCount = prisma.order.count;

    try {
      (prisma.coupon.findUnique as any) = async () => ({
        id: "coup-1",
        code: "SUMMER50",
        deletedAt: new Date("2026-09-01"),
      });
      (prisma.order.count as any) = async () => 42;

      const couponCheck = await HardDeleteService.checkHardDeleteSafety("coupons", "coup-1");
      assert.equal(couponCheck.allowed, false);
      assert.equal(couponCheck.code, "HARD_DELETE_DEPENDENCY_EXISTS");
      assert.match(couponCheck.reason, /applied to 42 historical order\(s\)/i);
    } finally {
      prisma.coupon.findUnique = origCouponFindUnique;
      prisma.order.count = origOrderCount;
    }
  });

  await t.test("8. Marketing Campaign Safety - Blocks sent campaigns with delivery records", async () => {
    const origCampaignFindUnique = prisma.marketingCampaign.findUnique;

    try {
      (prisma.marketingCampaign.findUnique as any) = async () => ({
        id: "camp-1",
        name: "Black Friday Blast",
        status: "Sent",
        sentAt: new Date("2025-11-28"),
        deletedAt: new Date("2026-09-01"),
      });

      const campCheck = await HardDeleteService.checkHardDeleteSafety("marketing-campaigns", "camp-1");
      assert.equal(campCheck.allowed, false);
      assert.equal(campCheck.code, "HARD_DELETE_DEPENDENCY_EXISTS");
      assert.match(campCheck.reason, /sent marketing campaigns/i);
    } finally {
      prisma.marketingCampaign.findUnique = origCampaignFindUnique;
    }
  });

  await t.test("9. User & Role Safety - Blocks self-delete, users with activity logs, and core system roles", async () => {
    const origUserFindUnique = prisma.user.findUnique;
    const origActivityLogCount = prisma.activityLog.count;
    const origOrderCount = prisma.order.count;
    const origRoleFindUnique = prisma.role.findUnique;

    try {
      (prisma.order.count as any) = async () => 0;

      // Case A: Self-deletion attempt
      (prisma.user.findUnique as any) = async () => ({
        id: "admin-self",
        email: "superadmin@example.com",
        deletedAt: new Date("2026-09-01"),
      });

      const selfCheck = await HardDeleteService.checkHardDeleteSafety("users", "admin-self", "admin-self");
      assert.equal(selfCheck.allowed, false);
      assert.equal(selfCheck.code, "HARD_DELETE_PROHIBITED");
      assert.match(selfCheck.reason, /own user account/i);

      // Case B: User with activity logs
      (prisma.activityLog.count as any) = async () => 18;
      const userLogsCheck = await HardDeleteService.checkHardDeleteSafety("users", "admin-self", "other-admin");
      assert.equal(userLogsCheck.allowed, false);
      assert.equal(userLogsCheck.code, "HARD_DELETE_DEPENDENCY_EXISTS");
      assert.match(userLogsCheck.reason, /activity\/audit log\(s\)/i);

      // Case C: Core system role (SuperAdmin)
      (prisma.role.findUnique as any) = async () => ({
        id: "role-superadmin",
        name: "SuperAdmin",
        deletedAt: new Date("2026-09-01"),
      });

      const roleCheck = await HardDeleteService.checkHardDeleteSafety("roles", "role-superadmin");
      assert.equal(roleCheck.allowed, false);
      assert.equal(roleCheck.code, "HARD_DELETE_PROHIBITED");
      assert.match(roleCheck.reason, /System core role/i);
    } finally {
      prisma.user.findUnique = origUserFindUnique;
      prisma.activityLog.count = origActivityLogCount;
      prisma.order.count = origOrderCount;
      prisma.role.findUnique = origRoleFindUnique;
    }
  });

  await t.test("10. RBAC Middleware - Requires SuperAdmin and rejects standard users with 403", async () => {
    const origLogAccessDenied = AuditService.logAccessDenied;
    let accessDeniedLogged = false;

    try {
      (AuditService.logAccessDenied as any) = async () => {
        accessDeniedLogged = true;
      };

      const middleware = requireHardDeletePermission();

      // Test regular staff user
      const reqStaff: any = {
        user: { id: "staff-1", roleName: "Staff" },
        params: { entityType: "products", id: "prod-1" },
      };
      const res: any = {};
      let caughtError: any = null;

      await middleware(reqStaff, res, (err?: any) => {
        caughtError = err;
      });

      assert.ok(caughtError, "Should produce an error for regular staff");
      assert.equal(caughtError.statusCode, 403);
      assert.equal(caughtError.code, "HARD_DELETE_PERMISSION_DENIED");
      assert.equal(accessDeniedLogged, true, "Should log access denied to audit service");

      // Test SuperAdmin user
      const reqSuperAdmin: any = {
        user: { id: "super-1", roleName: "SuperAdmin" },
        params: { entityType: "products", id: "prod-1" },
      };
      let nextCalled = false;

      await middleware(reqSuperAdmin, res, (err?: any) => {
        assert.equal(err, undefined);
        nextCalled = true;
      });

      assert.equal(nextCalled, true, "SuperAdmin must be permitted to proceed");
    } finally {
      AuditService.logAccessDenied = origLogAccessDenied;
    }
  });
});
