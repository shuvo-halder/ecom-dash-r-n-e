import test from "node:test";
import assert from "node:assert";
import { AppError } from "../utils/AppError";

test("Customer Reviews, Review-Eligibility & IDOR Protection Tests", async (t) => {
  // In-memory mock database state representing multiple customers, orders, order items, and reviews
  const customers = [
    { id: "customer-a-id", name: "Alice", email: "alice@example.com" },
    { id: "customer-b-id", name: "Bob", email: "bob@example.com" },
  ];

  const orders = [
    {
      id: "order-a-delivered-1",
      orderNumber: "ORD-A-001",
      customerId: "customer-a-id",
      status: "DELIVERED",
      deletedAt: null,
      createdAt: new Date("2026-08-01T10:00:00Z"),
    },
    {
      id: "order-a-delivered-2",
      orderNumber: "ORD-A-002",
      customerId: "customer-a-id",
      status: "Delivered",
      deletedAt: null,
      createdAt: new Date("2026-08-05T10:00:00Z"),
    },
    {
      id: "order-a-pending",
      orderNumber: "ORD-A-003",
      customerId: "customer-a-id",
      status: "PROCESSING",
      deletedAt: null,
      createdAt: new Date("2026-08-10T10:00:00Z"),
    },
    {
      id: "order-b-delivered",
      orderNumber: "ORD-B-001",
      customerId: "customer-b-id",
      status: "COMPLETED",
      deletedAt: null,
      createdAt: new Date("2026-08-02T10:00:00Z"),
    },
  ];

  const products = [
    {
      id: "prod-headphones-1",
      name: "Wireless Headphones",
      slug: "wireless-headphones",
      images: [{ url: "https://example.com/headphones.jpg" }],
    },
    {
      id: "prod-keyboard-2",
      name: "Mechanical Keyboard",
      slug: "mechanical-keyboard",
      images: [{ url: "https://example.com/keyboard.jpg" }],
    },
  ];

  let orderItems = [
    {
      id: "item-a-headphones-1",
      orderId: "order-a-delivered-1",
      productId: "prod-headphones-1",
      quantity: 1,
      price: 1500,
      variantSku: "SKU-HP-BLK",
      review: null as any,
    },
    {
      id: "item-a-headphones-2",
      orderId: "order-a-delivered-2",
      productId: "prod-headphones-1",
      quantity: 1,
      price: 1500,
      variantSku: "SKU-HP-WHT",
      review: null as any,
    },
    {
      id: "item-a-pending-item",
      orderId: "order-a-pending",
      productId: "prod-keyboard-2",
      quantity: 1,
      price: 3000,
      variantSku: "SKU-KB-RGB",
      review: null as any,
    },
    {
      id: "item-b-keyboard-1",
      orderId: "order-b-delivered",
      productId: "prod-keyboard-2",
      quantity: 1,
      price: 3000,
      variantSku: "SKU-KB-RGB",
      review: null as any,
    },
  ];

  let reviews: any[] = [];

  // Service helper implementation simulating StorefrontReviewService logic
  const mockReviewService = {
    getMyReviews(customerId: string, page = 1, limit = 10) {
      const userReviews = reviews.filter((r) => r.customerId === customerId);
      const skip = (page - 1) * limit;
      const paginated = userReviews.slice(skip, skip + limit);
      return {
        reviews: paginated.map((r) => {
          const prod = products.find((p) => p.id === r.productId);
          return {
            id: r.id,
            productId: r.productId,
            productName: prod?.name || null,
            productSlug: prod?.slug || null,
            productImage: prod?.images[0]?.url || null,
            orderItemId: r.orderItemId,
            rating: r.rating,
            headline: r.headline,
            comment: r.comment,
            createdAt: r.createdAt,
            status: r.status,
            isVerifiedPurchase: r.isVerifiedPurchase,
            images: r.images || [],
          };
        }),
        pagination: {
          page,
          limit,
          total: userReviews.length,
          totalPages: Math.ceil(userReviews.length / limit) || 1,
        },
      };
    },

    getEligibleReviews(customerId: string) {
      const eligibleItems = orderItems.filter((item) => {
        const order = orders.find((o) => o.id === item.orderId);
        if (!order || order.customerId !== customerId) return false;
        const isDelivered = ["Delivered", "DELIVERED", "Completed", "COMPLETED"].includes(order.status);
        return isDelivered && !item.review;
      });

      return eligibleItems.map((item) => {
        const order = orders.find((o) => o.id === item.orderId)!;
        const prod = products.find((p) => p.id === item.productId)!;
        return {
          orderItemId: item.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          productId: prod.id,
          productName: prod.name,
          productSlug: prod.slug,
          productImage: prod.images[0]?.url || null,
          variantSku: item.variantSku,
          purchaseDate: order.createdAt,
          quantity: item.quantity,
          price: item.price,
        };
      });
    },

    submitAuthenticatedReview(
      payload: {
        productId?: string;
        orderItemId?: string;
        rating: number;
        headline?: string | null;
        comment?: string | null;
        images?: string[];
      },
      customerId: string
    ) {
      if (payload.rating < 1 || payload.rating > 5) {
        throw new AppError("Rating must be between 1 and 5", 400, "INVALID_RATING");
      }

      let qualifyingItem: any = null;

      if (payload.orderItemId) {
        const item = orderItems.find((i) => i.id === payload.orderItemId);
        if (!item) {
          throw new AppError("Order item not found", 404, "ORDER_ITEM_NOT_FOUND");
        }

        const order = orders.find((o) => o.id === item.orderId);
        if (!order || order.customerId !== customerId) {
          throw new AppError("You do not own this order item", 403, "FORBIDDEN");
        }

        if (payload.productId && item.productId !== payload.productId) {
          throw new AppError("Product ID does not match order item", 400, "PRODUCT_MISMATCH");
        }

        const isDelivered = ["Delivered", "DELIVERED", "Completed", "COMPLETED"].includes(order.status);
        if (!isDelivered) {
          throw new AppError(
            "Order must be delivered before submitting a review",
            403,
            "PURCHASE_REQUIRED"
          );
        }

        if (item.review) {
          throw new AppError("This purchase has already been reviewed", 409, "ALREADY_REVIEWED");
        }

        qualifyingItem = item;
      } else {
        const productId = payload.productId!;
        const customerItems = orderItems.filter((i) => {
          const order = orders.find((o) => o.id === i.orderId);
          return i.productId === productId && order && order.customerId === customerId;
        });

        if (customerItems.length === 0) {
          throw new AppError(
            "Please purchase this product before submitting a review",
            403,
            "PURCHASE_REQUIRED"
          );
        }

        const deliveredItems = customerItems.filter((i) => {
          const order = orders.find((o) => o.id === i.orderId);
          return order && ["Delivered", "DELIVERED", "Completed", "COMPLETED"].includes(order.status);
        });

        if (deliveredItems.length === 0) {
          throw new AppError(
            "Order must be delivered before submitting a review",
            403,
            "PURCHASE_REQUIRED"
          );
        }

        const unreviewedItem = deliveredItems.find((i) => !i.review);
        if (!unreviewedItem) {
          throw new AppError("This purchase has already been reviewed", 409, "ALREADY_REVIEWED");
        }

        qualifyingItem = unreviewedItem;
      }

      const reviewId = `rev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const newReview = {
        id: reviewId,
        productId: qualifyingItem.productId,
        orderItemId: qualifyingItem.id,
        customerId,
        rating: payload.rating,
        headline: payload.headline || null,
        comment: payload.comment || "",
        status: "PENDING",
        isVerifiedPurchase: true,
        isApproved: false,
        createdAt: new Date(),
        images: payload.images || [],
      };

      reviews.push(newReview);
      qualifyingItem.review = newReview;

      return newReview;
    },
  };

  await t.test("GET /customer/reviews/eligible should return all unreviewed delivered items for customer A", () => {
    const eligible = mockReviewService.getEligibleReviews("customer-a-id");
    assert.strictEqual(eligible.length, 2, "Customer A should have 2 eligible review items");
    const itemIds = eligible.map(e => e.orderItemId);
    assert.ok(itemIds.includes("item-a-headphones-1"));
    assert.ok(itemIds.includes("item-a-headphones-2"));
  });

  await t.test("POST /customer/reviews should successfully submit a review for customer A's delivered item", () => {
    const review = mockReviewService.submitAuthenticatedReview(
      {
        orderItemId: "item-a-headphones-1",
        rating: 5,
        headline: "Amazing headphones!",
        comment: "Great sound quality and battery life.",
        images: ["https://example.com/review1.jpg"],
      },
      "customer-a-id"
    );

    assert.ok(review.id);
    assert.strictEqual(review.orderItemId, "item-a-headphones-1");
    assert.strictEqual(review.rating, 5);
    assert.strictEqual(review.status, "PENDING");
    assert.strictEqual(review.images.length, 1);
  });

  await t.test("GET /customer/reviews/eligible should reflect consumed entitlement", () => {
    const eligible = mockReviewService.getEligibleReviews("customer-a-id");
    assert.strictEqual(eligible.length, 1, "Customer A should now have only 1 eligible item remaining");
    assert.strictEqual(eligible[0].orderItemId, "item-a-headphones-2");
  });

  await t.test("IDOR Test: Customer B cannot submit review for Customer A's order item", () => {
    assert.throws(
      () => {
        mockReviewService.submitAuthenticatedReview(
          {
            orderItemId: "item-a-headphones-2",
            rating: 4,
            comment: "I don't own this but trying to review",
          },
          "customer-b-id"
        );
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "FORBIDDEN");
        return true;
      }
    );
  });

  await t.test("Duplicate Review Test: Submitting a second review on the same order item throws 409", () => {
    assert.throws(
      () => {
        mockReviewService.submitAuthenticatedReview(
          {
            orderItemId: "item-a-headphones-1",
            rating: 4,
            comment: "Attempting duplicate review",
          },
          "customer-a-id"
        );
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 409);
        assert.strictEqual(err.code, "ALREADY_REVIEWED");
        return true;
      }
    );
  });

  await t.test("Non-Delivered Order Test: Submitting a review for a non-delivered order item throws 403", () => {
    assert.throws(
      () => {
        mockReviewService.submitAuthenticatedReview(
          {
            orderItemId: "item-a-pending-item",
            rating: 5,
            comment: "Review before delivery",
          },
          "customer-a-id"
        );
      },
      (err: any) => {
        assert.strictEqual(err.statusCode, 403);
        assert.strictEqual(err.code, "PURCHASE_REQUIRED");
        return true;
      }
    );
  });

  await t.test("Multiple Purchases Test: Second delivered purchase of same product can be reviewed separately", () => {
    const review2 = mockReviewService.submitAuthenticatedReview(
      {
        orderItemId: "item-a-headphones-2",
        rating: 4,
        headline: "Second pair bought for my friend",
        comment: "Equally good quality.",
      },
      "customer-a-id"
    );

    assert.ok(review2.id);
    assert.strictEqual(review2.orderItemId, "item-a-headphones-2");

    const eligibleAfterBoth = mockReviewService.getEligibleReviews("customer-a-id");
    assert.strictEqual(eligibleAfterBoth.length, 0, "All eligible items consumed");
  });

  await t.test("GET /customer/reviews should return all submitted reviews for customer A with pagination", () => {
    const myReviews = mockReviewService.getMyReviews("customer-a-id");
    assert.strictEqual(myReviews.reviews.length, 2);
    assert.strictEqual(myReviews.pagination.total, 2);
    assert.strictEqual(myReviews.reviews[0].orderItemId, "item-a-headphones-1");
  });
});
