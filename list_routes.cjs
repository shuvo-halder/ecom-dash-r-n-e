const fs = require('fs');
const path = require('path');

function scanRoutes(dir, baseRoute = '') {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file.endsWith('.routes.ts')) {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      const lines = content.split('\n');
      console.log(`\n--- ${file} ---`);
      lines.forEach(line => {
        if (line.match(/router\.(get|post|put|patch|delete)/)) {
          console.log(line.trim());
        }
      });
    }
  }
}

console.log("=== STOREFRONT ROUTES ===");
scanRoutes('src/backend/routes/storefront');
