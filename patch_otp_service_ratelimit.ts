import fs from 'fs';
const file = 'src/backend/services/otp.service.ts';
let data = fs.readFileSync(file, 'utf8');

const rateLimitLogic = `
    // SMS pumping / abuse prevention
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    
    // 1. Mobile number rate limit: Max 5 OTP requests per 15 minutes for this mobile
    const mobileOtpCount = await prisma.customerOtp.count({
      where: {
        identifier: normalizedIdentifier,
        createdAt: { gte: fifteenMinutesAgo }
      }
    });
    if (mobileOtpCount >= 5) {
      logger.warn(\`[OTP] Rate limit exceeded for mobile \${normalizedIdentifier}\`);
      return { success: false, message: "Too many OTP requests for this number. Please try again later.", cooldownSeconds: 15 * 60 };
    }

    // 2. IP rate limit: Max 20 OTP requests per 15 minutes from this IP
    if (ipAddress) {
      const ipOtpCount = await prisma.customerOtp.count({
        where: {
          ipAddress: ipAddress,
          createdAt: { gte: fifteenMinutesAgo }
        }
      });
      if (ipOtpCount >= 20) {
        logger.warn(\`[OTP] Rate limit exceeded for IP \${ipAddress}\`);
        return { success: false, message: "Too many requests from this IP. Please try again later.", cooldownSeconds: 15 * 60 };
      }
    }

    // Generate new OTP`;

data = data.replace('// Generate new OTP', rateLimitLogic);

fs.writeFileSync(file, data);
