import fs from 'fs';
const files = [
  'src/backend/controllers/storefront/auth-mobile.controller.ts',
  'src/backend/controllers/storefront/account-mobile.controller.ts'
];
for (const file of files) {
  let data = fs.readFileSync(file, 'utf8');
  data = data.replace(/mock-sms\.provider/g, 'mock.sms.provider');
  fs.writeFileSync(file, data);
}
