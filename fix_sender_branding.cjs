const fs = require('fs');
let content = fs.readFileSync('src/backend/services/email.service.ts', 'utf-8');

// Also update the sender's default fallback name to the StoreName if available
const targetStr = `
    if (setting && setting.enabled && setting.fromEmail) {
      const name = setting.fromName || "Storefront";
      return \`"\${name}" <\${setting.fromEmail}>\`;
    }
    return process.env.SMTP_FROM || '"Storefront" <noreply@storefront.com>';
`;

const newStr = `
    const storeName = await this.getStoreName();
    if (setting && setting.enabled && setting.fromEmail) {
      const name = setting.fromName || storeName;
      return \`"\${name}" <\${setting.fromEmail}>\`;
    }
    return process.env.SMTP_FROM || \`"\${storeName}" <noreply@storefront.com>\`;
`;

content = content.replace(targetStr, newStr);

fs.writeFileSync('src/backend/services/email.service.ts', content);
