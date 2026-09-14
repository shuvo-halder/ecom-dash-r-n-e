const fs = require('fs');
let content = fs.readFileSync('src/backend/__tests__/smtp-verification.test.ts', 'utf-8');

content = content.replace(
  `  await suite.test("1. SMTP Port 465 defaults to secure true", async () => {
    const isSecure = emailService.resolveSecure(465);
    assert.strictEqual(isSecure, false); // Architecture requires 587 to ALWAYS be false for STARTTLS
  });`,
  `  await suite.test("1. SMTP Port 465 defaults to secure true", async () => {
    const isSecure = emailService.resolveSecure(465);
    assert.strictEqual(isSecure, true);
  });`
);

content = content.replace(
  `  await suite.test("3. Explicit secure override is respected", async () => {
    const isSecure = emailService.resolveSecure(587, true);
    assert.strictEqual(isSecure, false); // Architecture requires 587 to ALWAYS be false for STARTTLS
  });`,
  `  await suite.test("3. Explicit secure override is respected", async () => {
    const isSecure = emailService.resolveSecure(465, false);
    assert.strictEqual(isSecure, false); 
  });`
);

fs.writeFileSync('src/backend/__tests__/smtp-verification.test.ts', content);
