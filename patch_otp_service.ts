import fs from 'fs';
const file = 'src/backend/services/otp.service.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /\/\/ Invalidate ALL previous unused OTPs[\s\S]*?await prisma.customerOtp.create\(\{[\s\S]*?isUsed: false,\n      \},\n    \}\);/m,
  `// Invalidate ALL previous unused OTPs and create the new one transactionally
    await prisma.$transaction([
      prisma.customerOtp.updateMany({
        where: {
          identifier: normalizedIdentifier,
          purpose,
          isUsed: false,
        },
        data: {
          isUsed: true,
        },
      }),
      prisma.customerOtp.create({
        data: {
          identifier: normalizedIdentifier,
          otpHash,
          purpose,
          expiresAt,
          resendAvailableAt,
          ipAddress,
          maxAttempts: OTP_MAX_ATTEMPTS,
          attempts: 0,
          isUsed: false,
        },
      })
    ]);`
);

fs.writeFileSync(file, data);
