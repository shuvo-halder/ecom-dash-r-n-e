import crypto from "crypto";
import { prisma } from "../config/db";
import { OtpPurpose } from "@prisma/client";
import { ISmsProvider } from "./sms/sms.provider";
import { MockSmsProvider } from "./sms/mock.sms.provider";
import { normalizePhone } from "../utils/phone";
import { logger } from "../config/logger";

// Configuration with sensible defaults
const OTP_LENGTH = Number(process.env.OTP_LENGTH) || 6;
const OTP_EXPIRY_SECONDS = Number(process.env.OTP_EXPIRY_SECONDS) || 300; // 5 minutes
const OTP_MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) || 5;
const OTP_RESEND_COOLDOWN_SECONDS = Number(process.env.OTP_RESEND_COOLDOWN_SECONDS) || 60; // 1 minute

export class OtpService {
  private smsProvider: ISmsProvider;

  constructor(smsProvider?: ISmsProvider) {
    // Inject provider or default to Mock for now
    this.smsProvider = smsProvider || new MockSmsProvider();
  }

  /**
   * Generates a cryptographically secure OTP
   */
  private generateRandomCode(): string {
    const min = Math.pow(10, OTP_LENGTH - 1);
    const max = Math.pow(10, OTP_LENGTH) - 1;
    return crypto.randomInt(min, max + 1).toString();
  }

  /**
   * Hashes the OTP using SHA-256 for secure storage
   */
  private hashOtp(otp: string): string {
    return crypto.createHash("sha256").update(otp).digest("hex");
  }

  /**
   * Request an OTP for a given identifier (mobile)
   */
  async requestOtp(identifier: string, purpose: OtpPurpose, ipAddress?: string): Promise<{ success: boolean; message: string; cooldownSeconds?: number }> {
    const normalizedIdentifier = normalizePhone(identifier) || identifier;

    // Check for recent OTP requests to enforce resend cooldown
    const latestOtp = await prisma.customerOtp.findFirst({
      where: {
        identifier: normalizedIdentifier,
        purpose,
        isUsed: false,
      },
      orderBy: { createdAt: "desc" },
    });

    if (latestOtp && latestOtp.resendAvailableAt && latestOtp.resendAvailableAt > new Date()) {
      const cooldownSeconds = Math.ceil((latestOtp.resendAvailableAt.getTime() - Date.now()) / 1000);
      return { 
        success: false, 
        message: `Please wait ${cooldownSeconds} seconds before requesting a new OTP.`,
        cooldownSeconds
      };
    }

    
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
      logger.warn(`[OTP] Rate limit exceeded for mobile ${normalizedIdentifier}`);
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
        logger.warn(`[OTP] Rate limit exceeded for IP ${ipAddress}`);
        return { success: false, message: "Too many requests from this IP. Please try again later.", cooldownSeconds: 15 * 60 };
      }
    }

    // Generate new OTP
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
    ]);

    // Dispatch SMS (provider-agnostic)
    const smsMessage = `Your verification code is ${rawOtp}. It will expire in ${OTP_EXPIRY_SECONDS / 60} minutes. Do not share this code.`;
    
    try {
      const smsResult = await this.smsProvider.sendSms({
        to: normalizedIdentifier,
        message: smsMessage,
      });

      if (!smsResult.success) {
        logger.error("[OtpService] Failed to send SMS", { identifier: normalizedIdentifier, error: smsResult.error });
        // Depending on business logic, we might still return success to not leak that SMS delivery failed, 
        // or return an error. Let's return error so frontend knows.
        return { success: false, message: "Failed to dispatch verification code." };
      }
    } catch (err) {
      logger.error("[OtpService] Error calling SMS provider", { error: err });
      return { success: false, message: "Failed to dispatch verification code." };
    }

    // NEVER return the rawOtp in the response!
    return { success: true, message: "OTP sent successfully.", cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS };
  }

  /**
   * Verify an OTP
   */
  async verifyOtp(identifier: string, purpose: OtpPurpose, otp: string): Promise<{ success: boolean; message: string }> {
    const normalizedIdentifier = normalizePhone(identifier) || identifier;

    // Find the most recent active OTP
    const otpRecord = await prisma.customerOtp.findFirst({
      where: {
        identifier: normalizedIdentifier,
        purpose,
        isUsed: false,
        expiresAt: { gt: new Date() }, // must not be expired
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return { success: false, message: "Invalid or expired OTP." };
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      // Actually if it reached max attempts, we should mark it as used.
      // Doing an atomic update to mark used if max attempts reached.
      await prisma.customerOtp.updateMany({
         where: { id: otpRecord.id, isUsed: false },
         data: { isUsed: true }
      });
      return { success: false, message: "Maximum verification attempts exceeded. Please request a new OTP." };
    }

    const inputHash = this.hashOtp(otp);

    if (otpRecord.otpHash !== inputHash) {
      // Increment attempts
      const updated = await prisma.customerOtp.updateMany({
        where: { id: otpRecord.id, isUsed: false },
        data: { attempts: { increment: 1 } },
      });

      // If attempts reach max, mark used in a separate atomic check or let the next verify call handle it
      if (otpRecord.attempts + 1 >= otpRecord.maxAttempts) {
        await prisma.customerOtp.updateMany({
          where: { id: otpRecord.id, isUsed: false },
          data: { isUsed: true },
        });
        return { success: false, message: "Maximum verification attempts exceeded. Please request a new OTP." };
      }

      return { success: false, message: "Incorrect OTP." };
    }

    // Success! Mark as used atomically to prevent race condition reuse
    const updatedResult = await prisma.customerOtp.updateMany({
      where: {
        id: otpRecord.id,
        isUsed: false,
      },
      data: {
        isUsed: true,
        attempts: { increment: 1 },
      },
    });

    if (updatedResult.count === 0) {
      return { success: false, message: "OTP has already been used." };
    }

    return { success: true, message: "OTP verified successfully." };
  }
}
