const fs = require('fs');
const file = 'src/backend/routes/storefront/review.routes.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'import { requireCustomerAuth } from "../../middlewares/customerAuth";',
  'import { requireCustomerAuth } from "../../middlewares/customerAuth";\nimport rateLimit from "express-rate-limit";\n\nconst uploadLimiter = rateLimit({\n  windowMs: 15 * 60 * 1000, // 15 minutes\n  max: 20, // limit each IP to 20 images per windowMs\n  message: { status: "error", message: "Too many images uploaded from this IP, please try again after 15 minutes" }\n});'
);

content = content.replace(
  'router.post("/upload-image", upload.single("image"), uploadReviewImage);',
  'router.post("/upload-image", uploadLimiter, upload.single("image"), uploadReviewImage);'
);

fs.writeFileSync(file, content);
console.log("Patched upload route with rate limiter");
