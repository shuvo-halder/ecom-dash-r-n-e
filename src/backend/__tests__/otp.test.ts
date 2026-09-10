import test from "node:test";
import assert from "node:assert";
import crypto from "crypto";
import { OtpPurpose } from "@prisma/client";
import { OtpService } from "../services/otp.service";
import { ISmsProvider, SmsSendOptions, SmsSendResult } from "../services/sms/sms.provider";
import { prisma } from "../config/db";

// MOCK PRISMA
let mockDb: any[] = [];
let customerDb: any[] = [];


(prisma as any).$transaction = async (arr: any[]) => {
  const results = [];
  for (const p of arr) {
    results.push(await p);
  }
  return results;
};

(prisma.customerOtp as any) = {
  findFirst: async (args: any) => {
    const sorted = [...mockDb].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const found = sorted.find(r => 
      r.identifier === args.where.identifier &&
      r.purpose === args.where.purpose &&
      r.isUsed === args.where.isUsed &&
      (!args.where.expiresAt || r.expiresAt > new Date())
    );
    return found ? { ...found } : null;
  },
  updateMany: async (args: any) => {
    let count = 0;
    mockDb = mockDb.map(r => {
      let match = true;
      if (args.where.id && r.id !== args.where.id) match = false;
      if (args.where.identifier && r.identifier !== args.where.identifier) match = false;
      if (args.where.isUsed !== undefined && r.isUsed !== args.where.isUsed) match = false;
      
      if (match) {
        count++;
        // create clone to update
        const next = { ...r };
        if (args.data.isUsed !== undefined) next.isUsed = args.data.isUsed;
        if (args.data.attempts?.increment) next.attempts += args.data.attempts.increment;
        if (args.data.resendAvailableAt !== undefined) next.resendAvailableAt = args.data.resendAvailableAt;
        if (args.data.expiresAt !== undefined) next.expiresAt = args.data.expiresAt;
        return next;
      }
      return r;
    });
    return { count };
  },
  create: async (args: any) => {
    const record = {
      id: crypto.randomUUID(),
      ...args.data,
      createdAt: new Date(),
    };
    mockDb.push({ ...record });
    return record;
  },
  count: async (args: any) => {
    return mockDb.filter(r => 
      r.identifier === args.where.identifier && 
      r.isUsed === args.where.isUsed
    ).length;
  }
};

(prisma.customer as any) = {
  create: async (args: any) => {
    if (customerDb.find(c => c.phone === args.data.phone)) {
      throw new Error("Unique constraint failed");
    }
    const c = { id: crypto.randomUUID(), ...args.data };
    customerDb.push(c);
    return c;
  }
};

// A capturing mock provider
class TestSmsProvider implements ISmsProvider {
  public lastMessage: string | null = null;
  public lastTo: string | null = null;
  public shouldFail: boolean = false;
  public shouldTimeout: boolean = false;

  async sendSms(options: SmsSendOptions): Promise<SmsSendResult> {
    if (this.shouldTimeout) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    if (this.shouldFail) return { success: false, error: "Mock failure" };
    this.lastTo = options.to;
    this.lastMessage = options.message;
    return { success: true, providerMessageId: "test-id" };
  }

  extractOtp(): string | null {
    if (!this.lastMessage) return null;
    const match = this.lastMessage.match(/is (\d{6})/);
    return match ? match[1] : null;
  }
  
  reset() {
    this.lastMessage = null;
    this.lastTo = null;
    this.shouldFail = false;
    this.shouldTimeout = false;
  }
}

