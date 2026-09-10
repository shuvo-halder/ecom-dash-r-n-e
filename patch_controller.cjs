const fs = require('fs');
const file = 'src/backend/controllers/storefront/review.controller.ts';
let content = fs.readFileSync(file, 'utf8');

const newController = `

export const getFeaturedReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Number(req.query.limit) || 5;
    const result = await StorefrontReviewService.getFeaturedReviews(limit);
    res.json({ status: "success", data: result });
  } catch (error) {
    next(error);
  }
};

export const getProductReviews`;

content = content.replace(/export const getProductReviews/, newController);
fs.writeFileSync(file, content);
