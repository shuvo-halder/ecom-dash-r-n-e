import fs from 'fs';
const file = 'src/backend/controllers/storefront/account-mobile.controller.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  'const otpResult = await otpService.requestOtp(normalizedPhone, "CHANGE_MOBILE");',
  'const ip = (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "Unknown";\n    const otpResult = await otpService.requestOtp(normalizedPhone, "CHANGE_MOBILE", ip);'
);

fs.writeFileSync(file, data);