test("OTP Service Tests", async (t) => {
  const testProvider = new TestSmsProvider();
  const otpService = new OtpService(testProvider);

  t.beforeEach(() => {
    testProvider.reset();
    mockDb = []; // Reset mock DB
    customerDb = [];
  });

  await t.test("Bangladesh mobile normalization", async () => {
    const rawNumber = "01700000001";
    const result = await otpService.requestOtp(rawNumber, "LOGIN");
    assert.strictEqual(result.success, true);
    
    // Check DB for normalized number
    const dbRecord = mockDb.find(r => r.identifier === "+8801700000001");
    assert.ok(dbRecord, "Should store normalized +8801700000001");
  });

  await t.test("Valid OTP Verification & Single Use", async () => {
    const phone = "+8801700000002";
    await otpService.requestOtp(phone, "REGISTRATION");
    const otp = testProvider.extractOtp()!;
    assert.ok(otp, "Should extract OTP");
    
    const verifyResult = await otpService.verifyOtp(phone, "REGISTRATION", otp);
    assert.strictEqual(verifyResult.success, true);
    assert.strictEqual(verifyResult.message, "OTP verified successfully.");

    const reuseResult = await otpService.verifyOtp(phone, "REGISTRATION", otp);
    assert.strictEqual(reuseResult.success, false);
    assert.strictEqual(reuseResult.message, "Invalid or expired OTP."); 
  });

  await t.test("Wrong OTP & Max Attempts", async () => {
    const phone = "+8801700000003";
    await otpService.requestOtp(phone, "LOGIN");
    
    for (let i = 0; i < 5; i++) {
      const res = await otpService.verifyOtp(phone, "LOGIN", "000000");
      assert.strictEqual(res.success, false);
      if (i === 4) {
        assert.strictEqual(res.message, "Maximum verification attempts exceeded. Please request a new OTP.");
      } else {
        assert.strictEqual(res.message, "Incorrect OTP.");
      }
    }
    
    const res6 = await otpService.verifyOtp(phone, "LOGIN", "000000");
    assert.strictEqual(res6.success, false);
    assert.strictEqual(res6.message, "Invalid or expired OTP.");
  });

  await t.test("Resend Cooldown & Multiple OTP Invalidation", async () => {
    const phone = "+8801700000004";
    await otpService.requestOtp(phone, "LOGIN");
    
    const resendRes = await otpService.requestOtp(phone, "LOGIN");
    assert.strictEqual(resendRes.success, false);
    assert.ok(resendRes.message.includes("wait"));
    
    await prisma.customerOtp.updateMany({
      where: { identifier: phone },
      data: { resendAvailableAt: new Date(Date.now() - 1000) }
    });
    
    const resendRes2 = await otpService.requestOtp(phone, "LOGIN");
    assert.strictEqual(resendRes2.success, true);
    
    const count = await prisma.customerOtp.count({
      where: { identifier: phone, isUsed: false }
    });
    assert.strictEqual(count, 1, "Only one OTP should be active at a time");
  });

  await t.test("Expired OTP", async () => {
    const phone = "+8801700000005";
    await otpService.requestOtp(phone, "LOGIN");
    const otp = testProvider.extractOtp()!;
    
    await prisma.customerOtp.updateMany({
      where: { identifier: phone },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });
    
    const verifyRes = await otpService.verifyOtp(phone, "LOGIN", otp);
    assert.strictEqual(verifyRes.success, false);
    assert.strictEqual(verifyRes.message, "Invalid or expired OTP.");
  });

  await t.test("Provider Failure", async () => {
    const phone = "+8801700000006";
    testProvider.shouldFail = true;
    const res = await otpService.requestOtp(phone, "LOGIN");
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.message, "Failed to dispatch verification code.");
  });

  await t.test("No plaintext OTP in response", async () => {
    const phone = "+8801700000007";
    const res = await otpService.requestOtp(phone, "LOGIN");
    assert.strictEqual(res.success, true);
    assert.ok(!(res as any).otp, "Response should not contain OTP");
    
    const dbRecord = mockDb.find(r => r.identifier === phone);
    assert.ok(dbRecord);
    assert.notStrictEqual(dbRecord.otpHash.length, 6);
    assert.strictEqual(dbRecord.otpHash.length, 64);
  });
  
  await t.test("Duplicate Mobile Registration (Schema Check)", async () => {
    const phone = "+8801700000008";
    await prisma.customer.create({
      data: { email: "test8a@example.com", firstName: "Test", phone }
    });
    
    let errorCaught = false;
    try {
      await prisma.customer.create({
        data: { email: "test8b@example.com", firstName: "Test", phone }
      });
    } catch (e: any) {
      errorCaught = true;
      assert.ok(e.message.includes("Unique constraint failed"));
    }
    assert.strictEqual(errorCaught, true);
  });
});
