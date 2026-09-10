const fs = require('fs');
const file = '/app/applet/src/backend/middlewares/customerAuth.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.split('email: string;').join('email: string | null;');

fs.writeFileSync(file, code);
console.log('Patched customerAuth.ts email type');
