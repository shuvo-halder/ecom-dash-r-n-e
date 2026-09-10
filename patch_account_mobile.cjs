const fs = require('fs');
const file = '/app/applet/src/backend/controllers/storefront/account-mobile.controller.ts';
let code = fs.readFileSync(file, 'utf8');

const badNormalization = "const normalizedPhone = newPhone.startsWith('+880') ? newPhone : (newPhone.startsWith('01') ? `+88${newPhone}` : newPhone);";
const goodNormalization = `const normalizedPhone = normalizePhone(newPhone);
    if (!normalizedPhone) {
      return next(new AppError("Invalid Bangladesh mobile number format", 400, "BAD_REQUEST"));
    }`;

code = code.split(badNormalization).join(goodNormalization);

if (!code.includes('import { normalizePhone }')) {
  code = `import { normalizePhone } from "../../utils/phone";\n` + code;
}

fs.writeFileSync(file, code);
console.log('Patched account-mobile.controller.ts');
