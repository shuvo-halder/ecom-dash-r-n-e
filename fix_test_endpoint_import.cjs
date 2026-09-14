const fs = require('fs');
let content = fs.readFileSync('src/backend/controllers/setting.controller.ts', 'utf-8');

// I notice I used require for emailService inside the function. Let me import it properly.
// The file has imports at the top. Let's add them.

content = `import { emailService } from "../services/email.service";\nimport { SettingService as InternalSettingService } from "../services/setting.service";\n` + content;

// and replace the requires inside testSMTP
content = content.replace(/const { emailService } = require\("\.\.\/services\/email\.service"\);/g, '');
content = content.replace(/const { SettingService } = require\("\.\.\/services\/setting\.service"\);/g, '');
content = content.replace(/const smtpSettings = await SettingService\.getSMTP\(\);/g, 'const smtpSettings = await InternalSettingService.getSMTP();');
content = content.replace(/const { getBaseTemplate } = require\("\.\.\/services\/email\/templates"\);/g, 'const { getBaseTemplate } = require("../services/email/templates");'); // this require is fine inline to avoid circular issues

fs.writeFileSync('src/backend/controllers/setting.controller.ts', content);
