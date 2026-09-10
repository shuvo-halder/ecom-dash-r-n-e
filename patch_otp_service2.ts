import fs from 'fs';
const file = 'src/backend/services/otp.service.ts';
let data = fs.readFileSync(file, 'utf8');

data = data.replace(
  /\/\/ Invalidate ALL previous unused OTPs and create the new one transactionally[\s\S]*?\]\);/m,
  `// Generate new OTP
    const rawOtp = this.generateRandomCode();
    const otpHash = this.hashOtp(rawOtp);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRY_SECONDS * 1000);
    const resendAvailableAt = new Date(now.getTime() + OTP_RESEND_COOLDOWN_SECONDS * 1000);

    // Invalidate ALL previous unused OTPs and create the new one transactionally
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
