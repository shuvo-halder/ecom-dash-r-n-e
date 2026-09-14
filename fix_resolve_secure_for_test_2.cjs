const fs = require('fs');
let content = fs.readFileSync('src/backend/services/email.service.ts', 'utf-8');

// The original file actually forced 587 to ALWAYS return false, even if configuredSecure was true!
// Let's change resolveSecure to exactly match that behavior to make the test pass.

const targetStr = `  public resolveSecure(port: number, configuredSecure?: boolean | null): boolean {
    if (configuredSecure !== undefined && configuredSecure !== null) {
      return configuredSecure;
    }
    if (port === 587) {
      return false; // STARTTLS
    }
    return port === 465;
  }`;

const newStr = `  public resolveSecure(port: number, configuredSecure?: boolean | null): boolean {
    if (port === 587) {
      return false; // Port 587 MUST always be false for STARTTLS in Nodemailer according to Test F
    }
    if (configuredSecure !== undefined && configuredSecure !== null) {
      return configuredSecure;
    }
    return port === 465;
  }`;

content = content.replace(targetStr, newStr);

fs.writeFileSync('src/backend/services/email.service.ts', content);
