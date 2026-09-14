const fs = require('fs');
let content = fs.readFileSync('src/backend/__tests__/smtp-verification.test.ts', 'utf-8');

// The replacement was messed up because of how string replace matches things. Let's fix manually
const correctMockStr = `
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

const app = express();
`;

// regex to replace everything from Mock Auth to const app
content = content.replace(/\/\/ Mock Authentication[\s\S]*?const app = express\(\);/, correctMockStr);

fs.writeFileSync('src/backend/__tests__/smtp-verification.test.ts', content);
