const fs = require('fs');
const file = 'src/backend/controllers/storefront/review.controller.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const page = Number(req.query.page) || 1;\n    const limit = Number(req.query.limit) || 10;',
  `let page = Number(req.query.page) || 1;
    if (page < 1 || isNaN(page)) page = 1;
    let limit = Number(req.query.limit) || 10;
    if (limit < 1 || isNaN(limit)) limit = 10;
    if (limit > 50) limit = 50;`
);

fs.writeFileSync(file, content);
console.log("Patched my reviews pagination");
