import { normalizePhone } from "../../utils/phone";
import { Request, Response, NextFunction } from "express";
import { prisma } from "../../config/db";
import { AppError } from "../../utils/AppError";
import { OtpService } from "../../services/otp.service";
import { generateCustomerAccessToken, generateCustomerRefreshToken } from "../../utils/customerJwt";
import { StorefrontAuthService } from "../../services/storefront/auth.service";
import { env } from "../../config/env";
import { MockSmsProvider } from "../../services/sms/mock.sms.provider";

// Initialize OTP service
const smsProvider = new MockSmsProvider();
const otpService = new OtpService(smsProvider);

export const registerMobile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { firstName, lastName, phone } = req.body;
    
    // Normalize phone via OTP service logic or do it here
    const normalizedPhone = normalizePhone(phone as string);
    if (!normalizedPhone) {
      return next(new AppError("Invalid Bangladesh mobile number format", 400, "BAD_REQUEST"));
    }

    // Check if phone already in use
    const existingCustomer = await prisma.customer.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existingCustomer) {
      if (existingCustomer.phoneVerified) {
        return next(new AppError("Phone number already registered and verified. Please login.", 400, "BAD_REQUEST"));
      }
      // If unverified, they can still request OTP
    }

    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "Unknown";
    const otpResult = await otpService.requestOtp(normalizedPhone, "REGISTRATION", ip);
    if (!otpResult.success) {
      return next(new AppError(otpResult.message, 400, "BAD_REQUEST"));
    }

    res.status(200).json({
      status: "success",
      message: "Verification code sent to your mobile number.",
    });
  } catch (error) {
    next(error);
  }
};

export const verifyMobileRegistration = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, otp, firstName, lastName } = req.body;
    const normalizedPhone = normalizePhone(phone as string);
    if (!normalizedPhone) {
      return next(new AppError("Invalid Bangladesh mobile number format", 400, "BAD_REQUEST"));
    }

    const otpResult = await otpService.verifyOtp(normalizedPhone, "REGISTRATION", otp);
    if (!otpResult.success) {
      return next(new AppError(otpResult.message, 400, "BAD_REQUEST"));
    }

    let customer = await prisma.customer.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!customer) {
      if (!firstName) {
         return next(new AppError("First name is required for new registration", 400, "BAD_REQUEST"));
      }
      customer = await prisma.customer.create({
        data: {
          firstName,
          lastName,
          phone: normalizedPhone,
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
        },
      });
    } else {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          phoneVerified: true,
          phoneVerifiedAt: new Date(),
          ...(firstName && { firstName }),
          ...(lastName && { lastName }),
        },
      });
    }

    // Issue JWT
    const accessToken = generateCustomerAccessToken(customer.id, customer.email);
    const refreshToken = generateCustomerRefreshToken(customer.id, customer.email);
    
    const expiresInDays = parseInt(env.JWT_REFRESH_EXPIRES_IN) || 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "Unknown";
    const userAgent = req.headers["user-agent"] || "Unknown";
    
    await StorefrontAuthService.createCustomerRefreshToken(customer.id, refreshToken, expiresAt, ip, userAgent);

    // Safely associate eligible historical guest orders belonging to this verified phone number
    const claimResult = await StorefrontAuthService.linkGuestOrdersToCustomer(
      customer.id,
      customer.phone,
      customer.email,
      ip
    );

    res.status(201).json({
      status: "success",
      message: "Mobile number verified successfully.",
      data: {
        customer: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
          phoneVerified: customer.phoneVerified,
        },
        linkedOrdersCount: claimResult.linkedOrdersCount,
        linkedOrderIds: claimResult.linkedOrderIds,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const loginMobile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone } = req.body;
    const normalizedPhone = normalizePhone(phone as string);
    if (!normalizedPhone) {
      return next(new AppError("Invalid Bangladesh mobile number format", 400, "BAD_REQUEST"));
    }

    const customer = await prisma.customer.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!customer || !customer.isActive || customer.deletedAt) {
      return next(new AppError("Account not found or inactive", 401, "UNAUTHORIZED"));
    }

    if (!customer.phoneVerified) {
      return next(new AppError("Phone number not verified", 401, "UNAUTHORIZED"));
    }

    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "Unknown";
    const otpResult = await otpService.requestOtp(normalizedPhone, "LOGIN", ip);
    if (!otpResult.success) {
      // For security, still return success to not leak
      console.warn("OTP Request failed:", otpResult.message);
    }

    res.status(200).json({
      status: "success",
      message: "If this number is registered, an OTP will be sent.",
    });
  } catch (error) {
    next(error);
  }
};

export const verifyMobileLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { phone, otp } = req.body;
    const normalizedPhone = normalizePhone(phone as string);
    if (!normalizedPhone) {
      return next(new AppError("Invalid Bangladesh mobile number format", 400, "BAD_REQUEST"));
    }

    const customer = await prisma.customer.findUnique({
      where: { phone: normalizedPhone },
    });

    if (!customer || !customer.isActive || customer.deletedAt || !customer.phoneVerified) {
      return next(new AppError("Invalid or expired OTP.", 401, "UNAUTHORIZED"));
    }

    const otpResult = await otpService.verifyOtp(normalizedPhone, "LOGIN", otp);
    if (!otpResult.success) {
      return next(new AppError(otpResult.message, 401, "UNAUTHORIZED"));
    }

    await prisma.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });

    // Issue JWT
    const accessToken = generateCustomerAccessToken(customer.id, customer.email);
    const refreshToken = generateCustomerRefreshToken(customer.id, customer.email);
    
    const expiresInDays = parseInt(env.JWT_REFRESH_EXPIRES_IN) || 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);
    const ip = (req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "Unknown";
    const userAgent = req.headers["user-agent"] || "Unknown";
    
    await StorefrontAuthService.createCustomerRefreshToken(customer.id, refreshToken, expiresAt, ip, userAgent);

    // Safely associate eligible historical guest orders belonging to this verified phone number
    const claimResult = await StorefrontAuthService.linkGuestOrdersToCustomer(
      customer.id,
      customer.phone,
      customer.email,
      ip
    );

    res.status(200).json({
      status: "success",
      data: {
        customer: {
          id: customer.id,
          email: customer.email,
          phone: customer.phone,
          firstName: customer.firstName,
          lastName: customer.lastName,
          phoneVerified: customer.phoneVerified,
        },
        linkedOrdersCount: claimResult.linkedOrdersCount,
        linkedOrderIds: claimResult.linkedOrderIds,
        accessToken,
        refreshToken,
      },
    });
  } catch (error) {
    next(error);
  }
};
