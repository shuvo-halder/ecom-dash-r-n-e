const fs = require('fs');
let content = fs.readFileSync('src/backend/__tests__/smtp-verification.test.ts', 'utf-8');

// The route guard requires Settings:write permission format in req.permissions array? Let's check auth.ts
// Usually it checks req.user.permissions or something similar.
// In tests we can just mock the permission check or match the right payload

content = content.replace(
  `req.permissions = [{ resource: "Settings", actions: ["read", "write"] }];`,
  `req.user.permissions = [{ resource: "Settings", actions: ["read", "write"] }];`
);

content = content.replace(
  `const isSecure = emailService.resolveSecure(587, true);`,
  `const isSecure = emailService.resolveSecure(587, true);`
);

fs.writeFileSync('src/backend/__tests__/smtp-verification.test.ts', content);
