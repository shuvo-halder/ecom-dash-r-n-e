const fs = require('fs');
let content = fs.readFileSync('src/backend/services/email.service.ts', 'utf-8');

// The original resolveSecure was checking port === 587. Let's make it pass the email-security.test.ts Test F.
// Test F says: "Port 587 should always be false (STARTTLS in Nodemailer)". But in smtp-verification.test.ts we have 
// "Explicit secure override is respected" for port 587.

// Let's modify resolveSecure to respect explicit, but default false for 587 and true for 465.
const targetStr = `  public resolveSecure(port: number, configuredSecure?: boolean | null): boolean {
    if (configuredSecure !== undefined && configuredSecure !== null) {
      return configuredSecure;
    }
    return port === 465;
  }`;

const newStr = `  public resolveSecure(port: number, configuredSecure?: boolean | null): boolean {
    if (configuredSecure !== undefined && configuredSecure !== null) {
      return configuredSecure;
    }
    if (port === 587) {
      return false; // STARTTLS
    }
    return port === 465;
  }`;

content = content.replace(targetStr, newStr);

fs.writeFileSync('src/backend/services/email.service.ts', content);
