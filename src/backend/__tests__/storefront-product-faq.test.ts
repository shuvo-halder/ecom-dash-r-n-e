import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import request from "supertest";
import { prisma } from "../config/db";
import { storefrontProductService } from "../services/storefront/product.service";
import { storefrontContentService } from "../services/storefront/content.service";
import storefrontProductRouter from "../routes/storefront/product.routes";
import storefrontFaqRouter from "../routes/storefront/faq.routes";
import { responseFormatter } from "../middlewares/storefront/responseFormatter";

test("STEP 2C — Storefront Product API: Nested Product FAQs Suite", async (t) => {
  // Test UUIDs
  const productAId = "p0000000-0000-0000-0000-000000000001";
  const productBId = "p0000000-0000-0000-0000-000000000002";
  const productNoFaqsId = "p0000000-0000-0000-0000-000000000003";
  const archivedProductId = "p0000000-0000-0000-0000-000000000004";
  const inactiveProductId = "p0000000-0000-0000-0000-000000000005";
  const draftProductId = "p0000000-0000-0000-0000-000000000006";

  const faq1Id = "f0000000-0000-0000-0000-000000000001";
  const faq2Id = "f0000000-0000-0000-0000-000000000002";
  const faq3Id = "f0000000-0000-0000-0000-000000000003";
  const unassignedFaqId = "f0000000-0000-0000-0000-000000000004";
  const inactiveFaqId = "f0000000-0000-0000-0000-000000000005";
  const archivedFaqId = "f0000000-0000-0000-0000-000000000006";
  const foreignFaqId = "f0000000-0000-0000-0000-000000000007";

  // Mock Database State
  let mockProducts: any[] = [];
  let mockFaqs: any[] = [];
  let mockProductFaqs: any[] = [];

  const resetMockData = () => {
    mockProducts = [
      {
        id: productAId,
        name: "Pro Wireless ANC Headphones",
        slug: "pro-wireless-anc-headphones",
        description: "Studio quality headphones with active noise cancellation.",
        shortDescription: "ANC Studio Headphones",
        price: 299.99,
        status: "Active",
        isActive: true,
        deletedAt: null,
        images: [
          { id: "img-1", url: "https://example.com/headphones.jpg", isPrimary: true, sortOrder: 0 }
        ],
        variants: [],
        inventory: { quantityAvailable: 25, quantityReserved: 0 },
        tags: [{ tag: { name: "Audio" } }],
      },
      {
        id: productBId,
        name: "Mechanical Gaming Keyboard",
        slug: "mechanical-gaming-keyboard",
        description: "RGB Mechanical Keyboard with hot-swappable switches.",
        shortDescription: "RGB Mechanical Keyboard",
        price: 149.99,
        status: "Active",
        isActive: true,
        deletedAt: null,
        images: [],
        variants: [],
        inventory: { quantityAvailable: 50, quantityReserved: 0 },
        tags: [],
      },
      {
        id: productNoFaqsId,
        name: "USB-C Braided Cable",
        slug: "usbc-braided-cable",
        description: "Fast charging durable cable.",
        shortDescription: "Braided Cable",
        price: 19.99,
        status: "Active",
        isActive: true,
        deletedAt: null,
        images: [],
        variants: [],
        inventory: { quantityAvailable: 100, quantityReserved: 0 },
        tags: [],
      },
      {
        id: archivedProductId,
        name: "Archived Vintage Radio",
        slug: "archived-vintage-radio",
        description: "Archived product.",
        shortDescription: "Archived",
        price: 99.99,
        status: "Active",
        isActive: true,
        deletedAt: new Date("2026-09-01T00:00:00Z"),
        images: [],
        variants: [],
        inventory: null,
        tags: [],
      },
      {
        id: inactiveProductId,
        name: "Inactive Bluetooth Speaker",
        slug: "inactive-bluetooth-speaker",
        description: "Inactive product.",
        shortDescription: "Inactive",
        price: 49.99,
        status: "Active",
        isActive: false,
        deletedAt: null,
        images: [],
        variants: [],
        inventory: null,
        tags: [],
      },
      {
        id: draftProductId,
        name: "Draft VR Headset",
        slug: "draft-vr-headset",
        description: "Draft status product.",
        shortDescription: "Draft",
        price: 499.99,
        status: "Draft",
        isActive: true,
        deletedAt: null,
        images: [],
        variants: [],
        inventory: null,
        tags: [],
      },
    ];

    mockFaqs = [
      {
        id: faq1Id,
        question: "How long does the battery last on a single charge?",
        answer: "<p>Up to 30 hours of playback with ANC enabled.</p>",
        isActive: true,
        deletedAt: null,
        orderIndex: 0,
        createdAt: new Date("2026-09-01T10:00:00Z"),
        updatedAt: new Date("2026-09-01T10:00:00Z"),
      },
      {
        id: faq2Id,
        question: "Is Bluetooth 5.3 multi-point pairing supported?",
        answer: "<p>Yes, you can pair up to two devices simultaneously.</p>",
        isActive: true,
        deletedAt: null,
        orderIndex: 1,
        createdAt: new Date("2026-09-01T11:00:00Z"),
        updatedAt: new Date("2026-09-01T11:00:00Z"),
      },
      {
        id: faq3Id,
        question: "What is the warranty coverage?",
        answer: "<p>Standard 1-year manufacturer warranty included.</p>",
        isActive: true,
        deletedAt: null,
        orderIndex: 2,
        createdAt: new Date("2026-09-01T12:00:00Z"),
        updatedAt: new Date("2026-09-01T12:00:00Z"),
      },
      {
        id: unassignedFaqId,
        question: "What is your general return policy?",
        answer: "<p>Items can be returned within 30 days.</p>",
        isActive: true,
        deletedAt: null,
        orderIndex: 3,
        createdAt: new Date("2026-09-01T13:00:00Z"),
        updatedAt: new Date("2026-09-01T13:00:00Z"),
      },
      {
        id: inactiveFaqId,
        question: "Can I submerge this device underwater?",
        answer: "<p>No, it is IPX4 splash-resistant only.</p>",
        isActive: false,
        deletedAt: null,
        orderIndex: 4,
        createdAt: new Date("2026-09-01T14:00:00Z"),
        updatedAt: new Date("2026-09-01T14:00:00Z"),
      },
      {
        id: archivedFaqId,
        question: "Does this come with micro-USB?",
        answer: "<p>Legacy question.</p>",
        isActive: true,
        deletedAt: new Date("2026-09-05T00:00:00Z"),
        orderIndex: 5,
        createdAt: new Date("2026-09-01T15:00:00Z"),
        updatedAt: new Date("2026-09-05T00:00:00Z"),
      },
      {
        id: foreignFaqId,
        question: "Are the mechanical switches hot-swappable?",
        answer: "<p>Yes, compatible with 3-pin and 5-pin Cherry MX style switches.</p>",
        isActive: true,
        deletedAt: null,
        orderIndex: 6,
        createdAt: new Date("2026-09-01T16:00:00Z"),
        updatedAt: new Date("2026-09-01T16:00:00Z"),
      },
    ];

    mockProductFaqs = [
      // Product A has FAQ 1 (sortOrder 0), FAQ 2 (sortOrder 1), FAQ 3 (sortOrder 2)
      // plus inactiveFaq and archivedFaq assigned
      {
        id: "pf-1",
        productId: productAId,
        faqId: faq1Id,
        sortOrder: 0,
        createdAt: new Date("2026-09-10T10:00:00Z"),
        updatedAt: new Date("2026-09-10T10:00:00Z"),
      },
      {
        id: "pf-2",
        productId: productAId,
        faqId: faq2Id,
        sortOrder: 1,
        createdAt: new Date("2026-09-10T10:05:00Z"),
        updatedAt: new Date("2026-09-10T10:05:00Z"),
      },
      {
        id: "pf-3",
        productId: productAId,
        faqId: faq3Id,
        sortOrder: 2,
        createdAt: new Date("2026-09-10T10:10:00Z"),
        updatedAt: new Date("2026-09-10T10:10:00Z"),
      },
      {
        id: "pf-inactive",
        productId: productAId,
        faqId: inactiveFaqId,
        sortOrder: 3,
        createdAt: new Date("2026-09-10T10:15:00Z"),
        updatedAt: new Date("2026-09-10T10:15:00Z"),
      },
      {
        id: "pf-archived",
        productId: productAId,
        faqId: archivedFaqId,
        sortOrder: 4,
        createdAt: new Date("2026-09-10T10:20:00Z"),
        updatedAt: new Date("2026-09-10T10:20:00Z"),
      },
      // Product B has foreignFaqId assigned
      {
        id: "pf-b-1",
        productId: productBId,
        faqId: foreignFaqId,
        sortOrder: 0,
        createdAt: new Date("2026-09-10T11:00:00Z"),
        updatedAt: new Date("2026-09-10T11:00:00Z"),
      },
    ];
  };

  // Express Test App Setup
  const app = express();
  app.use(express.json());

  const storefrontRouter = express.Router();
  storefrontRouter.use(responseFormatter);
  storefrontRouter.use("/products", storefrontProductRouter);
  storefrontRouter.use("/faqs", storefrontFaqRouter);

  // Mount both standard path and alias path
  app.use("/api/storefront/v1", storefrontRouter);
  app.use("/api/v1/storefront/v1", storefrontRouter);

  // Prisma original methods backup
  const origProductFindFirst = prisma.product.findFirst;
  const origProductFindMany = prisma.product.findMany;
  const origProductCount = prisma.product.count;
  const origFaqFindMany = prisma.fAQ.findMany;
  const origReviewGroupBy = prisma.review.groupBy;

  t.beforeEach(() => {
    resetMockData();

    (prisma.review.groupBy as any) = async () => [];

    (prisma.product.count as any) = async () => {
      return mockProducts.filter((p) => p.deletedAt === null && p.isActive === true && p.status === "Active").length;
    };

    (prisma.product.findMany as any) = async ({ where }: any) => {
      return mockProducts.filter((p) => {
        if (where?.deletedAt === null && p.deletedAt !== null) return false;
        if (where?.isActive === true && p.isActive !== true) return false;
        if (where?.status === "Active" && p.status !== "Active") return false;
        return true;
      });
    };

    (prisma.fAQ.findMany as any) = async ({ where }: any) => {
      return mockFaqs.filter((f) => {
        if (where?.deletedAt === null && f.deletedAt !== null) return false;
        if (where?.isActive === true && f.isActive !== true) return false;
        return true;
      });
    };

    (prisma.product.findFirst as any) = async ({ where, include }: any) => {
      const product = mockProducts.find((p) => {
        if (where.slug && p.slug !== where.slug) return false;
        if (where.id && p.id !== where.id) return false;
        if (where.deletedAt === null && p.deletedAt !== null) return false;
        if (where.isActive === true && p.isActive !== true) return false;
        if (where.status === "Active" && p.status !== "Active") return false;
        return true;
      });

      if (!product) return null;

      const result: any = { ...product };

      if (include?.productFaqs) {
        // Query assigned FAQs matching where filters and order
        const assigned = mockProductFaqs.filter((pf) => pf.productId === product.id);
        const hydrated: any[] = [];

        for (const mapping of assigned) {
          const faq = mockFaqs.find((f) => f.id === mapping.faqId);
          if (!faq) continue;

          // Apply include.productFaqs.where.faq filters
          if (include.productFaqs.where?.faq) {
            const faqWhere = include.productFaqs.where.faq;
            if (faqWhere.isActive === true && faq.isActive !== true) continue;
            if (faqWhere.deletedAt === null && faq.deletedAt !== null) continue;
          }

          hydrated.push({
            ...mapping,
            faq: { ...faq },
          });
        }

        // Apply include.productFaqs.orderBy
        hydrated.sort((a, b) => {
          if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
          const timeA = new Date(a.createdAt).getTime();
          const timeB = new Date(b.createdAt).getTime();
          return timeA - timeB;
        });

        result.productFaqs = hydrated;
      }

      return result;
    };
  });

  t.after(() => {
    prisma.product.findFirst = origProductFindFirst;
    prisma.product.findMany = origProductFindMany;
    prisma.product.count = origProductCount;
    prisma.fAQ.findMany = origFaqFindMany;
    prisma.review.groupBy = origReviewGroupBy;
  });

  // ----------------------------------------------------
  // SECTION 18 TESTS
  // ----------------------------------------------------

  await t.test("1. Active Product with assigned active FAQ returns the FAQ", async () => {
    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "success");

    const product = res.body.data;
    assert.ok(Array.isArray(product.faqs));
    assert.ok(product.faqs.length >= 1);

    const faq1 = product.faqs.find((f: any) => f.id === faq1Id);
    assert.ok(faq1, "Assigned active FAQ 1 must be present");
    assert.strictEqual(faq1.question, "How long does the battery last on a single charge?");
    assert.strictEqual(faq1.answer, "<p>Up to 30 hours of playback with ANC enabled.</p>");
    assert.strictEqual(faq1.sortOrder, 0);
  });

  await t.test("2. Product with multiple assigned FAQs returns all active eligible ones", async () => {
    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);

    const product = res.body.data;
    assert.strictEqual(product.faqs.length, 3, "Product A has exactly 3 active non-deleted assigned FAQs");
    assert.deepStrictEqual(
      product.faqs.map((f: any) => f.id),
      [faq1Id, faq2Id, faq3Id]
    );
  });

  await t.test("3. FAQs are ordered by ProductFaq.sortOrder ASC", async () => {
    // Reverse sort orders in mock mapping
    const pf1 = mockProductFaqs.find((pf) => pf.faqId === faq1Id && pf.productId === productAId);
    const pf2 = mockProductFaqs.find((pf) => pf.faqId === faq2Id && pf.productId === productAId);
    const pf3 = mockProductFaqs.find((pf) => pf.faqId === faq3Id && pf.productId === productAId);
    pf1.sortOrder = 20;
    pf2.sortOrder = 5;
    pf3.sortOrder = 10;

    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);

    const faqs = res.body.data.faqs;
    assert.strictEqual(faqs[0].id, faq2Id, "Lowest sortOrder (5) must be first");
    assert.strictEqual(faqs[0].sortOrder, 5);
    assert.strictEqual(faqs[1].id, faq3Id, "Middle sortOrder (10) must be second");
    assert.strictEqual(faqs[1].sortOrder, 10);
    assert.strictEqual(faqs[2].id, faq1Id, "Highest sortOrder (20) must be last");
    assert.strictEqual(faqs[2].sortOrder, 20);
  });

  await t.test("4. Secondary ordering is deterministic (createdAt ASC when sortOrder matches)", async () => {
    const pf1 = mockProductFaqs.find((pf) => pf.faqId === faq1Id && pf.productId === productAId);
    const pf2 = mockProductFaqs.find((pf) => pf.faqId === faq2Id && pf.productId === productAId);
    const pf3 = mockProductFaqs.find((pf) => pf.faqId === faq3Id && pf.productId === productAId);
    // Identical sortOrder
    pf1.sortOrder = 0;
    pf2.sortOrder = 0;
    pf3.sortOrder = 0;
    pf1.createdAt = new Date("2026-09-10T12:00:00Z"); // latest
    pf2.createdAt = new Date("2026-09-10T10:00:00Z"); // earliest
    pf3.createdAt = new Date("2026-09-10T11:00:00Z"); // middle

    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);

    const faqs = res.body.data.faqs;
    assert.strictEqual(faqs[0].id, faq2Id, "Earliest createdAt must be first when sortOrder is tied");
    assert.strictEqual(faqs[1].id, faq3Id, "Middle createdAt must be second");
    assert.strictEqual(faqs[2].id, faq1Id, "Latest createdAt must be last");
  });

  await t.test("5. Product with no assigned FAQ returns an empty collection [] (never null)", async () => {
    const res = await request(app).get("/api/storefront/v1/products/usbc-braided-cable");
    assert.strictEqual(res.status, 200);

    const product = res.body.data;
    assert.ok(Array.isArray(product.faqs), "faqs must be an array");
    assert.strictEqual(product.faqs.length, 0, "faqs array must be empty");
    assert.deepStrictEqual(product.faqs, []);
  });

  await t.test("6. Unassigned FAQ does not appear in product FAQs", async () => {
    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);

    const faqs = res.body.data.faqs;
    const found = faqs.find((f: any) => f.id === unassignedFaqId);
    assert.strictEqual(found, undefined, "Unassigned global FAQ must not be included");
  });

  await t.test("7. Inactive FAQ (isActive = false) does not appear in product FAQs", async () => {
    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);

    const faqs = res.body.data.faqs;
    const found = faqs.find((f: any) => f.id === inactiveFaqId);
    assert.strictEqual(found, undefined, "Inactive FAQ must be excluded");
  });

  await t.test("8. Archived FAQ (deletedAt != null) does not appear in product FAQs", async () => {
    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);

    const faqs = res.body.data.faqs;
    const found = faqs.find((f: any) => f.id === archivedFaqId);
    assert.strictEqual(found, undefined, "Archived FAQ must be excluded");
  });

  await t.test("9. Deleted FAQ with orphan ProductFaq relation does not appear in product FAQs", async () => {
    // Add mapping pointing to non-existent FAQ ID
    mockProductFaqs.push({
      id: "pf-orphan",
      productId: productAId,
      faqId: "f0000000-0000-0000-0000-000000000999",
      sortOrder: 99,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);

    const faqs = res.body.data.faqs;
    const found = faqs.find((f: any) => f.id === "f0000000-0000-0000-0000-000000000999");
    assert.strictEqual(found, undefined, "Orphan/missing FAQ must not be included");
  });

  await t.test("10. FAQ assigned to another Product does not appear", async () => {
    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);

    const faqs = res.body.data.faqs;
    const foreignFaq = faqs.find((f: any) => f.id === foreignFaqId);
    assert.strictEqual(foreignFaq, undefined, "FAQ assigned exclusively to Keyboard must not appear on Headphones");

    // Product B (Keyboard) should receive it
    const resB = await request(app).get("/api/storefront/v1/products/mechanical-gaming-keyboard");
    assert.strictEqual(resB.status, 200);
    const faqsB = resB.body.data.faqs;
    assert.strictEqual(faqsB.length, 1);
    assert.strictEqual(faqsB[0].id, foreignFaqId);
  });

  await t.test("11. Existing archived Product returns 404", async () => {
    const res = await request(app).get("/api/storefront/v1/products/archived-vintage-radio");
    assert.strictEqual(res.status, 404);
  });

  await t.test("12. Existing inactive Product returns 404", async () => {
    const res = await request(app).get("/api/storefront/v1/products/inactive-bluetooth-speaker");
    assert.strictEqual(res.status, 404);
  });

  await t.test("12b. Existing unpublished/draft Product returns 404", async () => {
    const res = await request(app).get("/api/storefront/v1/products/draft-vr-headset");
    assert.strictEqual(res.status, 404);
  });

  await t.test("13. FAQ archive hides the FAQ without removing ProductFaq mapping", async () => {
    // FAQ 1 is archived
    const faq1 = mockFaqs.find((f) => f.id === faq1Id);
    faq1.deletedAt = new Date("2026-09-12T00:00:00Z");

    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);

    const faqs = res.body.data.faqs;
    assert.strictEqual(faqs.find((f: any) => f.id === faq1Id), undefined, "Archived FAQ must now be hidden");
    assert.strictEqual(faqs.length, 2, "Other 2 FAQs remain visible");

    // ProductFaq mapping in DB was NOT deleted
    const mappingStillExists = mockProductFaqs.some((pf) => pf.productId === productAId && pf.faqId === faq1Id);
    assert.strictEqual(mappingStillExists, true, "ProductFaq assignment must remain intact in DB");
  });

  await t.test("14. FAQ restore makes the FAQ visible again", async () => {
    // Archive FAQ 1
    const faq1 = mockFaqs.find((f) => f.id === faq1Id);
    faq1.deletedAt = new Date("2026-09-12T00:00:00Z");

    let res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.body.data.faqs.length, 2);

    // Restore FAQ 1
    faq1.deletedAt = null;

    res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.body.data.faqs.length, 3);
    assert.ok(res.body.data.faqs.find((f: any) => f.id === faq1Id), "Restored FAQ is visible again");
  });

  await t.test("15. Product archive hides product and its FAQs from Storefront", async () => {
    const productA = mockProducts.find((p) => p.id === productAId);
    productA.deletedAt = new Date("2026-09-12T00:00:00Z");

    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 404);
  });

  await t.test("16. Product restore preserves Product FAQ behavior", async () => {
    const productA = mockProducts.find((p) => p.id === productAId);
    // Archive then restore
    productA.deletedAt = new Date("2026-09-12T00:00:00Z");
    let res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 404);

    productA.deletedAt = null;
    res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.faqs.length, 3);
  });

  await t.test("17. FAQ response contains only approved public fields and no internal fields", async () => {
    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);

    const faq = res.body.data.faqs[0];
    // Required public fields
    assert.ok(typeof faq.id === "string");
    assert.ok(typeof faq.question === "string");
    assert.ok(typeof faq.answer === "string");
    assert.ok(typeof faq.sortOrder === "number");

    // Strictly forbidden internal fields
    assert.strictEqual(faq.isActive, undefined);
    assert.strictEqual(faq.deletedAt, undefined);
    assert.strictEqual(faq.createdAt, undefined);
    assert.strictEqual(faq.updatedAt, undefined);
    assert.strictEqual(faq.productId, undefined);
    assert.strictEqual(faq.faqId, undefined);
    assert.strictEqual(faq.orderIndex, undefined);
  });

  await t.test("18. sortOrder is preserved accurately", async () => {
    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);

    const faqs = res.body.data.faqs;
    assert.strictEqual(faqs[0].sortOrder, 0);
    assert.strictEqual(faqs[1].sortOrder, 1);
    assert.strictEqual(faqs[2].sortOrder, 2);
  });

  await t.test("19. Existing Product response fields remain unchanged", async () => {
    const res = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    assert.strictEqual(res.status, 200);

    const product = res.body.data;
    assert.strictEqual(product.id, productAId);
    assert.strictEqual(product.name, "Pro Wireless ANC Headphones");
    assert.strictEqual(product.slug, "pro-wireless-anc-headphones");
    assert.strictEqual(product.price, 299.99);
    assert.strictEqual(product.description, "Studio quality headphones with active noise cancellation.");
    assert.strictEqual(product.shortDescription, "ANC Studio Headphones");
    assert.strictEqual(product.stock, 25);
    assert.strictEqual(product.inStock, true);
    assert.ok(Array.isArray(product.images));
    assert.ok(Array.isArray(product.variants));
    assert.ok(Array.isArray(product.tags));
  });

  await t.test("20. Existing global Storefront FAQ endpoint remains unchanged", async () => {
    const res = await request(app).get("/api/storefront/v1/faqs");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "success");
    assert.ok(Array.isArray(res.body.data));

    // Global FAQs endpoint returns active, non-archived FAQs (including unassigned ones)
    const returnedIds = res.body.data.map((f: any) => f.id);
    assert.ok(returnedIds.includes(unassignedFaqId), "Global FAQs includes unassigned FAQ");
    assert.ok(returnedIds.includes(faq1Id));
    assert.strictEqual(returnedIds.includes(inactiveFaqId), false, "Global FAQs excludes inactive");
    assert.strictEqual(returnedIds.includes(archivedFaqId), false, "Global FAQs excludes archived");
  });

  await t.test("21. Existing Storefront route alias (/api/v1/storefront/v1) returns identical Product FAQ data", async () => {
    const standardRes = await request(app).get("/api/storefront/v1/products/pro-wireless-anc-headphones");
    const aliasRes = await request(app).get("/api/v1/storefront/v1/products/pro-wireless-anc-headphones");

    assert.strictEqual(standardRes.status, 200);
    assert.strictEqual(aliasRes.status, 200);
    assert.deepStrictEqual(standardRes.body.data.faqs, aliasRes.body.data.faqs);
  });

  await t.test("22. Product list endpoint (GET /products) does not include FAQs, keeping list payloads lean", async () => {
    const res = await request(app).get("/api/storefront/v1/products");
    assert.strictEqual(res.status, 200);

    const items = res.body.data.items || res.body.data;
    assert.ok(Array.isArray(items));
    assert.ok(items.length > 0);

    // None of the list products should have the faqs property
    for (const item of items) {
      assert.strictEqual(item.faqs, undefined, `Product ${item.id} in list must not have faqs field`);
    }
  });
});
