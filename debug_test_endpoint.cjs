const fs = require('fs');
let content = fs.readFileSync('src/backend/controllers/setting.controller.ts', 'utf-8');

// I am getting 400 back from the test endpoint. Let's see what the response body is to debug.
// Wait, in smtp-verification.test.ts, let's console.log the error message.
let testContent = fs.readFileSync('src/backend/__tests__/smtp-verification.test.ts', 'utf-8');
testContent = testContent.replace(
  `assert.strictEqual(res.status, 200);`,
  `console.log("RESPONSE:", res.body);\n    assert.strictEqual(res.status, 200);`
);

fs.writeFileSync('src/backend/__tests__/smtp-verification.test.ts', testContent);
