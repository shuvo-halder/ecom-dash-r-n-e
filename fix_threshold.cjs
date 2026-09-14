const fs = require('fs');
let content = fs.readFileSync('src/backend/services/storefront/checkout.service.ts', 'utf-8');

content = content.replace(
  /if \(previousAvailable > threshold && \(previousAvailable - item\.quantity\) <= threshold\)/g,
  'if (previousAvailable >= threshold && (previousAvailable - item.quantity) < threshold)'
);

fs.writeFileSync('src/backend/services/storefront/checkout.service.ts', content);
