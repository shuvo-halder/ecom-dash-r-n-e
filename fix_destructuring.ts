import fs from 'fs';
const file = 'src/backend/controllers/customer.controller.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  'const { phoneVerified, phone: normalizedPhone } = req.body;\n    let normalizedPhone = phone;',
  'const { phoneVerified, phone } = req.body;\n    let normalizedPhone = phone;'
);

fs.writeFileSync(file, data);
