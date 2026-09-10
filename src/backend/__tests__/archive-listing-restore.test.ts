import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../config/db";
import { ArchiveService } from "../services/archive.service";
import {
  SUPPORTED_ARCHIVE_ENTITIES,
  SupportedArchiveEntityType,
} from "../validators/archive.validator";
import {
  ENTITY_PERMISSION_MODULES,
  validateArchiveEntityType,
  requireArchivePermission,
} from "../routes/archive.routes";
import { AppError } from "../utils/AppError";

test("Backend Archive Listing & Safe Restore Test Suite", async (t) => {
  await t.test("1. Whitelist Verification - all 22 entities supported and permission-mapped", () => {
    assert.equal(SUPPORTED_ARCHIVE_ENTITIES.length, 22);

    for (const entity of SUPPORTED_ARCHIVE_ENTITIES) {
      assert.ok(
        ENTITY_PERMISSION_MODULES[entity],
        `Entity '${entity}' must have permission mapping`
      );
      assert.ok(
        ENTITY_PERMISSION_MODULES[entity].length > 0,
        `Entity '${entity}' must have at least one permission module`
      );
    }
  });

  await t.test("2. Route Validation - Rejects unsupported entity type", () => {
    let capturedError: any = null;
    const req: any = { params: { entityType: "unsupported-model" } };
    const res: any = {};
    const next = (err?: any) => {
      capturedError = err;
    };

    validateArchiveEntityType(req, res, next);
    assert.ok(capturedError instanceof AppError);
    assert.equal(capturedError.statusCode, 400);
    assert.equal(capturedError.code, "INVALID_ENTITY_TYPE");
  });

  await t.test("3. RBAC Enforcement - Super Admin bypasses and regular user without permission fails", async () => {
    const superAdminUser: any = {
      id: "admin-1",
      email: "admin@example.com",
      roleName: "SuperAdmin",
      permissions: [],
    };

    const regularUserWithoutPerms: any = {
      id: "staff-1",
      email: "staff@example.com",
      roleName: "Staff",
      permissions: [{ module: "Blog", read: true, write: false, delete: false }],
    };

    // Test Super Admin
    let adminError: any = null;
    const adminReq: any = {
      user: superAdminUser,
      params: { entityType: "products" },
      ip: "127.0.0.1",
      get: () => "TestAgent",
    };
    const adminNext = (err?: any) => {
      adminError = err;
    };
    const permissionMw = requireArchivePermission("read");
    await permissionMw(adminReq, {} as any, adminNext);
    assert.equal(adminError, undefined, "Super Admin should bypass permission check");

    // Test User lacking permission
    let staffError: any = null;
    const staffReq: any = {
      user: regularUserWithoutPerms,
      params: { entityType: "products" },
      ip: "127.0.0.1",
      get: () => "TestAgent",
    };
    const staffNext = (err?: any) => {
      staffError = err;
    };
    await permissionMw(staffReq, {} as any, staffNext);
    assert.ok(staffError instanceof AppError, "Staff should be denied access");
    assert.equal(staffError.statusCode, 403);
    assert.equal(staffError.code, "FORBIDDEN");
  });

  await t.test("4. Archive Listing - Queries products with deletedAt not null and pagination", async () => {
    const origFindMany = prisma.product.findMany;
    const origCount = prisma.product.count;

    try {
      let capturedArgs: any = null;
      (prisma.product.findMany as any) = async (args: any) => {
        capturedArgs = args;
        return [
          {
            id: "prod-archived-1",
            name: "Vintage Jacket",
            slug: "vintage-jacket",
            sku: "VJ-001",
            status: "Archived",
            isActive: false,
            deletedAt: new Date("2026-09-01T10:00:00Z"),
            createdAt: new Date("2026-01-01T10:00:00Z"),
            category: { id: "cat-1", name: "Apparel", deletedAt: null },
            brand: null,
            _count: { variants: 2, images: 1, orderItems: 5, reviews: 0 },
          },
        ];
      };

      (prisma.product.count as any) = async () => 1;

      const result = await ArchiveService.listArchived("products", {
        page: 1,
        limit: 10,
        search: "Vintage",
      });

      assert.equal(result.items.length, 1);
      assert.equal(result.items[0].displayName, "Vintage Jacket");
      assert.equal(result.items[0].slug, "vintage-jacket");
      assert.equal(result.items[0].sku, "VJ-001");
      assert.equal(result.pagination.total, 1);
      assert.ok(capturedArgs.where.deletedAt);
      assert.ok(capturedArgs.where.AND);
    } finally {
      prisma.product.findMany = origFindMany;
      prisma.product.count = origCount;
    }
  });

  await t.test("5. Product Restore Safety - Rejects if parent category is archived", async () => {
    const origFindUnique = prisma.product.findUnique;

    try {
      (prisma.product.findUnique as any) = async () => ({
        id: "prod-1",
        name: "Test Product",
        slug: "test-product",
        sku: "TEST-01",
        deletedAt: new Date(),
        category: { id: "cat-1", name: "Archived Category", deletedAt: new Date() },
        brand: null,
        variants: [],
      });

      await assert.rejects(
        async () => {
          await ArchiveService.restoreEntity("products", "prod-1", "user-1");
        },
        (err: any) => {
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, "RESTORE_PARENT_ARCHIVED");
          return true;
        }
      );
    } finally {
      prisma.product.findUnique = origFindUnique;
    }
  });

  await t.test("6. Product Restore Safety - Rejects if slug conflicts with active product", async () => {
    const origFindUnique = prisma.product.findUnique;
    const origFindFirst = prisma.product.findFirst;

    try {
      (prisma.product.findUnique as any) = async () => ({
        id: "prod-1",
        name: "Test Product",
        slug: "conflicting-slug",
        sku: "TEST-01",
        deletedAt: new Date(),
        category: { id: "cat-1", name: "Active Category", deletedAt: null },
        brand: null,
        variants: [],
      });

      (prisma.product.findFirst as any) = async (args: any) => {
        if (args?.where?.slug === "conflicting-slug") {
          return { id: "prod-2", name: "Active Conflicting Product" };
        }
        return null;
      };

      await assert.rejects(
        async () => {
          await ArchiveService.restoreEntity("products", "prod-1", "user-1");
        },
        (err: any) => {
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, "RESTORE_SLUG_CONFLICT");
          return true;
        }
      );
    } finally {
      prisma.product.findUnique = origFindUnique;
      prisma.product.findFirst = origFindFirst;
    }
  });

  await t.test("7. Product Restore Safety - Rejects if SKU conflicts with active product or variant", async () => {
    const origFindUnique = prisma.product.findUnique;
    const origProdFindFirst = prisma.product.findFirst;
    const origVarFindFirst = prisma.productVariant.findFirst;

    try {
      (prisma.product.findUnique as any) = async () => ({
        id: "prod-1",
        name: "Test Product",
        slug: "safe-slug",
        sku: "CONFLICT-SKU",
        deletedAt: new Date(),
        category: { id: "cat-1", name: "Active Category", deletedAt: null },
        brand: null,
        variants: [],
      });

      (prisma.product.findFirst as any) = async (args: any) => {
        if (args?.where?.slug === "safe-slug") return null;
        if (args?.where?.sku === "CONFLICT-SKU") {
          return { id: "prod-3", sku: "CONFLICT-SKU" };
        }
        return null;
      };

      (prisma.productVariant.findFirst as any) = async () => null;

      await assert.rejects(
        async () => {
          await ArchiveService.restoreEntity("products", "prod-1", "user-1");
        },
        (err: any) => {
          assert.equal(err.statusCode, 409);
          assert.equal(err.code, "RESTORE_SKU_CONFLICT");
          return true;
        }
      );
    } finally {
      prisma.product.findUnique = origFindUnique;
      prisma.product.findFirst = origProdFindFirst;
      prisma.productVariant.findFirst = origVarFindFirst;
    }
  });

  await t.test("8. Product Restore Execution - Restores product to Draft status and co-restores variants", async () => {
    const origFindUnique = prisma.product.findUnique;
    const origProdFindFirst = prisma.product.findFirst;
    const origVarFindFirst = prisma.productVariant.findFirst;
    const origTransaction = prisma.$transaction;
    const origLog = prisma.activityLog.create;

    const archiveDate = new Date("2026-09-01T12:00:00Z");

    try {
      (prisma.product.findUnique as any) = async () => ({
        id: "prod-100",
        name: "Restorable Sneaker",
        slug: "restorable-sneaker",
        sku: "SNEAK-100",
        deletedAt: archiveDate,
        category: { id: "cat-1", name: "Footwear", deletedAt: null },
        brand: null,
        variants: [
          {
            id: "var-1",
            sku: "SNEAK-100-RED",
            deletedAt: archiveDate,
          },
        ],
      });

      (prisma.product.findFirst as any) = async () => null;
      (prisma.productVariant.findFirst as any) = async () => null;

      let transactionOperations: any[] = [];
      (prisma.$transaction as any) = async (ops: any[]) => {
        transactionOperations = ops;
        return [
          {
            id: "prod-100",
            name: "Restorable Sneaker",
            status: "Draft",
            isActive: false,
            deletedAt: null,
          },
        ];
      };

      (prisma.activityLog.create as any) = async () => ({ id: "log-1" });

      const restored = await ArchiveService.restoreEntity("products", "prod-100", "user-admin-1");

      assert.equal(restored.id, "prod-100");
      assert.equal((restored as any).status, "Draft");
      assert.equal((restored as any).isActive, false);
      assert.equal((restored as any).deletedAt, null);
      assert.equal(transactionOperations.length, 4, "Should execute 4-step transaction for product + variants + images + inventory");
    } finally {
      prisma.product.findUnique = origFindUnique;
      prisma.product.findFirst = origProdFindFirst;
      prisma.productVariant.findFirst = origVarFindFirst;
      prisma.$transaction = origTransaction;
      prisma.activityLog.create = origLog;
    }
  });

  await t.test("9. Order Restore - Atomically restores order, co-archived payments, and creates timeline record", async () => {
    const origOrderFindUnique = prisma.order.findUnique;
    const origTransaction = prisma.$transaction;
    const origLog = prisma.activityLog.create;

    const archiveDate = new Date("2026-09-05T14:00:00Z");

    try {
      (prisma.order.findUnique as any) = async () => ({
        id: "ord-500",
        orderNumber: "ORD-500",
        status: "Processing",
        paymentStatus: "PAID",
        totalAmount: 150,
        deletedAt: archiveDate,
        customer: { id: "cust-1", firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
      });

      let transactionOperations: any[] = [];
      (prisma.$transaction as any) = async (ops: any[]) => {
        transactionOperations = ops;
        return [
          {
            id: "ord-500",
            orderNumber: "ORD-500",
            status: "Processing",
            paymentStatus: "PAID",
            deletedAt: null,
          },
        ];
      };

      (prisma.activityLog.create as any) = async () => ({ id: "log-2" });

      const restored = await ArchiveService.restoreEntity("orders", "ord-500", "admin-id");

      assert.equal(restored.id, "ord-500");
      assert.equal((restored as any).status, "Processing");
      assert.equal((restored as any).deletedAt, null);
      assert.equal(transactionOperations.length, 6, "Should atomically update order, payments, refunds, returns, shipments, and timeline");
    } finally {
      prisma.order.findUnique = origOrderFindUnique;
      prisma.$transaction = origTransaction;
      prisma.activityLog.create = origLog;
    }
  });

  await t.test("10. Already Active Entity - Rejects restore with 400 ENTITY_ALREADY_ACTIVE", async () => {
    const origFindUnique = prisma.category.findUnique;

    try {
      (prisma.category.findUnique as any) = async () => ({
        id: "cat-active-1",
        name: "Electronics",
        slug: "electronics",
        deletedAt: null, // Not archived
      });

      await assert.rejects(
        async () => {
          await ArchiveService.restoreEntity("categories", "cat-active-1", "user-1");
        },
        (err: any) => {
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "ENTITY_ALREADY_ACTIVE");
          return true;
        }
      );
    } finally {
      prisma.category.findUnique = origFindUnique;
    }
  });
});
