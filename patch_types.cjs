const fs = require('fs');
let code = fs.readFileSync('src/backend/dtos/storefront/types.ts', 'utf8');

const target = `  stock?: number;
  inStock?: boolean;
}`;

const replacement = `  stock?: number;
  inStock?: boolean;
  
  rating?: number;
  reviewCount?: number;
}`;

code = code.replace(target, replacement);
fs.writeFileSync('src/backend/dtos/storefront/types.ts', code);
console.log("types.ts patched.");
