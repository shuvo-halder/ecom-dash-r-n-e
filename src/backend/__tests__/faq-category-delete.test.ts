import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { prisma } from "../config/db";
import { errorHandler } from "../middlewares/errorHandler";
import { AuditService } from "../services/audit.service";
import faqRouter from "../routes/faq.routes";

test("STEP FAQ-CAT-1 — FAQ Category Delete Safety Suite", async (t) => {
  // Valid RFC 4122 v4 UUIDs for Zod uuidSchema
  const emptyCategoryId = "10000000-0000-4000-8000-000000000001";
  const activeFaqCategoryId = "10000000-0000-4000-8000-000000000002";
  const inactiveFaqCategoryId = "10000000-0000-4000-8000-000000000003";
  const archivedFaqCategoryId = "10000000-0000-4000-8000-000000000004";
  const nonExistentCategoryId = "90000000-0000-4000-8000-000000000099";

  const activeFaqId = "20000000-0000-4000-8000-000000000001";
  const inactiveFaqId = "20000000-0000-4000-8000-000000000002";
  const archivedFaqId = "20000000-0000-4000-8000-000000000003";
  const unlinkedFaqId = "20000000-0000-4000-8000-000000000004";

  const productId = "30000000-0000-4000-8000-000000000001";

  // In-memory mock stores
  let mockCategories: any[] = [];
  let mockFaqs: any[] = [];
  let mockProducts: any[] = [];
  let mockProductFaqs: any[] = [];

  const resetMockData = () => {
    mockCategories = [
      {
        id: emptyCategoryId,
        name: "Empty Category",
        description: "Category with no FAQs attached",
        createdAt: new Date("2026-09-01"),
        updatedAt: new Date("2026-09-01"),
      },
      {
        id: activeFaqCategoryId,
        name: "Active FAQ Category",
        description: "Category with active FAQs",
        createdAt: new Date("2026-09-01"),
        updatedAt: new Date("2026-09-01"),
      },
      {
        id: inactiveFaqCategoryId,
        name: "Inactive FAQ Category",
        description: "Category with inactive FAQs",
        createdAt: new Date("2026-09-01"),
        updatedAt: new Date("2026-09-01"),
      },
      {
        id: archivedFaqCategoryId,
        name: "Archived FAQ Category",
        description: "Category with soft-deleted/archived FAQs",
        createdAt: new Date("2026-09-01"),
        updatedAt: new Date("2026-09-01"),
      },
    ];

    mockFaqs = [
      {
        id: activeFaqId,
        question: "How do I track my order?",
        answer: "Use the tracking link sent via email.",
        categoryId: activeFaqCategoryId,
        orderIndex: 0,
        isActive: true,
        deletedAt: null,
        createdAt: new Date("2026-09-01"),
        updatedAt: new Date("2026-09-01"),
      },
      {
        id: inactiveFaqId,
        question: "Is international shipping free?",
        answer: "Temporarily disabled promotion.",
        categoryId: inactiveFaqCategoryId,
        orderIndex: 1,
        isActive: false,
        deletedAt: null,
        createdAt: new Date("2026-09-01"),
        updatedAt: new Date("2026-09-01"),
      },
      {
        id: archivedFaqId,
        question: "What was the 2025 holiday return policy?",
        answer: "Expired seasonal policy.",
        categoryId: archivedFaqCategoryId,
        orderIndex: 2,
        isActive: false,
        deletedAt: new Date("2026-01-15T00:00:00Z"),
        createdAt: new Date("2025-12-01"),
        updatedAt: new Date("2026-01-15"),
      },
      {
        id: unlinkedFaqId,
        question: "What payment methods are supported?",
        answer: "Credit cards, bKash, and COD.",
        categoryId: null,
        orderIndex: 3,
        isActive: true,
        deletedAt: null,
        createdAt: new Date("2026-09-01"),
        updatedAt: new Date("2026-09-01"),
      },
    ];

    mockProducts = [
      {
        id: productId,
        name: "Premium Headphones",
        slug: "premium-headphones",
        deletedAt: null,
      },
    ];

    mockProductFaqs = [
      {
        id: "pf-1",
        productId,
        faqId: activeFaqId,
        sortOrder: 0,
      },
      {
        id: "pf-2",
        productId,
        faqId: unlinkedFaqId,
        sortOrder: 1,
      },
    ];
  };

  // Original Prisma references
  const origCategoryFindUnique = prisma.fAQCategory.findUnique;
  const origCategoryDelete = prisma.fAQCategory.delete;
  const origFaqCount = prisma.fAQ.count;
  const origFaqFindUnique = prisma.fAQ.findUnique;
  const origFaqFindMany = prisma.fAQ.findMany;
  const origAuditCreateLog = AuditService.createLog;

  t.beforeEach(() => {
    resetMockData();
    (AuditService.createLog as any) = async () => {};

    (prisma.fAQCategory.findUnique as any) = async ({ where }: any) => {
      const cat = mockCategories.find((c) => c.id === where.id);
      return cat ? { ...cat } : null;
    };

    (prisma.fAQCategory.delete as any) = async ({ where }: any) => {
      const idx = mockCategories.findIndex((c) => c.id === where.id);
      if (idx === -1) {
        const err: any = new Error("Record to delete does not exist.");
        err.code = "P2025";
        throw err;
      }
      const deleted = mockCategories.splice(idx, 1)[0];
      return deleted;
    };

    (prisma.fAQ.count as any) = async ({ where }: any) => {
      return mockFaqs.filter((f) => {
        if (where.categoryId && f.categoryId !== where.categoryId) return false;
        if (where.deletedAt === null && f.deletedAt !== null) return false;
        return true;
      }).length;
    };

    (prisma.fAQ.findUnique as any) = async ({ where }: any) => {
      const faq = mockFaqs.find((f) => f.id === where.id);
      return faq ? { ...faq } : null;
    };

    (prisma.fAQ.findMany as any) = async () => {
      return [...mockFaqs];
    };
  });

  t.after(() => {
    prisma.fAQCategory.findUnique = origCategoryFindUnique;
    prisma.fAQCategory.delete = origCategoryDelete;
    prisma.fAQ.count = origFaqCount;
    prisma.fAQ.findUnique = origFaqFindUnique;
    prisma.fAQ.findMany = origFaqFindMany;
    AuditService.createLog = origAuditCreateLog;
  });

  // Factory to create test Express application with custom user credentials/permissions
  const createTestApp = (user: any) => {
    const app = express();
    app.use(express.json());

    // Inject mock user to bypass JWT verification while testing requirePermission and controller
    app.use((req, _res, next) => {
      (req as any).user = user;
      next();
    });

    app.use("/api/v1/faqs", faqRouter);
    app.use(errorHandler);
    return app;
  };

  const adminUser = {
    id: "admin-1",
    email: "admin@example.com",
    roleId: "role-admin",
    roleName: "Admin",
    permissions: [
      { module: "FAQ", action: "read" },
      { module: "FAQ", action: "write" },
      { module: "FAQ", action: "delete" },
    ],
  };

  const readOnlyUser = {
    id: "viewer-1",
    email: "viewer@example.com",
    roleId: "role-viewer",
    roleName: "Viewer",
    permissions: [{ module: "FAQ", action: "read" }],
  };

  const writeOnlyUser = {
    id: "editor-1",
    email: "editor@example.com",
    roleId: "role-editor",
    roleName: "Editor",
    permissions: [
      { module: "FAQ", action: "read" },
      { module: "FAQ", action: "write" },
    ],
  };

  // =========================================================================
  // TEST 1 — Empty category deletion
  // =========================================================================
  await t.test("Test 1 — Empty category deletion: Deletes successfully when category has 0 FAQs", async () => {
    const app = createTestApp(adminUser);

    const res = await request(app).delete(`/api/v1/faqs/categories/${emptyCategoryId}`);

    assert.equal(res.status, 204, "Must return HTTP 204 No Content");
    const found = mockCategories.find((c) => c.id === emptyCategoryId);
    assert.equal(found, undefined, "Category must be removed from mock database");
  });

  // =========================================================================
  // TEST 2 — Category with active FAQ
  // =========================================================================
  await t.test("Test 2 — Category with active FAQ: Rejects deletion with 400 and preserves data", async () => {
    const app = createTestApp(adminUser);

    const res = await request(app).delete(`/api/v1/faqs/categories/${activeFaqCategoryId}`);

    assert.equal(res.status, 400, "Must return HTTP 400 Bad Request");
    assert.match(res.body.error.message, /Cannot delete category because it contains FAQs/i);

    // Category remains
    const cat = mockCategories.find((c) => c.id === activeFaqCategoryId);
    assert.ok(cat, "Category must still exist");

    // Active FAQ remains
    const faq = mockFaqs.find((f) => f.id === activeFaqId);
    assert.ok(faq, "Active FAQ must still exist");
    assert.equal(faq.categoryId, activeFaqCategoryId, "FAQ categoryId must remain linked");
  });

  // =========================================================================
  // TEST 3 — Category with inactive FAQ
  // =========================================================================
  await t.test("Test 3 — Category with inactive FAQ: Rejects deletion with 400 and preserves data", async () => {
    const app = createTestApp(adminUser);

    const res = await request(app).delete(`/api/v1/faqs/categories/${inactiveFaqCategoryId}`);

    assert.equal(res.status, 400, "Must return HTTP 400 Bad Request");
    assert.match(res.body.error.message, /Cannot delete category because it contains FAQs/i);

    // Category remains
    const cat = mockCategories.find((c) => c.id === inactiveFaqCategoryId);
    assert.ok(cat, "Category must still exist");

    // Inactive FAQ remains
    const faq = mockFaqs.find((f) => f.id === inactiveFaqId);
    assert.ok(faq, "Inactive FAQ must still exist");
    assert.equal(faq.isActive, false, "FAQ must still be inactive");
    assert.equal(faq.categoryId, inactiveFaqCategoryId, "FAQ categoryId must remain linked");
  });

  // =========================================================================
  // TEST 4 — Category with archived/soft-deleted FAQ
  // =========================================================================
  await t.test("Test 4 — Category with archived/soft-deleted FAQ: Rejects deletion with 400 (Audit Bug Fix Protection)", async () => {
    const app = createTestApp(adminUser);

    const res = await request(app).delete(`/api/v1/faqs/categories/${archivedFaqCategoryId}`);

    assert.equal(res.status, 400, "Must return HTTP 400 Bad Request");
    assert.match(
      res.body.error.message,
      /Cannot delete category because it contains FAQs/i,
      "Must reject deletion even when linked FAQs are soft-deleted/archived"
    );

    // Category remains
    const cat = mockCategories.find((c) => c.id === archivedFaqCategoryId);
    assert.ok(cat, "Category must still exist");

    // Archived FAQ remains
    const faq = mockFaqs.find((f) => f.id === archivedFaqId);
    assert.ok(faq, "Archived FAQ must still exist");
    assert.ok(faq.deletedAt !== null, "Archived FAQ must keep its deletedAt timestamp");
    assert.equal(faq.categoryId, archivedFaqCategoryId, "Archived FAQ categoryId must remain linked");
  });

  // =========================================================================
  // TEST 5 — FAQ preservation
  // =========================================================================
  await t.test("Test 5 — FAQ preservation: Rejection guarantees zero side effects on FAQ record", async () => {
    const app = createTestApp(adminUser);

    const beforeFaq = { ...mockFaqs.find((f) => f.id === activeFaqId) };

    const res = await request(app).delete(`/api/v1/faqs/categories/${activeFaqCategoryId}`);
    assert.equal(res.status, 400);

    const afterFaq = mockFaqs.find((f) => f.id === activeFaqId);
    assert.equal(afterFaq.question, beforeFaq.question, "Question must be unchanged");
    assert.equal(afterFaq.answer, beforeFaq.answer, "Answer must be unchanged");
    assert.equal(afterFaq.categoryId, beforeFaq.categoryId, "categoryId must be unchanged");
    assert.equal(afterFaq.orderIndex, beforeFaq.orderIndex, "orderIndex must be unchanged");
    assert.equal(afterFaq.isActive, beforeFaq.isActive, "isActive must be unchanged");
    assert.equal(afterFaq.deletedAt, beforeFaq.deletedAt, "deletedAt must be unchanged");
  });

  // =========================================================================
  // TEST 6 — ProductFaq isolation
  // =========================================================================
  await t.test("Test 6 — ProductFaq isolation: Category deletion cannot affect Product or ProductFaq", async () => {
    const app = createTestApp(adminUser);

    // Subcase 6A: Deleting an empty category does not affect ProductFaq
    const resA = await request(app).delete(`/api/v1/faqs/categories/${emptyCategoryId}`);
    assert.equal(resA.status, 204);

    assert.equal(mockProducts.length, 1, "Product must remain untouched");
    assert.equal(mockProductFaqs.length, 2, "ProductFaq join records must remain untouched");

    // Subcase 6B: Category with FAQ used in ProductFaq blocks category deletion
    const resB = await request(app).delete(`/api/v1/faqs/categories/${activeFaqCategoryId}`);
    assert.equal(resB.status, 400);

    const pfActive = mockProductFaqs.find((pf) => pf.faqId === activeFaqId);
    assert.ok(pfActive, "ProductFaq relationship for active FAQ must remain intact");
    assert.equal(pfActive.productId, productId);
  });

  // =========================================================================
  // TEST 7 — RBAC
  // =========================================================================
  await t.test("Test 7 — RBAC: Only FAQ:delete permission can delete category", async () => {
    // 7A: Read-only user rejected with 403
    const viewerApp = createTestApp(readOnlyUser);
    const resViewer = await request(viewerApp).delete(`/api/v1/faqs/categories/${emptyCategoryId}`);
    assert.equal(resViewer.status, 403, "Read-only user must receive 403 Forbidden");

    // 7B: Write-only user rejected with 403 (FAQ:delete is strictly required)
    const editorApp = createTestApp(writeOnlyUser);
    const resEditor = await request(editorApp).delete(`/api/v1/faqs/categories/${emptyCategoryId}`);
    assert.equal(resEditor.status, 403, "User with only FAQ:write must receive 403 Forbidden");

    // Category still exists after unauthorized attempts
    const cat = mockCategories.find((c) => c.id === emptyCategoryId);
    assert.ok(cat, "Category must not be deleted by unauthorized users");

    // 7C: SuperAdmin bypass allowed
    const superAdminUser = {
      id: "superadmin-1",
      email: "superadmin@example.com",
      roleId: "role-superadmin",
      roleName: "SuperAdmin",
      permissions: [],
    };
    const superAdminApp = createTestApp(superAdminUser);
    const resSuper = await request(superAdminApp).delete(`/api/v1/faqs/categories/${emptyCategoryId}`);
    assert.equal(resSuper.status, 204, "SuperAdmin must be able to delete empty category");
  });

  // =========================================================================
  // TEST 8 — Nonexistent category
  // =========================================================================
  await t.test("Test 8 — Nonexistent category: Returns 404 NOT_FOUND", async () => {
    const app = createTestApp(adminUser);

    const res = await request(app).delete(`/api/v1/faqs/categories/${nonExistentCategoryId}`);
    assert.equal(res.status, 404, "Nonexistent category must return 404");
    assert.match(res.body.error.message, /category not found/i);
  });
});
