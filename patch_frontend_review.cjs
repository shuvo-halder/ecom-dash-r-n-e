const fs = require('fs');

let service = fs.readFileSync('src/services/review.service.ts', 'utf8');

service += `
export const getReviewStats = async () => {
  const { data } = await api.get("/reviews/stats");
  return data.data;
};
`;
fs.writeFileSync('src/services/review.service.ts', service);
