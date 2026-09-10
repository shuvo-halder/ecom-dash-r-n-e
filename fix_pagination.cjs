const fs = require('fs');
const file = 'src/backend/controllers/storefront/review.controller.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace('const page = Number(req.query.page) || 1;', 'let page = Number(req.query.page) || 1;\n    if (page < 1 || isNaN(page)) page = 1;');
content = content.replace('const limit = Number(req.query.limit) || 10;', 'let limit = Number(req.query.limit) || 10;\n    if (limit < 1 || isNaN(limit)) limit = 10;\n    if (limit > 50) limit = 50;');

fs.writeFileSync(file, content);

const file2 = 'src/backend/services/review.service.ts';
let content2 = fs.readFileSync(file2, 'utf8');
content2 = content2.replace('const { page = 1, limit = 20,', 'let { page = 1, limit = 20,');
content2 = content2.replace('const skip = (Number(page) - 1) * Number(limit);', 'page = Number(page); limit = Number(limit);\n    if (isNaN(page) || page < 1) page = 1;\n    if (isNaN(limit) || limit < 1) limit = 20;\n    if (limit > 100) limit = 100;\n    const skip = (page - 1) * limit;');

fs.writeFileSync(file2, content2);
console.log("Fixed pagination");
