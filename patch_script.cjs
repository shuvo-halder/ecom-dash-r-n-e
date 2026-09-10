const fs = require('fs');
const file = 'src/backend/scripts/migrateRichText.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(/cmsPage/g, 'page');
code = code.replace(/CmsPage/g, 'Page');
code = code.replace(/faq\./g, 'fAQ.');
code = code.replace(/faq =/g, 'fAQ =');
code = code.replace(/faqs =/g, 'fAQs =');

fs.writeFileSync(file, code, 'utf8');
