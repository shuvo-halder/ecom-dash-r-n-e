import test from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../config/db";
import { SettingService } from "../services/setting.service";
import { emailService } from "../services/email.service";
import { forgotPassword, resetPassword } from "../controllers/auth.controller";
import { AuditService } from "../services/audit.service";
import { errorHandler } from "../middlewares/errorHandler";

test("STEP EMAIL-2: Backend Security and Email Infrastructure Suite", async (suite) => {
  // In-memory mock data stores
  let mockActivityLogs: any[] = [];
  let mockSMTPSetting: any = {
    id: "smtp-1",
    host: "smtp.example.com",
    port: 587,
    secure: false,
    username: "user@example.com",
    password: "InitialPassword",
    fromEmail: "noreply@vyzobd.com",
    fromName: "Vyzobd Store",
    enabled: true,
  };
  let mockUsers: any[] = [];
  let mockRefreshTokens: any[] = [];

  // Track dispatched emails
  let dispatchedEmails: any[] = [];
  const originalSend = (emailService as any).transporter.sendMail;

  // Preserve original Prisma and Audit methods
  const origActivityLogCreate = prisma.activityLog.create;
  const origActivityLogFindFirst = prisma.activityLog.findFirst;
  const origSMTPFindFirst = prisma.sMTPSetting.findFirst;
  const origSMTPCreate = prisma.sMTPSetting.create;
  const origSMTPUpdate = prisma.sMTPSetting.update;
  const origUserFindUnique = prisma.user.findUnique;
  const origUserUpdate = prisma.user.update;
  const origRefreshTokenCreate = prisma.refreshToken.create;
  const origRefreshTokenUpdateMany = prisma.refreshToken.updateMany;
  const origRefreshTokenFindUnique = prisma.refreshToken.findUnique;
  const origLogSecurityAlert = AuditService.logSecurityAlert;
  const origLogPasswordReset = AuditService.logPasswordReset;

  const testAdminUser = {
    id: "user-admin-1",
    email: "admin.email2.test@vyzobd.com",
    firstName: "TestAdmin",
    lastName: "User",
    isActive: true,
    passwordHash: "initial-hash",
    passwordResetToken: null as string | null,
    passwordResetExpires: null as Date | null,
    failedLoginAttempts: 0,
    lockedUntil: null as Date | null,
  };

  suite.before(() => {
    mockUsers = [{ ...testAdminUser }];
    mockActivityLogs = [];
    mockRefreshTokens = [];
    dispatchedEmails = [];

    // Mock EmailService transporter
    (emailService as any).transporter.sendMail = async (mailOptions: any) => {
      dispatchedEmails.push(mailOptions);
      return { messageId: "mock-test-id", response: "250 OK" };
    };

    // Mock AuditService
    (AuditService.logSecurityAlert as any) = async () => {};
    (AuditService.logPasswordReset as any) = async () => {};

    // Mock Prisma SMTP methods
    (prisma.sMTPSetting.findFirst as any) = async () => ({ ...mockSMTPSetting });
    (prisma.sMTPSetting.create as any) = async ({ data }: any) => {
      mockSMTPSetting = { id: "smtp-1", ...data };
      return { ...mockSMTPSetting };
    };
    (prisma.sMTPSetting.update as any) = async ({ data }: any) => {
      Object.assign(mockSMTPSetting, data);
      return { ...mockSMTPSetting };
    };

    // Mock Prisma ActivityLog methods
    (prisma.activityLog.create as any) = async ({ data }: any) => {
      const record = { id: `log-${mockActivityLogs.length + 1}`, ...data, createdAt: new Date() };
      mockActivityLogs.push(record);
      return record;
    };
    (prisma.activityLog.findFirst as any) = async ({ where, orderBy }: any) => {
      const matched = mockActivityLogs.filter(log => {
        if (where?.action && log.action !== where.action) return false;
        if (where?.userId && log.userId !== where.userId) return false;
        return true;
      });
      return matched[matched.length - 1] || null;
    };

    // Mock Prisma User methods
    (prisma.user.findUnique as any) = async ({ where }: any) => {
      if (where.email) {
        return mockUsers.find(u => u.email === where.email) || null;
      }
      if (where.passwordResetToken) {
        return mockUsers.find(u => u.passwordResetToken === where.passwordResetToken) || null;
      }
      if (where.id) {
        return mockUsers.find(u => u.id === where.id) || null;
      }
      return null;
    };
    (prisma.user.update as any) = async ({ where, data }: any) => {
      const user = mockUsers.find(u => u.id === where.id);
      if (user) {
        Object.assign(user, data);
        return { ...user };
      }
      return null;
    };

    // Mock Prisma RefreshToken methods
    (prisma.refreshToken.create as any) = async ({ data }: any) => {
      const token = { id: `rf-${mockRefreshTokens.length + 1}`, ...data, createdAt: new Date() };
      mockRefreshTokens.push(token);
      return token;
    };
    (prisma.refreshToken.updateMany as any) = async ({ where, data }: any) => {
      let count = 0;
      mockRefreshTokens.forEach(token => {
        if (where?.userId && token.userId !== where.userId) return;
        if (where?.revokedAt === null && token.revokedAt !== null) return;
        Object.assign(token, data);
        count++;
      });
      return { count };
    };
    (prisma.refreshToken.findUnique as any) = async ({ where }: any) => {
      return mockRefreshTokens.find(t => t.id === where.id) || null;
    };
  });

  suite.after(() => {
    // Restore mocks
    (emailService as any).transporter.sendMail = originalSend;
    prisma.activityLog.create = origActivityLogCreate;
    prisma.activityLog.findFirst = origActivityLogFindFirst;
    prisma.sMTPSetting.findFirst = origSMTPFindFirst;
    prisma.sMTPSetting.create = origSMTPCreate;
    prisma.sMTPSetting.update = origSMTPUpdate;
    prisma.user.findUnique = origUserFindUnique;
    prisma.user.update = origUserUpdate;
    prisma.refreshToken.create = origRefreshTokenCreate;
    prisma.refreshToken.updateMany = origRefreshTokenUpdateMany;
    prisma.refreshToken.findUnique = origRefreshTokenFindUnique;
    AuditService.logSecurityAlert = origLogSecurityAlert;
    AuditService.logPasswordReset = origLogPasswordReset;
  });

  // Setup express test app
  const app = express();
  app.use(express.json());
  app.post("/api/v1/auth/forgot-password", forgotPassword);
  app.post("/api/v1/auth/reset-password", resetPassword);
  app.use(errorHandler);

  // TEST A: SMTP password redaction in ActivityLog
  await suite.test("Test A: SMTP password redaction - updateSMTP() never writes raw password to ActivityLog", async () => {
    const rawSecretPassword = "SuperSecretSMTPPassword123!#@";
    await SettingService.updateSMTP({
      host: "smtp.mailgun.org",
      port: 587,
      username: "postmaster@vyzobd.com",
      password: rawSecretPassword,
      fromEmail: "noreply@vyzobd.com",
      fromName: "Vyzobd Store",
      enabled: true,
    }, testAdminUser.id);

    const latestLog = await prisma.activityLog.findFirst({
      where: { action: "UPDATE_SMTP", userId: testAdminUser.id },
      orderBy: { createdAt: "desc" }
    });

    assert.ok(latestLog, "ActivityLog record for UPDATE_SMTP must exist");
    assert.ok(latestLog.details, "ActivityLog details must be populated");

    // Raw password MUST NOT exist in details string
    assert.strictEqual(latestLog.details.includes(rawSecretPassword), false, "Raw password must not be present in ActivityLog details");

    const parsed = JSON.parse(latestLog.details);
    assert.strictEqual(parsed.password, "[REDACTED]", "Password should be redacted to safe placeholder in ActivityLog");
    assert.strictEqual(parsed.host, "smtp.mailgun.org", "Host should be preserved");
    assert.strictEqual(parsed.port, 587, "Port should be preserved");
    assert.strictEqual(parsed.username, "postmaster@vyzobd.com", "Username should be preserved");

    // Database still gets the real password for SMTP operation
    assert.strictEqual(mockSMTPSetting.password, rawSecretPassword, "Database must still store the updated SMTP password");
  });

  // TEST B: Admin forgot-password response token removal
  await suite.test("Test B: Admin forgot-password response does not leak resetToken", async () => {
    dispatchedEmails = [];
    const res = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: testAdminUser.email });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "success");
    assert.strictEqual(res.body.message, "If your email is registered, you will receive a reset link.");
    assert.strictEqual(res.body.resetToken, undefined, "resetToken must NOT be present in response");
    assert.strictEqual(res.body.token, undefined, "token must NOT be present in response");
    assert.strictEqual(res.body.resetUrl, undefined, "resetUrl must NOT be present in response");

    // Also verify for non-existent email: response is identical, preventing enumeration
    const nonExistentRes = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "nonexistent.user@vyzobd.com" });

    assert.strictEqual(nonExistentRes.status, 200);
    assert.strictEqual(nonExistentRes.body.status, "success");
    assert.strictEqual(nonExistentRes.body.message, "If your email is registered, you will receive a reset link.");
    assert.strictEqual(nonExistentRes.body.resetToken, undefined);
  });

  // TEST C: Admin reset email dispatch
  await suite.test("Test C: Admin reset email is dispatched to EmailService with admin reset link", async () => {
    assert.strictEqual(dispatchedEmails.length, 1, "Exactly one email should have been dispatched for the valid user");
    const email = dispatchedEmails[0];
    assert.strictEqual(email.to, testAdminUser.email, "Recipient should match admin email");
    assert.ok(email.subject.includes("Password"), "Subject should indicate password reset");
    assert.ok(email.html.includes("/reset-password?token="), "Email HTML must contain reset-password link");
    assert.strictEqual(email.html.includes("TestAdmin"), true, "Email should greet the admin by name");
  });

  // TEST D: Reset token one-time use
  await suite.test("Test D: Reset token is one-time use only", async () => {
    // Extract raw token from the dispatched email link
    const email = dispatchedEmails[0];
    const match = email.html.match(/token=([a-f0-9]{64})/);
    assert.ok(match && match[1], "Raw token must be present in reset URL in email");
    const rawToken = match[1];

    // First reset attempt: must succeed
    const firstRes = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: rawToken, newPassword: "NewSecurePassword456!" });

    assert.strictEqual(firstRes.status, 200);
    assert.strictEqual(firstRes.body.status, "success");
    assert.strictEqual(firstRes.body.message, "Password reset successfully. You can now log in.");

    // Verify token was cleared in user record
    const userInDb = mockUsers.find(u => u.id === testAdminUser.id);
    assert.strictEqual(userInDb?.passwordResetToken, null, "passwordResetToken must be null after use");
    assert.strictEqual(userInDb?.passwordResetExpires, null, "passwordResetExpires must be null after use");

    // Second reset attempt with SAME token: must fail
    const secondRes = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: rawToken, newPassword: "AnotherPassword789!" });

    assert.strictEqual(secondRes.status, 400);
    const errorMessage = secondRes.body.error?.message || secondRes.body.message || "";
    assert.ok(errorMessage.includes("Invalid or expired token"), "Must return invalid or expired token error");
  });

  // TEST E: Refresh token revocation upon password reset
  await suite.test("Test E: Refresh tokens are revoked upon successful password reset", async () => {
    // Seed an active refresh token for test admin
    const rawRefreshToken = crypto.randomBytes(40).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawRefreshToken).digest("hex");
    const activeTokenRecord = await prisma.refreshToken.create({
      data: {
        token: tokenHash,
        userId: testAdminUser.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        revokedAt: null,
      }
    });

    assert.strictEqual(activeTokenRecord.revokedAt, null, "Token starts as active/unrevoked");

    // Request new forgot-password
    dispatchedEmails = [];
    await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: testAdminUser.email });

    assert.strictEqual(dispatchedEmails.length, 1);
    const match = dispatchedEmails[0].html.match(/token=([a-f0-9]{64})/);
    assert.ok(match && match[1]);
    const rawToken = match[1];

    // Perform password reset
    const res = await request(app)
      .post("/api/v1/auth/reset-password")
      .send({ token: rawToken, newPassword: "YetAnotherPassword999!" });

    assert.strictEqual(res.status, 200);

    // Verify refresh token in DB is now revoked
    const updatedToken = await prisma.refreshToken.findUnique({
      where: { id: activeTokenRecord.id }
    });
    assert.ok(updatedToken?.revokedAt !== null, "Refresh token must have revokedAt timestamp populated");
  });

  // TEST F: SMTP TLS resolution logic for ports 465 and 587
  await suite.test("Test F: SMTP TLS resolution behaves correctly for standard ports", async () => {
    // Port 465 defaults to secure: true
    assert.strictEqual(emailService.resolveSecure(465), true, "Port 465 should resolve to secure: true");
    assert.strictEqual(emailService.resolveSecure(465, true), true, "Port 465 with explicit true");
    assert.strictEqual(emailService.resolveSecure(465, false), false, "Port 465 with explicit false");

    // Port 587 defaults to secure: false (STARTTLS)
    assert.strictEqual(emailService.resolveSecure(587), false, "Port 587 should resolve to secure: false");
    assert.strictEqual(emailService.resolveSecure(587, false), false, "Port 587 with false should be false");
    assert.strictEqual(emailService.resolveSecure(587, true), false, "Port 587 should always be false (STARTTLS in Nodemailer)");

    // Custom ports
    assert.strictEqual(emailService.resolveSecure(25), false, "Port 25 defaults to false");
    assert.strictEqual(emailService.resolveSecure(2525), false, "Port 2525 defaults to false");
    assert.strictEqual(emailService.resolveSecure(2525, true), true, "Port 2525 with explicit true");

    // Also test SettingService.updateSMTP default secure deduction
    const s1 = await SettingService.updateSMTP({ host: "smtp.test.com", port: 587 }, "user-admin-1");
    assert.strictEqual(s1.secure, false, "Port 587 should default secure to false in SettingService");

    const s2 = await SettingService.updateSMTP({ host: "smtp.test.com", port: 465 }, "user-admin-1");
    assert.strictEqual(s2.secure, true, "Port 465 should default secure to true in SettingService");
  });

  // TEST G: Error logging safe diagnostics and sensitive data exclusion
  await suite.test("Test G: Email error logging captures safe diagnostics without leaking secrets", async () => {
    const dummyError: any = new Error("Connection refused at 10.0.0.1:587");
    dummyError.code = "ECONNREFUSED";
    dummyError.command = "CONN";
    dummyError.response = "421 Service not available";
    dummyError.responseCode = 421;

    (emailService as any).transporter.sendMail = async () => {
      throw dummyError;
    };

    const capturedLogs: any[] = [];
    const originalConsoleError = console.error;
    console.error = (...args: any[]) => {
      capturedLogs.push(args);
    };

    try {
      await emailService.sendAdminPasswordResetEmail("admin@vyzobd.com", "Admin", "sensitive-raw-token-xyz");
    } finally {
      console.error = originalConsoleError;
    }

    assert.ok(capturedLogs.length > 0, "Error should have been logged");
    const loggedArgs = capturedLogs[0];
    const logDetails = loggedArgs[1];

    assert.strictEqual(logDetails.code, "ECONNREFUSED", "Should capture error code");
    assert.strictEqual(logDetails.command, "CONN", "Should capture SMTP command");
    assert.strictEqual(logDetails.responseCode, 421, "Should capture responseCode");
    assert.strictEqual(logDetails.message, "Connection refused at 10.0.0.1:587", "Should capture message");

    const fullLogString = JSON.stringify(capturedLogs);
    assert.strictEqual(fullLogString.includes("sensitive-raw-token-xyz"), false, "Raw reset token must not appear in logs");
    assert.strictEqual(fullLogString.includes("SuperSecretSMTPPassword"), false, "SMTP password must not appear in logs");
  });
});
