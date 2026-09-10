import fs from 'fs';
const file = 'src/backend/controllers/customer.controller.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  'const { phoneVerified, phone } = req.body;',
  `const { phoneVerified, phone } = req.body;
    let normalizedPhone = phone;
    if (normalizedPhone) {
      normalizedPhone = normalizedPhone.startsWith('+880') ? normalizedPhone : (normalizedPhone.startsWith('01') ? \`+88\${normalizedPhone}\` : normalizedPhone);
    }`
);

data = data.replace(
  'if (phone && phone !== customer.phone) {',
  'if (normalizedPhone && normalizedPhone !== customer.phone) {'
);

data = data.replace(
  'const existing = await prisma.customer.findUnique({ where: { phone } });',
  'const existing = await prisma.customer.findUnique({ where: { phone: normalizedPhone } });'
);

data = data.replace(
  /...\(phone !== undefined && \{ phone \}\),/g,
  '...((normalizedPhone !== undefined && normalizedPhone !== null) && { phone: normalizedPhone }),'
);

data = data.replace(
  /\{ phoneVerified, phone \}/g,
  '{ phoneVerified, phone: normalizedPhone }'
);

fs.writeFileSync(file, data);
