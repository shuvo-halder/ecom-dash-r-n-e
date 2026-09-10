const fs = require('fs');
const file = 'src/backend/routes/storefront/review.routes.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /import \{ getProductReviews, checkEligibility, submitReview \} from "\.\.\/\.\.\/controllers\/storefront\/review\.controller";/,
  'import { getProductReviews, checkEligibility, submitReview, getFeaturedReviews } from "../../controllers/storefront/review.controller";'
);

content = content.replace(
  /import \{ createReviewSchema \} from "\.\.\/\.\.\/validators\/review\.validator";/,
  'import { createReviewSchema, getFeaturedReviewsQuerySchema } from "../../validators/review.validator";\nimport { validateQuery } from "../../middlewares/validation";'
);

content = content.replace(
  /router\.get\("\/:productId", getProductReviews\);/,
  'router.get("/featured", validateQuery(getFeaturedReviewsQuerySchema), getFeaturedReviews);\n\nrouter.get("/:productId", getProductReviews);'
);

fs.writeFileSync(file, content);
