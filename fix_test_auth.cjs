const fs = require('fs');
let content = fs.readFileSync('src/backend/__tests__/smtp-verification.test.ts', 'utf-8');

// The auth middleware usually expects a decoded JWT to be mapped to req.user
// req.user = { role: { name: 'SUPER_ADMIN' }, permissions: [...] }

content = content.replace(
  `const mockAuth = (req: any, res: any, next: any) => {`,
  `const mockAuth = (req: any, res: any, next: any) => {
  req.user = { 
    id: "admin1", 
    role: { name: "SUPER_ADMIN" }, 
    email: "admin@test.com",
    permissions: [{ resource: "Settings", actions: ["read", "write"] }]
  };
  return next();
};
// `
);

fs.writeFileSync('src/backend/__tests__/smtp-verification.test.ts', content);
