const fs = require('fs');
const file = 'src/backend/__tests__/review_concurrency_real.test.ts';
let content = fs.readFileSync(file, 'utf8');

// Fix Product creation
content = content.replace(
  /price: 10,\s*status: "Active"/,
  `price: 10, status: "Active", categoryId: "fake-category"`
);

// Fix Order creation
content = content.replace(
  /customerId: customer\.id,\s*totalAmount: 10,\s*status: "Delivered",/,
  `customerId: customer.id, totalAmount: 10, status: "Delivered", orderNumber: "ORD-" + Date.now(),`
);

content = content.replace(
  /totalAmount: 10,\s*status: "Delivered",/,
  `totalAmount: 10, status: "Delivered", orderNumber: "ORD-GUEST-" + Date.now(),`
);

fs.writeFileSync(file, content);
console.log("Patched review_concurrency_real.test.ts");
