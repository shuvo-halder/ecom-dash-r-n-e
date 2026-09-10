const fs = require('fs');
const file = 'src/backend/services/storefront/review.service.ts';
let content = fs.readFileSync(file, 'utf8');

// In getProductReviews
content = content.replace(/isVerifiedPurchase: r\.isVerifiedPurchase,\n\s*images: r\.images/g, 'isVerifiedPurchase: r.isVerifiedPurchase,\n        adminResponse: r.adminResponse,\n        images: r.images');

// In getFeaturedReviews
content = content.replace(/isVerifiedPurchase: r\.isVerifiedPurchase,\n\s*images: r\.images/g, 'isVerifiedPurchase: r.isVerifiedPurchase,\n      adminResponse: r.adminResponse,\n      images: r.images');

// In getMyReviews
content = content.replace(/isVerifiedPurchase: r\.isVerifiedPurchase,\n\s*images: r\.images/g, 'isVerifiedPurchase: r.isVerifiedPurchase,\n        adminResponse: r.adminResponse,\n        images: r.images');

fs.writeFileSync(file, content);
console.log("Updated storefront review.service.ts");
