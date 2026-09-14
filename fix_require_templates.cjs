const fs = require('fs');
let content = fs.readFileSync('src/backend/controllers/setting.controller.ts', 'utf-8');

// The file is using import syntax at the top now but still has require inside testSMTP for getBaseTemplate
content = `import { getBaseTemplate } from "../services/email/templates";\n` + content;
content = content.replace(/const { getBaseTemplate } = require\("\.\.\/services\/email\/templates"\);/g, '');

fs.writeFileSync('src/backend/controllers/setting.controller.ts', content);
