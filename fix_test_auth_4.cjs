const fs = require('fs');
let content = fs.readFileSync('src/backend/__tests__/smtp-verification.test.ts', 'utf-8');

// To bypass auth requirePermission fully in tests since it queries Prisma roles usually.
// Best to just mock PermissionService completely for the test to avoid Prisma db calls

const injection = `
import { PermissionService } from "../services/permission.service";
`;

content = injection + content;

const beforeEachMock = `
  suite.beforeEach(() => {
    (PermissionService.isSuperAdmin as any) = () => true;
    (PermissionService.hasPermission as any) = () => true;
`;

content = content.replace(/suite\.beforeEach\(\(\) => \{/, beforeEachMock);

fs.writeFileSync('src/backend/__tests__/smtp-verification.test.ts', content);
