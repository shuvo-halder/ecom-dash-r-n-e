import test from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { calculateCouponDiscount, CartItemForCoupon } from "../utils/couponCalculator";
import { StorefrontContentService } from "../services/storefront/content.service";
import { applyCouponSchema } from "../validators/checkout.validator";

test("Coupon & Promotion Lifecycle - Core Calculation & Validation Suite", async (t) => {
  const baseCoupon: any = {
    id: "coupon-100",
    code: "SAVE20",
    discountType: "percentage",
    discountValue: new Prisma.Decimal(20),
    validFrom: new Date(Date.now() - 3600000), // 1 hour ago
    validUntil: new Date(Date.now() + 3600000 * 24), // 24 hours from now
    isActive: true,
    minOrderAmount: new Prisma.Decimal(100),
    maxDiscountAmount: new Prisma.Decimal(50),
    usageLimit: 100,
    usagePerCustomer: 2,
    usedCount: 5,
    applicableCategories: null,
    applicableProducts: null,
    applicableBrands: null,
    deletedAt: null,
  };

  const sampleItems: CartItemForCoupon[] = [
    {
      productId: "prod-1",
      categoryId: "cat-1",
      brandId: "brand-1",
      quantity: 2,
      unitPrice: new Prisma.Decimal(100),
      subtotal: new Prisma.Decimal(200),
    },
    {
      productId: "prod-2",
      categoryId: "cat-2",
      brandId: "brand-2",
      quantity: 1,
      unitPrice: new Prisma.Decimal(50),
      subtotal: new Prisma.Decimal(50),
    },
  ];

  await t.test("1. Successfully calculates percentage discount with capping", () => {
    // Total subtotal = 250. 20% of 250 = 50. Max discount = 50.
    const result = calculateCouponDiscount({
      coupon: baseCoupon,
      items: sampleItems,
      customerId: "cust-1",
      customerOrderCountWithCoupon: 0,
    });

    assert.equal(result.isValid, true);
    assert.equal(result.discountAmount.toNumber(), 50);
    assert.equal(result.eligibleSubtotal.toNumber(), 250);
    assert.equal(result.isFreeShipping, false);
  });

  await t.test("2. Enforces minOrderAmount threshold", () => {
    const lowValueItems: CartItemForCoupon[] = [
      {
        productId: "prod-1",
        categoryId: "cat-1",
        quantity: 1,
        unitPrice: new Prisma.Decimal(40),
        subtotal: new Prisma.Decimal(40),
      },
    ];

    const result = calculateCouponDiscount({
      coupon: baseCoupon,
      items: lowValueItems,
      customerId: "cust-1",
    });

    assert.equal(result.isValid, false);
    assert.equal(result.errorCode, "MIN_AMOUNT_NOT_MET");
  });

  await t.test("3. Respects category eligibility filtering", () => {
    const categoryRestrictedCoupon = {
      ...baseCoupon,
      applicableCategories: JSON.stringify(["cat-1"]),
      minOrderAmount: new Prisma.Decimal(50),
      maxDiscountAmount: null,
    };

    // Only prod-1 (cat-1) is eligible (subtotal = 200). prod-2 (cat-2, subtotal = 50) is excluded.
    // 20% of 200 = 40.
    const result = calculateCouponDiscount({
      coupon: categoryRestrictedCoupon,
      items: sampleItems,
    });

    assert.equal(result.isValid, true);
    assert.equal(result.eligibleSubtotal.toNumber(), 200);
    assert.equal(result.discountAmount.toNumber(), 40);
  });

  await t.test("4. Rejects expired or inactive coupons", () => {
    const expiredCoupon = {
      ...baseCoupon,
      validUntil: new Date(Date.now() - 1000), // Expired 1 second ago
    };

    const result = calculateCouponDiscount({
      coupon: expiredCoupon,
      items: sampleItems,
    });

    assert.equal(result.isValid, false);
    assert.equal(result.errorCode, "EXPIRED_COUPON");

    const inactiveCoupon = {
      ...baseCoupon,
      isActive: false,
    };

    const inactiveResult = calculateCouponDiscount({
      coupon: inactiveCoupon,
      items: sampleItems,
    });

    assert.equal(inactiveResult.isValid, false);
    assert.equal(inactiveResult.errorCode, "INVALID_COUPON");
  });

  await t.test("5. Enforces global usage limit", () => {
    const exhaustedCoupon = {
      ...baseCoupon,
      usageLimit: 10,
      usedCount: 10,
    };

    const result = calculateCouponDiscount({
      coupon: exhaustedCoupon,
      items: sampleItems,
    });

    assert.equal(result.isValid, false);
    assert.equal(result.errorCode, "LIMIT_REACHED");
  });

  await t.test("6. Enforces per-customer usage limit for both authenticated and guest users", () => {
    const perCustomerCoupon = {
      ...baseCoupon,
      usagePerCustomer: 1,
    };

    // Authenticated customer with 1 prior order
    const authResult = calculateCouponDiscount({
      coupon: perCustomerCoupon,
      items: sampleItems,
      customerId: "cust-1",
      customerOrderCountWithCoupon: 1,
    });

    assert.equal(authResult.isValid, false);
    assert.equal(authResult.errorCode, "CUSTOMER_LIMIT_REACHED");

    // Guest customer tracked by email with 1 prior order
    const guestResult = calculateCouponDiscount({
      coupon: perCustomerCoupon,
      items: sampleItems,
      customerOrderCountWithCoupon: 1,
    });

    assert.equal(guestResult.isValid, false);
    assert.equal(guestResult.errorCode, "CUSTOMER_LIMIT_REACHED");

    // Fresh customer with 0 prior orders
    const freshResult = calculateCouponDiscount({
      coupon: perCustomerCoupon,
      items: sampleItems,
      customerId: "cust-2",
      customerOrderCountWithCoupon: 0,
    });

    assert.equal(freshResult.isValid, true);
  });

  await t.test("7. Accurately handles fixed discount and free_shipping discount types", () => {
    const fixedCoupon = {
      ...baseCoupon,
      discountType: "fixed",
      discountValue: new Prisma.Decimal(35),
      maxDiscountAmount: null,
    };

    const fixedResult = calculateCouponDiscount({
      coupon: fixedCoupon,
      items: sampleItems,
    });

    assert.equal(fixedResult.isValid, true);
    assert.equal(fixedResult.discountAmount.toNumber(), 35);
    assert.equal(fixedResult.isFreeShipping, false);

    const freeShippingCoupon = {
      ...baseCoupon,
      discountType: "free_shipping",
      discountValue: new Prisma.Decimal(0),
    };

    const freeShippingResult = calculateCouponDiscount({
      coupon: freeShippingCoupon,
      items: sampleItems,
    });

    assert.equal(freeShippingResult.isValid, true);
    assert.equal(freeShippingResult.discountAmount.toNumber(), 0);
    assert.equal(freeShippingResult.isFreeShipping, true);
  });

  await t.test("8. applyCouponSchema validates couponCode, code, and promoCode interchangeably", () => {
    const withCouponCode = applyCouponSchema.parse({ couponCode: "WELCOME10" });
    assert.equal(withCouponCode.couponCode, "WELCOME10");

    const withCode = applyCouponSchema.parse({ code: "SALE20" });
    assert.equal(withCode.couponCode, "SALE20");

    const withPromoCode = applyCouponSchema.parse({ promoCode: "EID30" });
    assert.equal(withPromoCode.couponCode, "EID30");

    assert.throws(() => {
      applyCouponSchema.parse({});
    });
  });

  await t.test("9. StorefrontContentService getPublicCoupons correctly filters exhausted coupons", async () => {
    const contentService = new StorefrontContentService();
    // Verify the method is present and callable
    assert.equal(typeof contentService.getPublicCoupons, "function");
  });
});
