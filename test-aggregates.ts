import { StorefrontProductService } from "./src/backend/services/storefront/product.service";
import { prisma } from "./src/backend/config/db";

async function run() {
  console.log("Seeding test data...");

  // 1. Create product A (no reviews)
  const productA = await prisma.product.create({
    data: {
      name: "Product A",
      slug: "product-a",
      categoryId: (await prisma.category.findFirst())?.id || (await prisma.category.create({ data: { name: "Test Category", slug: "test-cat" } })).id,
    }
  });

  // 2. Create product B (approved reviews only)
  const productB = await prisma.product.create({
    data: {
      name: "Product B",
      slug: "product-b",
      categoryId: (await prisma.category.findFirst())?.id,
    }
  });
  
  await prisma.review.createMany({
    data: [
      { productId: productB.id, rating: 5, status: "APPROVED" },
      { productId: productB.id, rating: 4, status: "APPROVED" }
    ]
  });

  // 3. Create product C (approved, pending, rejected)
  const productC = await prisma.product.create({
    data: {
      name: "Product C",
      slug: "product-c",
      categoryId: (await prisma.category.findFirst())?.id,
    }
  });

  await prisma.review.createMany({
    data: [
      { productId: productC.id, rating: 2, status: "APPROVED" },
      { productId: productC.id, rating: 1, status: "PENDING" },
      { productId: productC.id, rating: 5, status: "REJECTED" },
      { productId: productC.id, rating: 3, status: "HIDDEN" }
    ]
  });

  const svc = new StorefrontProductService();

  console.log("\\nTesting getProducts...");
  const paginated = await svc.getProducts({});
  const pA = paginated.data.find(p => p.id === productA.id);
  const pB = paginated.data.find(p => p.id === productB.id);
  const pC = paginated.data.find(p => p.id === productC.id);

  console.log(`Product A: rating=\${pA?.rating}, reviewCount=\${pA?.reviewCount}`); // Expected: 0, 0
  console.log(`Product B: rating=\${pB?.rating}, reviewCount=\${pB?.reviewCount}`); // Expected: 4.5, 2
  console.log(`Product C: rating=\${pC?.rating}, reviewCount=\${pC?.reviewCount}`); // Expected: 2, 1

  if (pA?.rating !== 0 || pA?.reviewCount !== 0) throw new Error("Product A failed");
  if (pB?.rating !== 4.5 || pB?.reviewCount !== 2) throw new Error("Product B failed");
  if (pC?.rating !== 2 || pC?.reviewCount !== 1) throw new Error("Product C failed");

  console.log("\\nTesting getProductBySlug...");
  const slugB = await svc.getProductBySlug("product-b");
  console.log(`Product B Detail: rating=\${slugB?.rating}, reviewCount=\${slugB?.reviewCount}`); // Expected: 4.5, 2
  
  if (slugB?.rating !== 4.5 || slugB?.reviewCount !== 2) throw new Error("Product B Detail failed");

  console.log("\\nAll tests passed!");
}

run().catch(console.error).finally(() => process.exit(0));
