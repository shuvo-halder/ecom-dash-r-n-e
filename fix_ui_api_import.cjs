const fs = require('fs');
let content = fs.readFileSync('src/pages/admin/settings/Settings.tsx', 'utf-8');

content = content.replace(/import api from "\.\.\/\.\.\/\.\.\/lib\/api";/g, 'import { api } from "../../../lib/api";');
content = content.replace(/api\.put/g, 'api.put');

fs.writeFileSync('src/pages/admin/settings/Settings.tsx', content);
