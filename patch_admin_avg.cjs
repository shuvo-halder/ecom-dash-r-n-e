const fs = require('fs');
const file = 'src/backend/services/review.service.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /_avg: { rating: true }/,
  `_avg: { rating: true }, where: { status: "APPROVED" }`
);

fs.writeFileSync(file, content);
console.log("Patched admin stats avg rating");
