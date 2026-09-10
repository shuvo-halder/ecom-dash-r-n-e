const fs = require('fs');
let content = fs.readFileSync('src/backend/__tests__/upload_cleanup.test.ts', 'utf8');
content = content.replace(
  '      delete: vi.fn(),\n      update: vi.fn(),',
  '      delete: vi.fn().mockResolvedValue({}),\n      update: vi.fn().mockResolvedValue({}),'
);
fs.writeFileSync('src/backend/__tests__/upload_cleanup.test.ts', content);
