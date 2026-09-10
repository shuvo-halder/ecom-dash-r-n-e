const fs = require('fs');
const file = 'src/backend/services/review.service.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'return { total, pending, approved, rejected, hidden, verified };',
  `
    const ratingStats = await prisma.review.aggregate({
      _avg: { rating: true }
    });
    return { 
      total, pending, approved, rejected, hidden, verified, 
      averageRating: ratingStats._avg.rating ? ratingStats._avg.rating.toFixed(1) : 0 
    };
  `
);
fs.writeFileSync(file, content);
console.log("Updated admin stats");
