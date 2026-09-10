const fs = require('fs');
const file = '/app/applet/src/backend/controllers/storefront/auth-mobile.controller.ts';
let code = fs.readFileSync(file, 'utf8');

// Replace the inline normalization
const badNormalization = "const normalizedPhone = (phone as string).startsWith('+880') ? phone : (phone.startsWith('01') ? `+88${phone}` : phone);";
const goodNormalization = `const normalizedPhone = normalizePhone(phone as string);
    if (!normalizedPhone) {
      return next(new AppError("Invalid Bangladesh mobile number format", 400, "BAD_REQUEST"));
    }`;

code = code.split(badNormalization).join(goodNormalization);

// Add import if not present
if (!code.includes('import { normalizePhone }')) {
  code = `import { normalizePhone } from "../../utils/phone";\n` + code;
}

fs.writeFileSync(file, code);
console.log('Patched auth-mobile.controller.ts');
