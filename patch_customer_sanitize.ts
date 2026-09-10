import fs from 'fs';
const file = 'src/backend/controllers/customer.controller.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /const \{ passwordHash, resetPasswordToken, resetPasswordExpires, verificationToken, verificationExpires, \.\.\.safeCust \} = cust;/,
  'const { passwordHash, resetPasswordToken, resetPasswordExpires, verificationToken, verificationExpires, pendingEmailVerificationToken, pendingEmailVerificationExpires, ...safeCust } = cust;'
);

fs.writeFileSync(file, data);
