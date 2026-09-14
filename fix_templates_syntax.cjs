const fs = require('fs');
let content = fs.readFileSync('src/backend/services/email/templates.ts', 'utf-8');

// I replaced `, content: \`` instead of just `, \``.
content = content.replace(/, content: `/g, ', `');
// Need to add storeName back to getBaseTemplate signature
content = content.replace(
  `export const getBaseTemplate = (title: string, content: string) =>`,
  `export const getBaseTemplate = (title: string, content: string, storeName: string = "Storefront") =>`
);


fs.writeFileSync('src/backend/services/email/templates.ts', content);
