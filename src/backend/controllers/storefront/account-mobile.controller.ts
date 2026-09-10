import { normalizePhone } from "../../utils/phone";
import { Response, NextFunction } from "express";
import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { CustomerAuthRequest } from "../../middlewares/customerAuth";
import { OtpService } from "../../services/otp.service";
import { MockSmsProvider } from "../../services/sms/mock.sms.provider";
import { StorefrontAuthService } from "../../services/storefront/auth.service";

const smsProvider = new MockSmsProvider();
const otpService = new OtpService(smsProvider);

export const requestMobileChange = async (req: CustomerAuthRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.customer!.id;
    const { newPhone } = req.body;

    const normalizedPhone = normalizePhone(newPhone);
    if (!normalizedPhone) {
      return next(new AppError("Invalid Bangladesh mobile number format", 400, "BAD_REQUEST"));
    }

    // Check if newPhone is already registered and verified by someone else
    const existing = await prisma.customer.findUnique({
      where: { phone: normalizedPhone }
    });

    if (existing && existing.id !== customerId && existing.phoneVerified) {
      return next(new AppError("This mobile number is already verified on another account.", 400, "BAD_REQUEST"));
    }

    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "Unknown";
    const otpResult = await otpService.requestOtp(normalizedPhone, "CHANGE_MOBILE", ip);
    if (!otpResult.success) {
      return next(new AppError(otpResult.message, 400, "BAD_REQUEST"));
    }

    res.status(200).json({
      status: "success",
      message: "Verification code sent to the new mobile number.",
    });
  } catch (error) {
    next(error);
  }
};

export const verifyMobileChange = async (req: CustomerAuthRequest, res: Response, next: NextFunction) => {
  try {
    const customerId = req.customer!.id;
    const { newPhone, otp } = req.body;

    const normalizedPhone = normalizePhone(newPhone);
    if (!normalizedPhone) {
      return next(new AppError("Invalid Bangladesh mobile number format", 400, "BAD_REQUEST"));
    }

    // Verify OTP
    const otpResult = await otpService.verifyOtp(normalizedPhone, "CHANGE_MOBILE", otp);
    if (!otpResult.success) {
      return next(new AppError(otpResult.message, 400, "BAD_REQUEST"));
    }

    // Ensure it's still available
    const existing = await prisma.customer.findUnique({
      where: { phone: normalizedPhone }
    });

    if (existing && existing.id !== customerId && existing.phoneVerified) {
       return next(new AppError("This mobile number is already verified on another account.", 400, "BAD_REQUEST"));
    }

    // Safely delete any unverified customer blocking this phone
    if (existing && existing.id !== customerId && !existing.phoneVerified) {
       await prisma.customer.delete({ where: { id: existing.id } });
    }

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        phone: normalizedPhone,
        phoneVerified: true,
        phoneVerifiedAt: new Date(),
      }
    });

    // Safely associate eligible historical guest orders belonging to this verified phone number
    await StorefrontAuthService.linkHistoricalGuestOrders(customerId, normalizedPhone, req.customer?.email);

    res.status(200).json({
      status: "success",
      message: "Mobile number updated successfully.",
    });
  } catch (error) {
    next(error);
  }
};
