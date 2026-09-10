const fs = require('fs');
const file = '/app/applet/src/backend/controllers/customer.controller.ts';
let code = fs.readFileSync(file, 'utf8');

const badNormalization = `    let normalizedPhone = phone;
    if (normalizedPhone) {
      normalizedPhone = normalizedPhone.startsWith('+880') ? normalizedPhone : (normalizedPhone.startsWith('01') ? \`+88\${normalizedPhone}\` : normalizedPhone);
    }`;

const goodNormalization = `    let normalizedPhone = phone;
    if (normalizedPhone) {
      normalizedPhone = normalizePhone(normalizedPhone);
      if (!normalizedPhone) {
        return next(new AppError("Invalid Bangladesh mobile number format", 400, "BAD_REQUEST"));
      }
    }`;

code = code.split(badNormalization).join(goodNormalization);

if (!code.includes('import { normalizePhone }')) {
  code = `import { normalizePhone } from "../utils/phone";\n` + code;
}

fs.writeFileSync(file, code);
console.log('Patched customer.controller.ts');
