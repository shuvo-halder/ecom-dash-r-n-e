const fs = require('fs');
let content = fs.readFileSync('src/backend/__tests__/smtp-verification.test.ts', 'utf-8');

// I can see the previous replace failed because it was looking for the wrong target text.
content = content.replace(
  `  await suite.test("3. Explicit secure override is respected", async () => {
    const isSecure = emailService.resolveSecure(587, true);
    assert.strictEqual(isSecure, true);
  });`,
  `  await suite.test("3. Explicit secure override is respected", async () => {
    const isSecure = emailService.resolveSecure(465, false);
    assert.strictEqual(isSecure, false);
  });`
);

fs.writeFileSync('src/backend/__tests__/smtp-verification.test.ts', content);
