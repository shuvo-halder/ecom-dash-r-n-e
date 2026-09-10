const fs = require('fs');
const file = '/app/applet/src/backend/controllers/storefront/auth.controller.ts';
let code = fs.readFileSync(file, 'utf8');

const regSrc = 'const { firstName, lastName, email, password } = req.body;';
const regDst = 'const { firstName, lastName, password } = req.body;\n    const email = req.body.email?.trim().toLowerCase();';

const logSrc = 'const { email, password } = req.body;';
const logDst = 'const { password } = req.body;\n    const email = req.body.email?.trim().toLowerCase();';

const reqResetSrc = 'const { email } = req.body;';
const reqResetDst = 'const email = req.body.email?.trim().toLowerCase();';

code = code.split(regSrc).join(regDst);
code = code.split(logSrc).join(logDst);
code = code.split(reqResetSrc).join(reqResetDst);

fs.writeFileSync(file, code);
console.log('Patched auth.controller.ts');
