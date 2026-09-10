const fs = require('fs');
const file = 'src/backend/services/review.service.ts';
let code = fs.readFileSync(file, 'utf8');

const target = `  static async listReviews(query: any) {
    const { page = 1, limit = 20, status, productId, rating } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (productId) where.productId = productId;
    if (rating) where.rating = Number(rating);

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          product: { select: { name: true, slug: true } },
          images: true
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit)
      }),
      prisma.review.count({ where })
    ]);`;

const replacement = `  static async listReviews(query: any) {
    const { page = 1, limit = 20, status, productId, rating, keyword, isVerifiedPurchase, startDate, endDate } = query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    if (status) where.status = status;
    if (productId) where.productId = productId;
    if (rating) where.rating = Number(rating);
    if (isVerifiedPurchase !== undefined && isVerifiedPurchase !== "") {
      where.isVerifiedPurchase = isVerifiedPurchase === "true" || isVerifiedPurchase === true;
    }
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) where.createdAt.lte = new Date(endDate as string);
    }
    if (keyword) {
      where.OR = [
        { customerName: { contains: String(keyword), mode: "insensitive" } },
        { customerEmail: { contains: String(keyword), mode: "insensitive" } },
        { headline: { contains: String(keyword), mode: "insensitive" } },
        { comment: { contains: String(keyword), mode: "insensitive" } }
      ];
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        include: {
          product: { select: { name: true, slug: true } },
          images: true
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: Number(limit)
      }),
      prisma.review.count({ where })
    ]);`;

code = code.replace(target, replacement);
fs.writeFileSync(file, code);
