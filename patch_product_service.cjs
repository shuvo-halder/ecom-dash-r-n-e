const fs = require('fs');
let code = fs.readFileSync('src/backend/services/storefront/product.service.ts', 'utf8');

const helper = `
  private async _attachReviewStats(products: StorefrontProduct[]): Promise<StorefrontProduct[]> {
    if (products.length === 0) return products;
    
    const productIds = products.map(p => p.id);
    const reviewAggregates = await prisma.review.groupBy({
      by: ['productId', 'rating'],
      where: { productId: { in: productIds }, status: "APPROVED" },
      _count: {
        id: true,
      }
    });

    const reviewsStatsByProduct: Record<string, { totalRating: number, count: number }> = {};
    for (const pid of productIds) {
      reviewsStatsByProduct[pid] = { totalRating: 0, count: 0 };
    }

    reviewAggregates.forEach(agg => {
      const pid = agg.productId;
      if (reviewsStatsByProduct[pid]) {
        reviewsStatsByProduct[pid].count += agg._count.id;
        reviewsStatsByProduct[pid].totalRating += (agg.rating * agg._count.id);
      }
    });

    return products.map(product => {
      const stats = reviewsStatsByProduct[product.id];
      const rating = stats.count > 0 ? Number((stats.totalRating / stats.count).toFixed(1)) : 0;
      return {
        ...product,
        rating,
        reviewCount: stats.count
      };
    });
  }
`;

// Insert the helper at the beginning of the class
code = code.replace('export class StorefrontProductService {', 'export class StorefrontProductService {' + helper);

// In getProducts
const getProductsReturn = `    const mappedProducts = products.map(mapProductToStorefrontDTO);

    return {
      data: mappedProducts,`;
const getProductsReturnReplace = `    const mappedProducts = products.map(mapProductToStorefrontDTO);
    const mappedWithStats = await this._attachReviewStats(mappedProducts);

    return {
      data: mappedWithStats,`;

code = code.replace(getProductsReturn, getProductsReturnReplace);

// In getProductBySlug
const getBySlugReturn = `    return mapProductToStorefrontDTO(product);
  }`;
const getBySlugReturnReplace = `    const mappedProduct = mapProductToStorefrontDTO(product);
    const [mappedWithStats] = await this._attachReviewStats([mappedProduct]);
    return mappedWithStats;
  }`;

code = code.replace(getBySlugReturn, getBySlugReturnReplace);

fs.writeFileSync('src/backend/services/storefront/product.service.ts', code);
console.log("product.service.ts patched.");
