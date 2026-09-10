const fs = require('fs');
const file = 'src/backend/routes/review.routes.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('updateReviewStatus,', 'updateReviewStatus,\n  updateAdminResponse,');
content = content.replace('router.put("/:id/status", requirePermission("Products", "write"), updateReviewStatus);', 'router.put("/:id/status", requirePermission("Products", "write"), updateReviewStatus);\nrouter.put("/:id/response", requirePermission("Products", "write"), updateAdminResponse);');

fs.writeFileSync(file, content);
console.log("Updated review.routes.ts");
