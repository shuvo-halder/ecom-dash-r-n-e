const fs = require('fs');
const file = 'src/components/layout/Sidebar.tsx';
let code = fs.readFileSync(file, 'utf8');

if (!code.includes(' Star,')) {
    code = code.replace('import {', 'import { Star,');
}
fs.writeFileSync(file, code);
