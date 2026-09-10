import fs from 'fs';
const file = 'src/backend/controllers/storefront/auth-mobile.controller.ts';
let data = fs.readFileSync(file, 'utf8');

// Helper to extract IP in controller
const ipExtract = `
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "Unknown";
`;

data = data.replace(
  'const otpResult = await otpService.requestOtp(normalizedPhone, "REGISTRATION");',
  'const ip = (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "Unknown";\n    const otpResult = await otpService.requestOtp(normalizedPhone, "REGISTRATION", ip);'
);

data = data.replace(
  'const otpResult = await otpService.requestOtp(normalizedPhone, "LOGIN");',
  'const ip = (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "Unknown";\n    const otpResult = await otpService.requestOtp(normalizedPhone, "LOGIN", ip);'
);

fs.writeFileSync(file, data);
