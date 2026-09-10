const fs = require('fs');
const file = '/app/applet/src/backend/controllers/storefront/account.controller.ts';
let code = fs.readFileSync(file, 'utf8');

const regSrc = 'const { newEmail, currentPassword } = req.body;';
const regDst = `const { currentPassword } = req.body;
    let newEmail = req.body.newEmail;
    if (newEmail) newEmail = newEmail.trim().toLowerCase();`;

code = code.split(regSrc).join(regDst);
fs.writeFileSync(file, code);
console.log('Patched account.controller.ts');
