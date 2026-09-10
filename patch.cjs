const fs = require('fs');
const file = 'src/backend/services/storefront/review.service.ts';
let content = fs.readFileSync(file, 'utf8');

const newMethod = `

  static async getFeaturedReviews(limit: number = 5) {
    const maxLimit = Math.min(limit, 10);
    
    // Fetch minimal info for all eligible reviews
    const eligibleReviews = await prisma.review.findMany({
      where: { 
        status: "APPROVED",
        product: {
          isActive: true,
          status: "Active",
          deletedAt: null
        }
      },
      select: {
        id: true,
        productId: true
      }
    });

    if (eligibleReviews.length === 0) {
      return [];
    }

    // Group by product to ensure diversity
    const byProduct: Record<string, string[]> = {};
    for (const r of eligibleReviews) {
      if (!byProduct[r.productId]) byProduct[r.productId] = [];
      byProduct[r.productId].push(r.id);
    }

    // Shuffle arrays
    const shuffle = (array: any[]) => array.sort(() => 0.5 - Math.random());
    for (const productId in byProduct) {
      shuffle(byProduct[productId]);
    }

    // Pick up to maxLimit reviews, prioritizing different products
    const selectedIds: string[] = [];
    const productIds = Object.keys(byProduct);
    shuffle(productIds);

    let round = 0;
    while (selectedIds.length < maxLimit) {
      let addedInRound = false;
      for (const pid of productIds) {
        if (selectedIds.length >= maxLimit) break;
        if (byProduct[pid].length > round) {
          selectedIds.push(byProduct[pid][round]);
          addedInRound = true;
        }
      }
      if (!addedInRound) break; // Exhausted all reviews
      round++;
    }

    // Fetch full details for selected IDs
    const reviews = await prisma.review.findMany({
      where: { id: { in: selectedIds } },
      include: {
        images: true,
        product: {
          include: {
            images: {
              where: { isPrimary: true },
              take: 1
            }
          }
        }
      }
    });

    shuffle(reviews);
    
    return reviews.map(r => ({
      id: r.id,
      customerName: r.customerName || "Anonymous",
      rating: r.rating,
      headline: r.headline,
      comment: r.comment,
      createdAt: r.createdAt,
      isVerifiedPurchase: r.isVerifiedPurchase,
      images: r.images.map(img => img.url),
      product: {
        id: r.product.id,
        name: r.product.name,
        slug: r.product.slug,
        image: r.product.images[0]?.url || ""
      }
    }));
  }
`;

content = content.replace(/static async checkEligibility/, newMethod + '\  static async checkEligibility');
fs.writeFileSync(file, content);
