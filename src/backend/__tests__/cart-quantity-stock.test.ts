import test from "node:test";
import assert from "node:assert";
import request from "supertest";
import express from "express";

import cartRouter from "../routes/storefront/cart.routes";
import { errorHandler } from "../middlewares/errorHandler";
import { prisma } from "../config/db";
import { StorefrontCartService } from "../services/storefront/cart.service";
import { AppError } from "../utils/AppError";

const app = express();
app.use(express.json());

const storefrontRouter = express.Router();
storefrontRouter.use("/cart", cartRouter);
app.use("/api/storefront/v1", storefrontRouter);
app.use(errorHandler);

test("Storefront Cart Quantity Stock Regression Suite", async (t) => {
  // Store backup of original Prisma functions
  const origProductFindFirst = prisma.product.findFirst;
  const origProductVariantFindFirst = prisma.productVariant.findFirst;
  const origCartFindFirst = prisma.cart.findFirst;
  const origCartCreate = prisma.cart.create;
  const origCartUpdate = prisma.cart.update;
  const origCartItemFindFirst = prisma.cartItem.findFirst;
  const origCartItemCreate = prisma.cartItem.create;
  const origCartItemUpdate = prisma.cartItem.update;
  const origCartItemDeleteMany = prisma.cartItem.deleteMany;
  const origTransaction = prisma.$transaction;

  // In-memory data store for the test suite
  let carts: any[] = [];
  let cartItems: any[] = [];

  const product1Id = "11111111-1111-4111-8111-111111111111";
  const variant1Id = "22222222-2222-4222-8222-222222222222";
  const cartItem1Id = "33333333-3333-4333-8333-333333333333";

  const product2Id = "44444444-4444-4444-8444-444444444444";
  const variant2Id = "55555555-5555-4555-8555-555555555555";
  const cartItem2Id = "66666666-6666-4666-8666-666666666666";

  const products: Record<string, any> = {
    [product1Id]: {
      id: product1Id,
      name: "Standard Product with Product Stock",
      slug: "prod-single-stock",
      price: 50.0,
      categoryId: "cat-1",
      brandId: "brand-1",
      isActive: true,
      status: "Active",
      deletedAt: null,
      trackInventory: true,
      images: [{ url: "https://example.com/p1.jpg", altText: "Product 1" }],
      inventory: {
        id: "aaaaaaaa-1111-4111-8111-111111111111",
        productId: product1Id,
        variantId: null,
        quantityAvailable: 10,
        quantityReserved: 0,
        lowStockThreshold: 2,
      },
    },
    [product2Id]: {
      id: product2Id,
      name: "Variant Product with Dedicated Stock",
      slug: "prod-variant-stock",
      price: 80.0,
      categoryId: "cat-1",
      brandId: "brand-1",
      isActive: true,
      status: "Active",
      deletedAt: null,
      trackInventory: true,
      images: [{ url: "https://example.com/p2.jpg", altText: "Product 2" }],
      inventory: null,
    },
  };

  const variants: Record<string, any> = {
    [variant1Id]: {
      id: variant1Id,
      productId: product1Id,
      sku: "SKU-DEFAULT-VAR",
      price: 50.0,
      compareAtPrice: null,
      isActive: true,
      deletedAt: null,
      inventories: [], // Empty inventories list on default variant!
    },
    [variant2Id]: {
      id: variant2Id,
      productId: product2Id,
      sku: "SKU-DEDICATED-VAR",
      price: 80.0,
      compareAtPrice: null,
      isActive: true,
      deletedAt: null,
      inventories: [
        {
          id: "bbbbbbbb-2222-4222-8222-222222222222",
          productId: null,
          variantId: variant2Id,
          quantityAvailable: 5,
          quantityReserved: 0,
          lowStockThreshold: 1,
        },
      ],
    },
  };

  t.before(() => {
    // Setup in-memory mock handlers
    (prisma.product.findFirst as any) = async ({ where }: any) => {
      const prod = products[where?.id];
      if (prod && !prod.deletedAt && prod.isActive && prod.status === "Active") {
        return { ...prod };
      }
      return null;
    };

    (prisma.productVariant.findFirst as any) = async ({ where }: any) => {
      const v = variants[where?.id];
      if (v && (!where.productId || v.productId === where.productId) && !v.deletedAt && v.isActive) {
        return { ...v };
      }
      return null;
    };

    (prisma.cart.findFirst as any) = async ({ where }: any) => {
      const cart = carts.find((c) => {
        if (where.customerId) return c.customerId === where.customerId;
        if (where.sessionId) return c.sessionId === where.sessionId;
        if (where.id) return c.id === where.id;
        return false;
      });
      if (!cart) return null;

      const items = cartItems
        .filter((ci) => ci.cartId === cart.id)
        .map((ci) => ({
          ...ci,
          product: products[ci.productId],
          variant: ci.variantId ? variants[ci.variantId] : null,
        }));

      return {
        ...cart,
        items,
      };
    };

    (prisma.cart.create as any) = async ({ data }: any) => {
      const newCart = {
        id: `77777777-7777-4777-8777-${Date.now().toString().slice(-12).padStart(12, "0")}`,
        customerId: data.customerId || null,
        sessionId: data.sessionId || null,
        couponId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      carts.push(newCart);
      return { ...newCart, items: [] };
    };

    (prisma.cart.update as any) = async ({ where, data }: any) => {
      const cart = carts.find((c) => c.id === where.id);
      if (cart) {
        Object.assign(cart, data);
        return { ...cart };
      }
      return null;
    };

    (prisma.cartItem.findFirst as any) = async ({ where }: any) => {
      const ci = cartItems.find((item) => {
        if (where.id && item.id !== where.id) return false;
        if (where.cartId && item.cartId !== where.cartId) return false;
        if (where.productId && item.productId !== where.productId) return false;
        if (where.variantId !== undefined && item.variantId !== where.variantId) return false;
        return true;
      });

      if (!ci) return null;

      return {
        ...ci,
        product: products[ci.productId],
        variant: ci.variantId ? variants[ci.variantId] : null,
      };
    };

    (prisma.cartItem.update as any) = async ({ where, data }: any) => {
      const ci = cartItems.find((item) => item.id === where.id);
      if (ci) {
        Object.assign(ci, data);
        return { ...ci };
      }
      return null;
    };

    (prisma.cartItem.deleteMany as any) = async () => ({ count: 0 });

    let itemSeq = 0;
    (prisma.$transaction as any) = async (cb: any) => {
      const tx = {
        cart: {
          findFirst: prisma.cart.findFirst,
          create: prisma.cart.create,
          update: prisma.cart.update,
        },
        cartItem: {
          findFirst: prisma.cartItem.findFirst,
          create: async ({ data }: any) => {
            itemSeq++;
            const itemId = itemSeq === 1 ? cartItem1Id : cartItem2Id;
            const newCartItem = {
              id: itemId,
              cartId: data.cartId,
              productId: data.productId,
              variantId: data.variantId || null,
              quantity: data.quantity,
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            cartItems.push(newCartItem);
            return { ...newCartItem };
          },
          update: prisma.cartItem.update,
        },
      };
      return await cb(tx);
    };
  });

  t.after(() => {
    // Restore original Prisma functions
    prisma.product.findFirst = origProductFindFirst;
    prisma.productVariant.findFirst = origProductVariantFindFirst;
    prisma.cart.findFirst = origCartFindFirst;
    prisma.cart.create = origCartCreate;
    prisma.cart.update = origCartUpdate;
    prisma.cartItem.findFirst = origCartItemFindFirst;
    prisma.cartItem.create = origCartItemCreate;
    prisma.cartItem.update = origCartItemUpdate;
    prisma.cartItem.deleteMany = origCartItemDeleteMany;
    prisma.$transaction = origTransaction;
  });

  const sharedSessionId = "session-test-regression-1";

  await t.test("Test 1 — Product-level inventory + default variant (quantity update 1 -> 2)", async () => {
    // 1. Add quantity 1 to cart
    const addRes = await request(app)
      .post("/api/storefront/v1/cart/items")
      .set("x-cart-session-id", sharedSessionId)
      .send({
        productId: product1Id,
        variantId: variant1Id,
        quantity: 1,
      });

    assert.strictEqual(addRes.status, 200, `Add to cart failed: ${JSON.stringify(addRes.body)}`);
    assert.strictEqual(addRes.body.status, "success");
    const items = addRes.body.data.cart.items;
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].quantity, 1);
    assert.strictEqual(items[0].id, cartItem1Id);

    // 2. Update quantity 1 -> 2
    const updateRes = await request(app)
      .put(`/api/storefront/v1/cart/items/${cartItem1Id}`)
      .set("x-cart-session-id", sharedSessionId)
      .send({ quantity: 2 });

    assert.strictEqual(
      updateRes.status,
      200,
      `Updating 1 -> 2 failed: ${JSON.stringify(updateRes.body)}`
    );
    assert.strictEqual(updateRes.body.status, "success");

    const updatedItem = updateRes.body.data.cart.items.find((i: any) => i.id === cartItem1Id);
    assert.ok(updatedItem, "Cart item should be returned in updated cart");
    assert.strictEqual(updatedItem.quantity, 2, "Cart item quantity must be 2");
  });

  await t.test("Test 2 — Decrement (quantity update 2 -> 1)", async () => {
    // Starting from quantity 2, decrement 2 -> 1
    const decRes = await request(app)
      .put(`/api/storefront/v1/cart/items/${cartItem1Id}`)
      .set("x-cart-session-id", sharedSessionId)
      .send({ quantity: 1 });

    assert.strictEqual(decRes.status, 200, `Decrement failed: ${JSON.stringify(decRes.body)}`);
    assert.strictEqual(decRes.body.status, "success");

    const decItem = decRes.body.data.cart.items.find((i: any) => i.id === cartItem1Id);
    assert.ok(decItem);
    assert.strictEqual(decItem.quantity, 1, "Cart item quantity must be 1");
  });

  await t.test("Test 3 — Real stock limit (exceeding stock 10 with quantity 11)", async () => {
    // 1. Verify direct service invocation throws AppError with INSUFFICIENT_STOCK
    try {
      await StorefrontCartService.updateItem({ sessionId: sharedSessionId }, cartItem1Id, 11);
      assert.fail("Should have thrown INSUFFICIENT_STOCK error");
    } catch (err: any) {
      assert.ok(err instanceof AppError, "Should be an AppError instance");
      assert.strictEqual(err.statusCode, 409, "Should have status 409");
      assert.strictEqual(err.code, "INSUFFICIENT_STOCK", "Error code must be INSUFFICIENT_STOCK");
      assert.strictEqual(
        err.message,
        "Insufficient stock available. In stock: 10, Requested: 11",
        "Message must report actual stock 10 and requested 11"
      );
    }

    // 2. Verify HTTP endpoint also returns 409 Conflict with proper message
    const exceedRes = await request(app)
      .put(`/api/storefront/v1/cart/items/${cartItem1Id}`)
      .set("x-cart-session-id", sharedSessionId)
      .send({ quantity: 11 });

    assert.strictEqual(exceedRes.status, 409, "HTTP endpoint should return 409 Conflict");
    assert.strictEqual(
      exceedRes.body.message,
      "Insufficient stock available. In stock: 10, Requested: 11",
      "Message must accurately report product stock of 10 and requested quantity 11"
    );
  });

  await t.test("Test 4 — Variant-level inventory regression (variant with dedicated stock = 5)", async () => {
    const varSessionId = "session-test-variant-stock";

    // 1. Add quantity 1 to cart for product with dedicated variant stock (stock = 5)
    const addRes = await request(app)
      .post("/api/storefront/v1/cart/items")
      .set("x-cart-session-id", varSessionId)
      .send({
        productId: product2Id,
        variantId: variant2Id,
        quantity: 1,
      });

    assert.strictEqual(addRes.status, 200);
    const varCartItemId = addRes.body.data.cart.items[0].id;
    assert.strictEqual(varCartItemId, cartItem2Id);

    // 2. Update quantity to 4 (<= 5) should succeed
    const validRes = await request(app)
      .put(`/api/storefront/v1/cart/items/${varCartItemId}`)
      .set("x-cart-session-id", varSessionId)
      .send({ quantity: 4 });

    assert.strictEqual(validRes.status, 200);
    assert.strictEqual(validRes.body.data.cart.items[0].quantity, 4);

    // 3. Verify direct service throws INSUFFICIENT_STOCK with stock 5
    try {
      await StorefrontCartService.updateItem({ sessionId: varSessionId }, varCartItemId, 6);
      assert.fail("Should have thrown INSUFFICIENT_STOCK");
    } catch (err: any) {
      assert.strictEqual(err.statusCode, 409);
      assert.strictEqual(err.code, "INSUFFICIENT_STOCK");
      assert.strictEqual(
        err.message,
        "Insufficient stock available. In stock: 5, Requested: 6"
      );
    }

    // 4. Update quantity to 6 (> 5) via HTTP should fail with 409 and report available stock 5
    const exceedRes = await request(app)
      .put(`/api/storefront/v1/cart/items/${varCartItemId}`)
      .set("x-cart-session-id", varSessionId)
      .send({ quantity: 6 });

    assert.strictEqual(exceedRes.status, 409);
    assert.strictEqual(
      exceedRes.body.message,
      "Insufficient stock available. In stock: 5, Requested: 6"
    );
  });
});
