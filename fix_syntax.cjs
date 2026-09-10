const fs = require('fs');
const file = 'src/backend/services/upload-cleanup.service.ts';
let content = fs.readFileSync(file, 'utf8');

// just replace the bad template strings with simple concatenation
content = content.replace(/\\`\\[UploadCleanup\\] Failed to clean up tracker \\\$\\{tracker\.id\\} \(\\\$\\{tracker\.publicId\\}\):\\`/g, '"[UploadCleanup] Failed to clean up tracker " + tracker.id + " (" + tracker.publicId + "):"');
content = content.replace(/\\`\\[UploadCleanup\\] Cleanup complete. Deleted \\\$\\{deletedCount\\} orphaned uploads.\\`/g, '"[UploadCleanup] Cleanup complete. Deleted " + deletedCount + " orphaned uploads."');

fs.writeFileSync(file, content);
