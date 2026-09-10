const fs = require('fs');
let file = fs.readFileSync('src/pages/admin/reviews/ReviewsList.tsx', 'utf8');
file = file.replace('to Math.min(page * 10, data.pagination.total) of', 'to {Math.min(page * 10, data.pagination.total)} of');
fs.writeFileSync('src/pages/admin/reviews/ReviewsList.tsx', file);
