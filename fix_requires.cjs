const fs = require('fs');
let content = fs.readFileSync('src/backend/services/storefront/paymentSecurity.service.ts', 'utf-8');

if (!content.includes('import { emailService }')) {
  content = content.replace(
    'import { PaymentStatus, Prisma } from "@prisma/client";',
    'import { PaymentStatus, Prisma } from "@prisma/client";\nimport { emailService } from "../email.service";'
  );
}

content = content.replace(/const emailService = require\("\.\.\/email\.service"\)\.emailService;/g, '');
fs.writeFileSync('src/backend/services/storefront/paymentSecurity.service.ts', content);
