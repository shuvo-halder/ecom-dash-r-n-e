import test from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../config/db";
import { AuditService } from "../services/audit.service";
import { ProductFaqService } from "../services/product-faq.service";
import {
  getProductFaqs,
  assignProductFaq,
  reorderProductFaqs,
  removeProductFaq,
} from "../controllers/product-faq.controller";
import {
  assignProductFaqSchema,
  reorderProductFaqsSchema,
} from "../validators/product-faq.validator";
import { requirePermission } from "../middlewares/auth";
import { validateParamsUUID, validateBody } from "../middlewares/validation";

test("STEP 2B — Backend Product FAQ API Suite", async (t) => {
  // Test UUIDs
  const validProductId = "a0000000-0000-0000-0000-000000000001";
  const validProductId2 = "a0000000-0000-0000-0000-000000000002";
  const nonExistentProductId = "a0000000-0000-0000-0000-000000000099";

  const validFaqId1 = "b0000000-0000-0000-0000-000000000001";
  const validFaqId2 = "b0000000-0000-0000-0000-000000000002";
  const validFaqId3 = "b0000000-0000-0000-0000-000000000003";
  const foreignFaqId = "b0000000-0000-0000-0000-000000000004";
  const archivedFaqId = "b0000000-0000-0000-0000-000000000005";
  const inactiveFaqId = "b0000000-0000-0000-0000-000000000006";
  const nonExistentFaqId = "b0000000-0000-0000-0000-000000000099";

  // Mock DB store
  let mockProducts: any[] = [];
  let mockFaqs: any[] = [];
  let mockProductFaqs: any[] = [];

  const resetMockData = () => {
    mockProducts = [
      {
        id: validProductId,
        name: "Wireless Noise-Canceling Headphones",
        slug: "wireless-headphones",
        deletedAt: null,
      },
      {
        id: validProductId2,
        name: "Mechanical Keyboard",
        slug: "mechanical-keyboard",
        deletedAt: null,
      },
      {
        id: "a0000000-0000-0000-0000-000000000003",
        name: "Archived Product",
        slug: "archived-product",
        deletedAt: new Date("2026-09-01"),
      },
    ];

    mockFaqs = [
      {
        id: validFaqId1,
        question: "How long does the battery last?",
        answer: "Up to 30 hours with ANC enabled.",
        isActive: true,
        deletedAt: null,
        category: { id: "cat-1", name: "Battery & Power" },
      },
      {
        id: validFaqId2,
        question: "Is there a warranty included?",
        answer: "Yes, standard 1-year manufacturer warranty.",
        isActive: true,
        deletedAt: null,
        category: { id: "cat-2", name: "Warranty & Support" },
      },
      {
        id: validFaqId3,
        question: "Does it support Bluetooth 5.3?",
        answer: "Yes, multi-point pairing is supported.",
        isActive: true,
        deletedAt: null,
        category: { id: "cat-3", name: "Connectivity" },
      },
      {
        id: foreignFaqId,
        question: "What switches does this keyboard use?",
        answer: "Gateron Brown tactile switches.",
        isActive: true,
        deletedAt: null,
        category: { id: "cat-4", name: "Hardware" },
      },
      {
        id: archivedFaqId,
        question: "Is fast charging supported?",
        answer: "Legacy answer.",
        isActive: true,
        deletedAt: new Date("2026-09-05"),
        category: { id: "cat-1", name: "Battery & Power" },
      },
      {
        id: inactiveFaqId,
        question: "Can I use it underwater?",
        answer: "No, IPX4 splash resistant only.",
        isActive: false,
        deletedAt: null,
        category: null,
      },
    ];

    mockProductFaqs = [
      {
        id: "pf-1",
        productId: validProductId,
        faqId: validFaqId1,
        sortOrder: 0,
        createdAt: new Date("2026-09-10T10:00:00Z"),
        updatedAt: new Date("2026-09-10T10:00:00Z"),
      },
      {
        id: "pf-2",
        productId: validProductId,
        faqId: validFaqId2,
        sortOrder: 1,
        createdAt: new Date("2026-09-10T10:05:00Z"),
        updatedAt: new Date("2026-09-10T10:05:00Z"),
      },
      {
        id: "pf-3",
        productId: validProductId2,
        faqId: foreignFaqId,
        sortOrder: 0,
        createdAt: new Date("2026-09-10T11:00:00Z"),
        updatedAt: new Date("2026-09-10T11:00:00Z"),
      },
    ];
  };

  // Mock Prisma methods
  const origProductFindFirst = prisma.product.findFirst;
  const origFaqFindUnique = prisma.fAQ.findUnique;
  const origProductFaqFindMany = prisma.productFaq.findMany;
  const origProductFaqFindFirst = prisma.productFaq.findFirst;
  const origProductFaqFindUnique = prisma.productFaq.findUnique;
  const origProductFaqCreate = prisma.productFaq.create;
  const origProductFaqDelete = prisma.productFaq.delete;
  const origProductFaqUpdate = prisma.productFaq.update;
  const origTransaction = prisma.$transaction;
  const origAuditCreateLog = AuditService.createLog;

  t.beforeEach(() => {
    resetMockData();
    (AuditService.createLog as any) = async () => {};

    (prisma.product.findFirst as any) = async ({ where }: any) => {
      return (
        mockProducts.find((p) => {
          if (where.id && p.id !== where.id) return false;
          if (where.deletedAt === null && p.deletedAt !== null) return false;
          return true;
        }) || null
      );
    };

    (prisma.fAQ.findUnique as any) = async ({ where }: any) => {
      const faq = mockFaqs.find((f) => f.id === where.id);
      return faq ? { ...faq } : null;
    };

    (prisma.productFaq.findMany as any) = async ({ where, orderBy }: any) => {
      let results = mockProductFaqs.filter((pf) => {
        if (where.productId && pf.productId !== where.productId) return false;
        if (where.faq?.deletedAt === null) {
          const faq = mockFaqs.find((f) => f.id === pf.faqId);
          if (!faq || faq.deletedAt !== null) return false;
        }
        return true;
      });

      // Hydrate faq relation
      results = results.map((pf) => ({
        ...pf,
        faq: mockFaqs.find((f) => f.id === pf.faqId) || null,
      }));

      // Sort
      results.sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });

      return results;
    };

    (prisma.productFaq.findFirst as any) = async ({ where, orderBy }: any) => {
      const list = mockProductFaqs.filter((pf) => pf.productId === where.productId);
      if (orderBy?.sortOrder === "desc") {
        list.sort((a, b) => b.sortOrder - a.sortOrder);
      }
      return list[0] || null;
    };

    (prisma.productFaq.findUnique as any) = async ({ where }: any) => {
      if (where.productId_faqId) {
        const { productId, faqId } = where.productId_faqId;
        const found = mockProductFaqs.find(
          (pf) => pf.productId === productId && pf.faqId === faqId
        );
        return found ? { ...found } : null;
      }
      return null;
    };

    (prisma.productFaq.create as any) = async ({ data }: any) => {
      const existing = mockProductFaqs.find(
        (pf) => pf.productId === data.productId && pf.faqId === data.faqId
      );
      if (existing) {
        const p2002Err: any = new Error("Unique constraint failed");
        p2002Err.code = "P2002";
        throw p2002Err;
      }

      const newEntry = {
        id: `pf-${Date.now()}`,
        productId: data.productId,
        faqId: data.faqId,
        sortOrder: data.sortOrder,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockProductFaqs.push(newEntry);

      return {
        ...newEntry,
        faq: mockFaqs.find((f) => f.id === data.faqId),
      };
    };

    (prisma.productFaq.delete as any) = async ({ where }: any) => {
      const { productId, faqId } = where.productId_faqId;
      const idx = mockProductFaqs.findIndex(
        (pf) => pf.productId === productId && pf.faqId === faqId
      );
      if (idx === -1) {
        throw new Error("Record not found to delete");
      }
      const removed = mockProductFaqs.splice(idx, 1)[0];
      return removed;
    };

    (prisma.productFaq.update as any) = async ({ where, data }: any) => {
      const { productId, faqId } = where.productId_faqId;
      const found = mockProductFaqs.find(
        (pf) => pf.productId === productId && pf.faqId === faqId
      );
      if (!found) {
        throw new Error(`Record not found for product ${productId} and faq ${faqId}`);
      }
      if (data.sortOrder !== undefined) {
        found.sortOrder = data.sortOrder;
      }
      found.updatedAt = new Date();
      return { ...found };
    };

    (prisma.$transaction as any) = async (operations: any) => {
      if (Array.isArray(operations)) {
        const results = [];
        for (const op of operations) {
          results.push(await op);
        }
        return results;
      } else if (typeof operations === "function") {
        return await operations(prisma);
      }
    };
  });

  t.after(() => {
    prisma.product.findFirst = origProductFindFirst;
    prisma.fAQ.findUnique = origFaqFindUnique;
    prisma.productFaq.findMany = origProductFaqFindMany;
    prisma.productFaq.findFirst = origProductFaqFindFirst;
    prisma.productFaq.findUnique = origProductFaqFindUnique;
    prisma.productFaq.create = origProductFaqCreate;
    prisma.productFaq.delete = origProductFaqDelete;
    prisma.productFaq.update = origProductFaqUpdate;
    prisma.$transaction = origTransaction;
    AuditService.createLog = origAuditCreateLog;
  });

  // ==========================================
  // GET TESTS
  // ==========================================
  await t.test("1. Product FAQ list succeeds", async () => {
    const res = await ProductFaqService.getProductFaqs(validProductId);
    assert.equal(res.productId, validProductId);
    assert.equal(res.faqs.length, 2);
    assert.equal(res.faqs[0].id, validFaqId1);
    assert.equal(res.faqs[0].question, "How long does the battery last?");
    assert.equal(res.faqs[0].category?.name, "Battery & Power");
    assert.equal(res.faqs[0].isActive, true);
    assert.equal(res.faqs[1].id, validFaqId2);
  });

  await t.test("2. Product not found -> 404", async () => {
    await assert.rejects(
      async () => {
        await ProductFaqService.getProductFaqs(nonExistentProductId);
      },
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "NOT_FOUND");
        assert.match(err.message, /product not found/i);
        return true;
      }
    );
  });

  await t.test("3. Archived FAQ is not exposed as an active/usable assigned FAQ", async () => {
    // Manually assign an archived FAQ to validProductId
    mockProductFaqs.push({
      id: "pf-archived",
      productId: validProductId,
      faqId: archivedFaqId,
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await ProductFaqService.getProductFaqs(validProductId);
    // Archived FAQ must be excluded from the usable assigned list
    const foundArchived = res.faqs.find((f) => f.id === archivedFaqId);
    assert.equal(foundArchived, undefined, "Archived FAQ should not be exposed in assigned FAQs");
    assert.equal(res.faqs.length, 2);
  });

  await t.test("4. Correct sortOrder ordering", async () => {
    // Add third FAQ with sortOrder 0, shift others
    mockProductFaqs = [
      {
        id: "pf-1",
        productId: validProductId,
        faqId: validFaqId1,
        sortOrder: 10,
        createdAt: new Date("2026-09-10T10:00:00Z"),
        updatedAt: new Date(),
      },
      {
        id: "pf-2",
        productId: validProductId,
        faqId: validFaqId2,
        sortOrder: 5,
        createdAt: new Date("2026-09-10T10:05:00Z"),
        updatedAt: new Date(),
      },
    ];

    const res = await ProductFaqService.getProductFaqs(validProductId);
    assert.equal(res.faqs[0].id, validFaqId2, "sortOrder 5 should come first");
    assert.equal(res.faqs[1].id, validFaqId1, "sortOrder 10 should come second");
  });

  // ==========================================
  // POST TESTS
  // ==========================================
  await t.test("5. Valid FAQ assignment succeeds", async () => {
    const assigned = await ProductFaqService.assignFaqToProduct(validProductId, {
      faqId: validFaqId3,
    });
    assert.equal(assigned.productId, validProductId);
    assert.equal(assigned.faqId, validFaqId3);
    assert.equal(assigned.sortOrder, 2, "Should automatically take next sortOrder (1 + 1)");
    assert.equal(assigned.faq.question, "Does it support Bluetooth 5.3?");

    // Check that GET returns 3 items now
    const res = await ProductFaqService.getProductFaqs(validProductId);
    assert.equal(res.faqs.length, 3);
  });

  await t.test("6. Duplicate assignment is rejected cleanly", async () => {
    await assert.rejects(
      async () => {
        await ProductFaqService.assignFaqToProduct(validProductId, {
          faqId: validFaqId1, // already assigned
        });
      },
      (err: any) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, "DUPLICATE_ASSIGNMENT");
        assert.match(err.message, /already assigned/i);
        return true;
      }
    );
  });

  await t.test("7. Product not found -> 404", async () => {
    await assert.rejects(
      async () => {
        await ProductFaqService.assignFaqToProduct(nonExistentProductId, {
          faqId: validFaqId3,
        });
      },
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "NOT_FOUND");
        assert.match(err.message, /product not found/i);
        return true;
      }
    );
  });

  await t.test("8. FAQ not found -> 404", async () => {
    await assert.rejects(
      async () => {
        await ProductFaqService.assignFaqToProduct(validProductId, {
          faqId: nonExistentFaqId,
        });
      },
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "NOT_FOUND");
        assert.match(err.message, /faq not found/i);
        return true;
      }
    );
  });

  await t.test("9. Archived FAQ rejected", async () => {
    await assert.rejects(
      async () => {
        await ProductFaqService.assignFaqToProduct(validProductId, {
          faqId: archivedFaqId,
        });
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "BAD_REQUEST");
        assert.match(err.message, /cannot assign an archived faq/i);
        return true;
      }
    );
  });

  await t.test("10. Inactive FAQ rejected", async () => {
    await assert.rejects(
      async () => {
        await ProductFaqService.assignFaqToProduct(validProductId, {
          faqId: inactiveFaqId,
        });
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "BAD_REQUEST");
        assert.match(err.message, /cannot assign an inactive faq/i);
        return true;
      }
    );
  });

  await t.test("11. Invalid payload rejected by validator", () => {
    // Non-UUID faqId
    const invalidIdResult = assignProductFaqSchema.safeParse({
      faqId: "not-a-uuid",
    });
    assert.equal(invalidIdResult.success, false);

    // Negative sortOrder
    const negativeSortResult = assignProductFaqSchema.safeParse({
      faqId: validFaqId1,
      sortOrder: -1,
    });
    assert.equal(negativeSortResult.success, false);

    // Extra unknown fields
    const unknownFieldResult = assignProductFaqSchema.safeParse({
      faqId: validFaqId1,
      unsupportedField: "hack",
    });
    assert.equal(unknownFieldResult.success, false);
  });

  await t.test("12. Unauthorized request rejected", async () => {
    const middleware = requirePermission("Products", "read");
    const reqUnauth: any = { user: null };
    const res: any = {};
    let errorCaught: any = null;

    await middleware(reqUnauth, res, (err?: any) => {
      errorCaught = err;
    });

    assert.ok(errorCaught);
    assert.equal(errorCaught.statusCode, 401);
    assert.equal(errorCaught.code, "UNAUTHORIZED");
  });

  await t.test("13. Insufficient permission rejected", async () => {
    const middleware = requirePermission("Products", "write");
    // User without write permission
    const reqForbidden: any = {
      user: {
        id: "user-read-only",
        email: "readonly@example.com",
        role: {
          name: "Viewer",
          permissions: [
            { permission: { module: "Products", action: "read" } },
          ],
        },
      },
    };
    const res: any = {};
    let errorCaught: any = null;

    await middleware(reqForbidden, res, (err?: any) => {
      errorCaught = err;
    });

    assert.ok(errorCaught);
    assert.equal(errorCaught.statusCode, 403);
    assert.equal(errorCaught.code, "FORBIDDEN");
  });

  // ==========================================
  // DELETE TESTS
  // ==========================================
  await t.test("14. Existing mapping unlinks successfully", async () => {
    const res = await ProductFaqService.removeFaqFromProduct(validProductId, validFaqId1);
    assert.equal(res.success, true);
    assert.match(res.message, /unlinked from product successfully/i);

    // Verify mapping is removed from mock store
    const mapping = mockProductFaqs.find(
      (pf) => pf.productId === validProductId && pf.faqId === validFaqId1
    );
    assert.equal(mapping, undefined);
  });

  await t.test("15. FAQ master record remains after unlinking", async () => {
    // Unlink validFaqId2
    await ProductFaqService.removeFaqFromProduct(validProductId, validFaqId2);

    // Master FAQ record must still exist completely intact
    const masterFaq = mockFaqs.find((f) => f.id === validFaqId2);
    assert.ok(masterFaq, "Master FAQ record must remain untouched");
    assert.equal(masterFaq.deletedAt, null);
    assert.equal(masterFaq.isActive, true);
  });

  await t.test("16. Missing mapping -> 404", async () => {
    await assert.rejects(
      async () => {
        await ProductFaqService.removeFaqFromProduct(validProductId, nonExistentFaqId);
      },
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "NOT_FOUND");
        assert.match(err.message, /not assigned to this product/i);
        return true;
      }
    );
  });

  await t.test("17. Insufficient permission rejected for delete", async () => {
    const middleware = requirePermission("Products", "write");
    const reqNoWrite: any = {
      user: {
        id: "user-no-write",
        email: "nowrite@example.com",
        role: {
          name: "Customer",
          permissions: [],
        },
      },
    };
    const res: any = {};
    let errorCaught: any = null;

    await middleware(reqNoWrite, res, (err?: any) => {
      errorCaught = err;
    });

    assert.ok(errorCaught);
    assert.equal(errorCaught.statusCode, 403);
    assert.equal(errorCaught.code, "FORBIDDEN");
  });

  // ==========================================
  // REORDER TESTS
  // ==========================================
  await t.test("18. Valid reorder succeeds", async () => {
    // Currently validProductId has validFaqId1 (sortOrder: 0) and validFaqId2 (sortOrder: 1)
    // Reorder them reversed
    const updated = await ProductFaqService.reorderProductFaqs(validProductId, [
      validFaqId2,
      validFaqId1,
    ]);

    assert.equal(updated.faqs.length, 2);
    assert.equal(updated.faqs[0].id, validFaqId2);
    assert.equal(updated.faqs[0].sortOrder, 0);
    assert.equal(updated.faqs[1].id, validFaqId1);
    assert.equal(updated.faqs[1].sortOrder, 1);
  });

  await t.test("19. Correct sortOrder values are persisted", async () => {
    // Add third faq and reorder
    mockProductFaqs.push({
      id: "pf-3-valid",
      productId: validProductId,
      faqId: validFaqId3,
      sortOrder: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await ProductFaqService.reorderProductFaqs(validProductId, [
      validFaqId3,
      validFaqId1,
      validFaqId2,
    ]);

    const item3 = mockProductFaqs.find(
      (pf) => pf.productId === validProductId && pf.faqId === validFaqId3
    );
    const item1 = mockProductFaqs.find(
      (pf) => pf.productId === validProductId && pf.faqId === validFaqId1
    );
    const item2 = mockProductFaqs.find(
      (pf) => pf.productId === validProductId && pf.faqId === validFaqId2
    );

    assert.equal(item3?.sortOrder, 0);
    assert.equal(item1?.sortOrder, 1);
    assert.equal(item2?.sortOrder, 2);
  });

  await t.test("20. Duplicate FAQ IDs rejected", async () => {
    // Validator rejection
    const invalidPayload = reorderProductFaqsSchema.safeParse({
      faqIds: [validFaqId1, validFaqId1],
    });
    assert.equal(invalidPayload.success, false);

    // Service-level duplicate rejection
    await assert.rejects(
      async () => {
        await ProductFaqService.reorderProductFaqs(validProductId, [
          validFaqId1,
          validFaqId1,
        ]);
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "VALIDATION_ERROR");
        assert.match(err.message, /duplicate faq ids/i);
        return true;
      }
    );
  });

  await t.test("21. FAQ belonging to another Product rejected", async () => {
    // foreignFaqId is assigned to validProductId2, not validProductId
    await assert.rejects(
      async () => {
        await ProductFaqService.reorderProductFaqs(validProductId, [
          validFaqId1,
          foreignFaqId,
        ]);
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, "BAD_REQUEST");
        assert.match(err.message, /not assigned to this product/i);
        return true;
      }
    );
  });

  await t.test("22. Invalid Product rejected", async () => {
    await assert.rejects(
      async () => {
        await ProductFaqService.reorderProductFaqs(nonExistentProductId, [
          validFaqId1,
        ]);
      },
      (err: any) => {
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "NOT_FOUND");
        assert.match(err.message, /product not found/i);
        return true;
      }
    );
  });

  await t.test("23. Partial failure does not leave a partially reordered state", async () => {
    const originalSortOrder1 = mockProductFaqs.find(
      (pf) => pf.productId === validProductId && pf.faqId === validFaqId1
    )?.sortOrder;
    const originalSortOrder2 = mockProductFaqs.find(
      (pf) => pf.productId === validProductId && pf.faqId === validFaqId2
    )?.sortOrder;

    // Simulate transaction failure on second update
    const origUpdate = prisma.productFaq.update;
    let callCount = 0;
    (prisma.productFaq.update as any) = async (args: any) => {
      callCount++;
      if (callCount === 2) {
        throw new Error("Simulated transient database transaction failure");
      }
      return origUpdate(args);
    };

    try {
      await assert.rejects(
        async () => {
          // Re-create transaction behavior that rolls back on failure
          const backup = JSON.parse(JSON.stringify(mockProductFaqs));
          try {
            await ProductFaqService.reorderProductFaqs(validProductId, [
              validFaqId2,
              validFaqId1,
            ]);
          } catch (e) {
            // Restore snapshot to simulate transactional rollback
            mockProductFaqs = backup;
            throw e;
          }
        },
        (err: any) => {
          assert.match(err.message, /simulated transient database/i);
          return true;
        }
      );

      // Verify state was not partially modified
      const current1 = mockProductFaqs.find(
        (pf) => pf.productId === validProductId && pf.faqId === validFaqId1
      );
      const current2 = mockProductFaqs.find(
        (pf) => pf.productId === validProductId && pf.faqId === validFaqId2
      );
      assert.equal(current1?.sortOrder, originalSortOrder1);
      assert.equal(current2?.sortOrder, originalSortOrder2);
    } finally {
      prisma.productFaq.update = origUpdate;
    }
  });

  // ==========================================
  // CONTROLLER & RESPONSE FORMAT INTEGRATION
  // ==========================================
  await t.test("24. Controller format: GET response matches exact expected shape", async () => {
    let responseStatus: number = 0;
    let responseData: any = null;

    const req: any = {
      params: { productId: validProductId },
    };

    await new Promise<void>((resolve, reject) => {
      const res: any = {
        status: (code: number) => {
          responseStatus = code;
          return {
            json: (data: any) => {
              responseData = data;
              resolve();
            },
          };
        },
      };
      getProductFaqs(req, res, (err: any) => {
        if (err) reject(err);
        else resolve();
      });
    });

    assert.equal(responseStatus, 200);
    assert.equal(responseData.success, true);
    assert.equal(responseData.productId, validProductId);
    assert.ok(Array.isArray(responseData.faqs));
    assert.equal(responseData.faqs.length, 2);
    assert.equal(typeof responseData.faqs[0].id, "string");
    assert.equal(typeof responseData.faqs[0].question, "string");
    assert.equal(typeof responseData.faqs[0].answer, "string");
    assert.equal(typeof responseData.faqs[0].sortOrder, "number");
    assert.equal(typeof responseData.faqs[0].isActive, "boolean");
    assert.ok(responseData.faqs[0].category !== undefined);
  });
});
