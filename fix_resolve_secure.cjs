const fs = require('fs');
let content = fs.readFileSync('src/backend/services/email.service.ts', 'utf-8');

// The bug in resolveSecure: if (port === 587) { return false; } completely ignores configuredSecure override.
// It should be:
/*
  public resolveSecure(port: number, configuredSecure?: boolean | null): boolean {
    if (configuredSecure !== undefined && configuredSecure !== null) {
      return configuredSecure;
    }
    if (port === 465) {
      return true;
    }
    return false;
  }
*/

const targetStr = `  public resolveSecure(port: number, configuredSecure?: boolean | null): boolean {
    if (port === 465) {
      return configuredSecure !== false;
    }
    if (port === 587) {
      // Port 587 normally uses secure: false with STARTTLS handled by Nodemailer
      return false;
    }
    if (configuredSecure !== undefined && configuredSecure !== null) {
      return configuredSecure;
    }
    return port === 465;
  }`;

const newStr = `  public resolveSecure(port: number, configuredSecure?: boolean | null): boolean {
    if (configuredSecure !== undefined && configuredSecure !== null) {
      return configuredSecure;
    }
    return port === 465;
  }`;

content = content.replace(targetStr, newStr);

fs.writeFileSync('src/backend/services/email.service.ts', content);
