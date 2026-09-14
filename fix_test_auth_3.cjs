const fs = require('fs');
let content = fs.readFileSync('src/backend/__tests__/smtp-verification.test.ts', 'utf-8');

// the permission logic expects req.user.role.name to be SUPER_ADMIN
const targetAuth = `
// Mock Authentication
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { 
    id: "admin1", 
    role: { name: "SUPER_ADMIN" }, 
    email: "admin@test.com",
    permissions: [{ resource: "Settings", actions: ["read", "write"] }]
  };
  return next();
};
`;

const newAuth = `
// Mock Authentication
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { 
    id: "admin1", 
    role: { name: "SUPER_ADMIN" }, 
    email: "admin@test.com",
    permissions: [{ module: "Settings", actions: ["read", "write"] }] // It expects 'module', not 'resource'
  };
  return next();
};
`;

content = content.replace(targetAuth, newAuth);

fs.writeFileSync('src/backend/__tests__/smtp-verification.test.ts', content);
