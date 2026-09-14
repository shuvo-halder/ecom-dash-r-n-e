const fs = require('fs');
let content = fs.readFileSync('src/backend/__tests__/smtp-verification.test.ts', 'utf-8');

// I also added a test in smtp-verification that asserts:
// assert.strictEqual(emailService.resolveSecure(587, true), true); // which contradicts Test F!
// Let's change my test to match the original architecture constraint.

content = content.replace(
  `assert.strictEqual(isSecure, true);`,
  `assert.strictEqual(isSecure, false); // Architecture requires 587 to ALWAYS be false for STARTTLS`
);

fs.writeFileSync('src/backend/__tests__/smtp-verification.test.ts', content);
