import test from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../config/db";
import faqRouter from "../routes/faq.routes";
import storefrontProductRouter from "../routes/storefront/product.routes";
import storefrontFaqRouter from "../routes/storefront/faq.routes";
import { responseFormatter } from "../middlewares/storefront/responseFormatter";
import { errorHandler } from "../middlewares/errorHandler";
import { AuditService } from "../services/audit.service";

test("STEP FAQ-SCOPE-1 — Explicit FAQ Visibility Scope & Product FAQ Suite", async (t) => {
  // Fixed IDs
  const globalOnlyFaqId = "11111111-1111-4111-8111-111111111111";
  const productOnlyFaqId = "22222222-2222-4222-8222-222222222222";
  const sharedFaqId = "33333333-3333-4333-8333-333333333333";
  const inactiveFaqId = "44444444-4444-4444-8444-444444444444";
  const archivedFaqId = "55555555-5555-4555-8555-555555555555";
  const productAId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const productBId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const categoryId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  const adminToken = jwt.sign(
    {
      id: "admin-user-id",
      email: "admin@example.com",
      role: {
        name: "Admin",
        permissions: [
          { resource: "FAQ", action: "read" },
          { resource: "FAQ", action: "write" },
          { resource: "FAQ", action: "delete" },
        ],
      },
    },
    process.env.JWT_SECRET || "test-jwt-secret-key-12345678901234567890"
  );

  let mockFaqs: any[] = [];
  let mockProducts: any[] = [];
  let mockProductFaqs: any[] = [];
  let mockCategories: any[] = [];

  const adminUser = {
    id: "admin-user-id",
    email: "admin@example.com",
    roleId: "role-admin",
    roleName: "Admin",
    permissions: [
      { module: "FAQ", action: "read" },
      { module: "FAQ", action: "write" },
      { module: "FAQ", action: "delete" },
    ],
  };

  let currentUser: any = adminUser;

  const resetMockData = () => {
    mockCategories = [
      {
        id: categoryId,
        name: "General Questions",
        description: "General FAQs",
      },
    ];

    mockFaqs = [
      // 1. Existing / Global-Only FAQ (isGlobal = true, no ProductFaq)
      {
        id: globalOnlyFaqId,
        question: "What are your global store shipping policies?",
        answer: "We ship worldwide with tracking.",
        categoryId,
        orderIndex: 1,
        isActive: true,
        isGlobal: true,
        deletedAt: null,
        createdAt: new Date("2026-09-01T10:00:00Z"),
        updatedAt: new Date("2026-09-01T10:00:00Z"),
      },
      // 2. Product-Only FAQ (isGlobal = false, assigned to Product A)
      {
        id: productOnlyFaqId,
        question: "Does Product A include replacement ear cushions?",
        answer: "Yes, an extra pair of velour cushions is included.",
        categoryId,
        orderIndex: 2,
        isActive: true,
        isGlobal: false,
        deletedAt: null,
        createdAt: new Date("2026-09-01T11:00:00Z"),
        updatedAt: new Date("2026-09-01T11:00:00Z"),
      },
      // 3. Shared FAQ (isGlobal = true, assigned to Product A)
      {
        id: sharedFaqId,
        question: "What is the warranty coverage on your premium electronics?",
        answer: "All items include a standard 2-year warranty.",
        categoryId,
        orderIndex: 3,
        isActive: true,
        isGlobal: true,
        deletedAt: null,
        createdAt: new Date("2026-09-01T12:00:00Z"),
        updatedAt: new Date("2026-09-01T12:00:00Z"),
      },
      // 4. Inactive FAQ (isActive = false)
      {
        id: inactiveFaqId,
        question: "Is this beta feature available yet?",
        answer: "Not yet available.",
        categoryId,
        orderIndex: 4,
        isActive: false,
        isGlobal: true,
        deletedAt: null,
        createdAt: new Date("2026-09-01T13:00:00Z"),
        updatedAt: new Date("2026-09-01T13:00:00Z"),
      },
      // 5. Archived FAQ (deletedAt != null)
      {
        id: archivedFaqId,
        question: "Old legacy product FAQ?",
        answer: "Archived content.",
        categoryId,
        orderIndex: 5,
        isActive: true,
        isGlobal: true,
        deletedAt: new Date("2026-09-05T00:00:00Z"),
        createdAt: new Date("2026-09-01T14:00:00Z"),
        updatedAt: new Date("2026-09-05T00:00:00Z"),
      },
    ];

    mockProducts = [
      {
        id: productAId,
        name: "Pro Headphones Model A",
        slug: "pro-headphones-a",
        isActive: true,
        status: "Active",
        deletedAt: null,
      },
      {
        id: productBId,
        name: "Mechanical Keyboard Model B",
        slug: "mech-keyboard-b",
        isActive: true,
        status: "Active",
        deletedAt: null,
      },
    ];

    mockProductFaqs = [
      // Product A has productOnlyFaq (sortOrder 0) and sharedFaq (sortOrder 1)
      {
        id: "pf-a-1",
        productId: productAId,
        faqId: productOnlyFaqId,
        sortOrder: 0,
        createdAt: new Date("2026-09-10T10:00:00Z"),
        updatedAt: new Date("2026-09-10T10:00:00Z"),
      },
      {
        id: "pf-a-2",
        productId: productAId,
        faqId: sharedFaqId,
        sortOrder: 1,
        createdAt: new Date("2026-09-10T11:00:00Z"),
        updatedAt: new Date("2026-09-10T11:00:00Z"),
      },
    ];
  };

  // Express Test App Setup
  const app = express();
  app.use(express.json());

  // Set mock authenticated user for admin routes
  app.use((req, _res, next) => {
    if (currentUser) {
      (req as any).user = currentUser;
    }
    next();
  });

  // Storefront router
  const storefrontRouter = express.Router();
  storefrontRouter.use(responseFormatter);
  storefrontRouter.use("/products", storefrontProductRouter);
  storefrontRouter.use("/faqs", storefrontFaqRouter);
  app.use("/api/storefront/v1", storefrontRouter);

  // Admin FAQ router
  app.use("/api/v1/faqs", faqRouter);
  app.use(errorHandler);

  // Prisma original methods backup
  const origProductFindFirst = prisma.product.findFirst;
  const origProductFindMany = prisma.product.findMany;
  const origProductCount = prisma.product.count;
  const origReviewGroupBy = prisma.review.groupBy;
  const origFaqFindMany = prisma.fAQ.findMany;
  const origFaqFindFirst = prisma.fAQ.findFirst;
  const origFaqFindUnique = prisma.fAQ.findUnique;
  const origFaqCreate = prisma.fAQ.create;
  const origFaqUpdate = prisma.fAQ.update;
  const origAuditCreateLog = AuditService.createLog;

  t.beforeEach(() => {
    resetMockData();
    currentUser = adminUser;
    (AuditService.createLog as any) = async () => {};
    (prisma.review.groupBy as any) = async () => [];
    (prisma.product.count as any) = async () => mockProducts.length;

    (prisma.fAQ.findMany as any) = async ({ where }: any) => {
      return mockFaqs
        .filter((f) => {
          if (where?.deletedAt === null && f.deletedAt !== null) return false;
          if (where?.isActive === true && f.isActive !== true) return false;
          if (where?.isGlobal !== undefined && (f.isGlobal ?? true) !== where.isGlobal) return false;
          if (where?.categoryId && f.categoryId !== where.categoryId) return false;
          return true;
        })
        .map((f) => ({
          ...f,
          category: mockCategories.find((c) => c.id === f.categoryId) || null,
        }));
    };

    (prisma.fAQ.findUnique as any) = async ({ where }: any) => {
      const f = mockFaqs.find((item) => item.id === where.id);
      return f ? { ...f, category: mockCategories.find((c) => c.id === f.categoryId) || null } : null;
    };

    (prisma.fAQ.findFirst as any) = async ({ where }: any) => {
      const f = mockFaqs.find((item) => {
        if (where.id && item.id !== where.id) return false;
        if (where.deletedAt === null && item.deletedAt !== null) return false;
        return true;
      });
      return f ? { ...f, category: mockCategories.find((c) => c.id === f.categoryId) || null } : null;
    };

    (prisma.fAQ.create as any) = async ({ data, include }: any) => {
      const newFaq = {
        id: `faq-${Date.now()}`,
        question: data.question,
        answer: data.answer,
        categoryId: data.categoryId || null,
        orderIndex: data.orderIndex ?? 0,
        isActive: data.isActive ?? true,
        isGlobal: data.isGlobal ?? true,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockFaqs.push(newFaq);
      if (include?.category) {
        return {
          ...newFaq,
          category: mockCategories.find((c) => c.id === newFaq.categoryId) || null,
        };
      }
      return newFaq;
    };

    (prisma.fAQ.update as any) = async ({ where, data, include }: any) => {
      const idx = mockFaqs.findIndex((f) => f.id === where.id);
      if (idx === -1) throw new Error("FAQ not found");
      mockFaqs[idx] = {
        ...mockFaqs[idx],
        ...data,
        updatedAt: new Date(),
      };
      const updated = mockFaqs[idx];
      if (include?.category) {
        return {
          ...updated,
          category: mockCategories.find((c) => c.id === updated.categoryId) || null,
        };
      }
      return updated;
    };

    (prisma.product.findFirst as any) = async ({ where, include }: any) => {
      const product = mockProducts.find((p) => {
        if (where.slug && p.slug !== where.slug) return false;
        if (where.id && p.id !== where.id) return false;
        if (where.deletedAt === null && p.deletedAt !== null) return false;
        if (where.isActive === true && p.isActive !== true) return false;
        return true;
      });
      if (!product) return null;

      const result: any = { ...product };
      if (include?.productFaqs) {
        const assigned = mockProductFaqs.filter((pf) => pf.productId === product.id);
        result.productFaqs = assigned.map((pf) => ({
          ...pf,
          faq: mockFaqs.find((f) => f.id === pf.faqId),
        }));
      }
      return result;
    };
  });

  t.afterEach(() => {
    prisma.fAQ.findMany = origFaqFindMany;
    prisma.fAQ.findFirst = origFaqFindFirst;
    prisma.fAQ.findUnique = origFaqFindUnique;
    prisma.fAQ.create = origFaqCreate;
    prisma.fAQ.update = origFaqUpdate;
    prisma.product.findFirst = origProductFindFirst;
    prisma.product.findMany = origProductFindMany;
    prisma.product.count = origProductCount;
    prisma.review.groupBy = origReviewGroupBy;
    AuditService.createLog = origAuditCreateLog;
  });

  // =========================================================================
  // Core 10-Point Scoping & Regression Tests
  // =========================================================================

  await t.test("Test 1 — Existing FAQs remain global by default (isGlobal = true)", async () => {
    const res = await request(app).get("/api/storefront/v1/faqs");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "success");

    const ids = res.body.data.map((f: any) => f.id);
    assert.ok(ids.includes(globalOnlyFaqId), "Global endpoint includes existing global FAQ");
  });

  await t.test("Test 2 — Product-only FAQ (isGlobal = false) is excluded from Global /faqs", async () => {
    const res = await request(app).get("/api/storefront/v1/faqs");
    assert.strictEqual(res.status, 200);

    const ids = res.body.data.map((f: any) => f.id);
    assert.strictEqual(ids.includes(productOnlyFaqId), false, "Global endpoint excludes Product-only FAQ");
  });

  await t.test("Test 3 — Product-only FAQ appears on assigned Product details", async () => {
    const res = await request(app).get("/api/storefront/v1/products/pro-headphones-a");
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data.faqs));

    const faqIds = res.body.data.faqs.map((f: any) => f.id);
    assert.ok(faqIds.includes(productOnlyFaqId), "Assigned Product A contains Product-only FAQ");
  });

  await t.test("Test 4 — Product-only FAQ does not appear on unassigned Product", async () => {
    const res = await request(app).get("/api/storefront/v1/products/mech-keyboard-b");
    assert.strictEqual(res.status, 200);

    const faqIds = (res.body.data.faqs || []).map((f: any) => f.id);
    assert.strictEqual(faqIds.includes(productOnlyFaqId), false, "Unassigned Product B does not contain Product-only FAQ");
  });

  await t.test("Test 5 — Shared FAQ (isGlobal = true + ProductFaq exists) appears globally", async () => {
    const res = await request(app).get("/api/storefront/v1/faqs");
    assert.strictEqual(res.status, 200);

    const ids = res.body.data.map((f: any) => f.id);
    assert.ok(ids.includes(sharedFaqId), "Global endpoint includes shared FAQ");
  });

  await t.test("Test 6 — Shared FAQ appears on assigned Product A", async () => {
    const res = await request(app).get("/api/storefront/v1/products/pro-headphones-a");
    assert.strictEqual(res.status, 200);

    const faqIds = res.body.data.faqs.map((f: any) => f.id);
    assert.ok(faqIds.includes(sharedFaqId), "Assigned Product A contains shared FAQ");
  });

  await t.test("Test 7 — Shared FAQ does not appear on unrelated Product B", async () => {
    const res = await request(app).get("/api/storefront/v1/products/mech-keyboard-b");
    assert.strictEqual(res.status, 200);

    const faqIds = (res.body.data.faqs || []).map((f: any) => f.id);
    assert.strictEqual(faqIds.includes(sharedFaqId), false, "Unassigned Product B does not contain shared FAQ");
  });

  await t.test("Test 8 — Inactive FAQ is excluded globally and from Product details", async () => {
    // Check Global Storefront
    const globalRes = await request(app).get("/api/storefront/v1/faqs");
    const globalIds = globalRes.body.data.map((f: any) => f.id);
    assert.strictEqual(globalIds.includes(inactiveFaqId), false, "Global excludes inactive FAQ");

    // Assign inactive FAQ to Product A to verify exclusion from product details
    mockProductFaqs.push({
      id: "pf-a-inactive",
      productId: productAId,
      faqId: inactiveFaqId,
      sortOrder: 10,
    });

    const productRes = await request(app).get("/api/storefront/v1/products/pro-headphones-a");
    const productFaqIds = productRes.body.data.faqs.map((f: any) => f.id);
    assert.strictEqual(productFaqIds.includes(inactiveFaqId), false, "Product details excludes inactive FAQ");
  });

  await t.test("Test 9 — Archived FAQ (deletedAt != null) is excluded globally and from Product details", async () => {
    // Check Global Storefront
    const globalRes = await request(app).get("/api/storefront/v1/faqs");
    const globalIds = globalRes.body.data.map((f: any) => f.id);
    assert.strictEqual(globalIds.includes(archivedFaqId), false, "Global excludes archived FAQ");

    // Assign archived FAQ to Product A to verify exclusion from product details
    mockProductFaqs.push({
      id: "pf-a-archived",
      productId: productAId,
      faqId: archivedFaqId,
      sortOrder: 11,
    });

    const productRes = await request(app).get("/api/storefront/v1/products/pro-headphones-a");
    const productFaqIds = productRes.body.data.faqs.map((f: any) => f.id);
    assert.strictEqual(productFaqIds.includes(archivedFaqId), false, "Product details excludes archived FAQ");
  });

  // =========================================================================
  // Admin CRUD & Validation for isGlobal
  // =========================================================================

  await t.test("Test 10 — Admin creates FAQ with isGlobal = false (Product-only)", async () => {
    const res = await request(app)
      .post("/api/v1/faqs")
      .send({
        question: "Can I replace the mechanical switches?",
        answer: "Yes, hot swappable with 3/5 pin switches.",
        categoryId,
        isGlobal: false,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.isGlobal, false, "Saved with isGlobal = false");
  });

  await t.test("Test 11 — Admin creates FAQ without isGlobal (defaults to true)", async () => {
    const res = await request(app)
      .post("/api/v1/faqs")
      .send({
        question: "What currencies are supported?",
        answer: "USD, BDT, EUR.",
        categoryId,
      });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.isGlobal, true, "Defaults to isGlobal = true");
  });

  await t.test("Test 12 — Admin updates FAQ isGlobal from true to false", async () => {
    const res = await request(app)
      .put(`/api/v1/faqs/${globalOnlyFaqId}`)
      .send({
        isGlobal: false,
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.isGlobal, false);

    // Verify it is now excluded from global storefront
    const storefrontRes = await request(app).get("/api/storefront/v1/faqs");
    const ids = storefrontRes.body.data.map((f: any) => f.id);
    assert.strictEqual(ids.includes(globalOnlyFaqId), false, "Now excluded from global storefront");
  });

  await t.test("Test 13 — Validation rejects non-boolean isGlobal value", async () => {
    const res = await request(app)
      .post("/api/v1/faqs")
      .send({
        question: "Invalid test?",
        answer: "Testing validation.",
        isGlobal: "not-a-boolean",
      });

    assert.strictEqual(res.status, 400);
    assert.ok(res.body.error || res.body.errors || res.body.message, "Validation returns 400 bad request");
  });

  // =========================================================================
  // Public DTO Safety & Migration SQL Verification
  // =========================================================================

  await t.test("Test 14 — Public Storefront FAQ DTO does not leak internal isGlobal field", async () => {
    const res = await request(app).get("/api/storefront/v1/faqs");
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.length > 0);

    for (const faq of res.body.data) {
      assert.strictEqual(faq.isGlobal, undefined, "Public FAQ does not leak isGlobal");
    }
  });

  await t.test("Test 15 — Migration file exists with non-null default true constraint", () => {
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/20260913000000_add_faq_is_global/migration.sql"
    );
    assert.ok(fs.existsSync(migrationPath), "Migration SQL file exists");

    const sqlContent = fs.readFileSync(migrationPath, "utf-8");
    assert.ok(sqlContent.includes('ALTER TABLE "FAQ"'), 'Alters "FAQ" table');
    assert.ok(sqlContent.includes('"isGlobal"'), 'Adds "isGlobal" column');
    assert.ok(sqlContent.includes("BOOLEAN"), "Data type is BOOLEAN");
    assert.ok(sqlContent.includes("NOT NULL"), "Enforces NOT NULL constraint");
    assert.ok(sqlContent.includes("DEFAULT true"), "Enforces DEFAULT true");
  });
});
