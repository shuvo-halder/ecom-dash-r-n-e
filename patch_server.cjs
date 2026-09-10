const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

if (!content.includes('UploadCleanupService.startCleanupJob()')) {
  content = content.replace(
    'import { startRefreshTokenCleanupJob } from "./src/backend/controllers/auth.controller";',
    'import { startRefreshTokenCleanupJob } from "./src/backend/controllers/auth.controller";\nimport { UploadCleanupService } from "./src/backend/services/upload-cleanup.service";'
  );
  
  content = content.replace(
    'startRefreshTokenCleanupJob();',
    'startRefreshTokenCleanupJob();\n  UploadCleanupService.startCleanupJob();'
  );
  
  fs.writeFileSync('server.ts', content);
  console.log('Patched server.ts successfully');
} else {
  console.log('Already patched');
}
