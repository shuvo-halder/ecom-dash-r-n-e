import { PermissionService } from "../services/permission.service";
import test from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import { prisma } from "../config/db";
import settingRoutes from "../routes/setting.routes";
import { errorHandler } from "../middlewares/errorHandler";
import { emailService } from "../services/email.service";
import {
  getOrderConfirmationHtml,
  getOrderProcessingHtml,
  getOrderConfirmedHtml,
  getOrderCancelledHtml,
  getPaymentSuccessHtml,
  getPaymentFailedHtml,
  getOrderShippedHtml,
  getOrderDeliveredHtml,
  getReturnRequestedHtml,
  getReturnApprovedHtml,
  getReturnRejectedHtml,
  getReturnReceivedHtml,
  getRefundRequestedHtml,
  getRefundCompletedHtml,
  getRefundRejectedHtml,
} from "../services/email/templates";

// Mock Authentication
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { 
    id: "admin1", 
    role: { name: "SUPER_ADMIN" }, 
    email: "admin@test.com",
    permissions: [{ module: "Settings", actions: ["read", "write"] }]
  };
  return next();
};

const app = express();
app.use(express.json());
// Inject mocks
app.use((req, res, next) => mockAuth(req, res, next));
app.use("/api/v1/settings", settingRoutes);
app.use(errorHandler);

test("EMAIL-4: SMTP Operational Verification", async (suite) => {
  let mockSMTPSetting: any = {
    id: "smtp-1",
    host: "smtp.example.com",
    port: 587,
    secure: false,
    username: "user@example.com",
    password: "SecurePassword",
    fromEmail: "noreply@store.com",
    fromName: "My Store",
    enabled: true,
  };

  let verifyCalled = false;
  let sentEmails: any[] = [];
  
  // Mock dependencies
  const origSMTPFindFirst = prisma.sMTPSetting.findFirst;
  const origSMTPUpdate = prisma.sMTPSetting.update;
  const origSMTPCreate = prisma.sMTPSetting.create;
  const origBrandingFindFirst = prisma.brandingSetting.findFirst;
  const origCreateRealTransporter = emailService.createRealTransporter;
  const origActivityLogCreate = prisma.activityLog.create;
  
  suite.after(() => {
    prisma.sMTPSetting.findFirst = origSMTPFindFirst;
    prisma.sMTPSetting.update = origSMTPUpdate;
    prisma.sMTPSetting.create = origSMTPCreate;
    prisma.brandingSetting.findFirst = origBrandingFindFirst;
    emailService.createRealTransporter = origCreateRealTransporter;
    prisma.activityLog.create = origActivityLogCreate;
  });

  suite.beforeEach(() => {
    (PermissionService.isSuperAdmin as any) = () => true;
    (PermissionService.hasPermission as any) = () => true;

    verifyCalled = false;
    sentEmails = [];
    (prisma.sMTPSetting.findFirst as any) = async () => ({ ...mockSMTPSetting });
    (prisma.sMTPSetting.update as any) = async ({ data }: any) => {
      Object.assign(mockSMTPSetting, data);
      return { ...mockSMTPSetting };
    };
    (prisma.sMTPSetting.create as any) = async ({ data }: any) => {
      mockSMTPSetting = { id: "smtp-1", ...data };
      return { ...mockSMTPSetting };
    };
    (prisma.activityLog.create as any) = async () => ({ id: "act-1" });
    // Use the actual Prisma BrandingSetting model field: siteName
    (prisma.brandingSetting.findFirst as any) = async () => ({ siteName: "Test Store Brand" });
    
    (emailService.createRealTransporter as any) = async () => {
       return {
         verify: async () => { verifyCalled = true; return true; },
         sendMail: async (options: any) => { sentEmails.push(options); return true; }
       };
    };
  });

  await suite.test("1. SMTP Port 465 defaults to secure true", async () => {
    const isSecure = emailService.resolveSecure(465);
    assert.strictEqual(isSecure, true);
  });

  await suite.test("2. SMTP Port 587 defaults to secure false", async () => {
    const isSecure = emailService.resolveSecure(587);
    assert.strictEqual(isSecure, false);
  });

  await suite.test("3. Explicit secure override is respected", async () => {
    const isSecure = emailService.resolveSecure(465, false);
    assert.strictEqual(isSecure, false);
  });

  await suite.test("4. Test SMTP Endpoint sends email to authenticated user", async () => {
    const res = await request(app).post("/api/v1/settings/smtp/test").send();
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "success");
    assert.strictEqual(verifyCalled, true, "Transporter verify should be called");
    assert.strictEqual(sentEmails.length, 1);
    assert.strictEqual(sentEmails[0].to, "admin@test.com", "Should only send to authenticated user");
    assert.strictEqual(sentEmails[0].html.includes("Test Store Brand"), true, "Should inject store branding");
    assert.strictEqual(sentEmails[0].html.includes("Storefront"), false, "Should not use placeholder branding");
  });

  await suite.test("5. Disabled SMTP safely rejects test", async () => {
    mockSMTPSetting.enabled = false;
    const res = await request(app).post("/api/v1/settings/smtp/test").send();
    
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.message.includes("SMTP is currently disabled"), true);
    mockSMTPSetting.enabled = true; // reset
  });
  
  await suite.test("6. SMTP Failure returns safe error, no credentials", async () => {
    (emailService.createRealTransporter as any) = async () => {
       return {
         verify: async () => { throw new Error("Connection Timeout"); },
       };
    };
    
    const res = await request(app).post("/api/v1/settings/smtp/test").send();
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.message.includes("SecurePassword"), false, "Must not leak password");
    assert.strictEqual(res.body.message.includes("SMTP connection failed"), true);
  });

  await suite.test("7. PUT /api/v1/settings/smtp masks password in HTTP response", async () => {
    mockSMTPSetting.password = "InitialSecret123";
    const res = await request(app)
      .put("/api/v1/settings/smtp")
      .send({ host: "smtp.example.com", port: 587, password: "NewSuperSecret456!" });
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "success");
    assert.strictEqual(res.body.data.password, "********", "Password must be masked in API response");
    assert.strictEqual(JSON.stringify(res.body).includes("NewSuperSecret456!"), false, "Raw password must not be present in response payload");
    // DB must retain the actual updated password
    assert.strictEqual(mockSMTPSetting.password, "NewSuperSecret456!", "Real password must be retained in database");
  });

  await suite.test("8. Password retention: incoming '********' preserves existing database password", async () => {
    mockSMTPSetting.password = "ExistingSecretPassword789";
    const res = await request(app)
      .put("/api/v1/settings/smtp")
      .send({ host: "smtp.updated.com", port: 587, password: "********" });
    
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.password, "********");
    assert.strictEqual(mockSMTPSetting.password, "ExistingSecretPassword789", "Database password must not be overwritten by mask placeholder");
    assert.strictEqual(mockSMTPSetting.host, "smtp.updated.com", "Other fields should update normally");
  });

  await suite.test("9. Dynamic branding uses BrandingSetting.siteName from Prisma schema", async () => {
    (prisma.brandingSetting.findFirst as any) = async () => ({ siteName: "Apex Retail Co" });
    const resolvedName = await emailService.getStoreName();
    assert.strictEqual(resolvedName, "Apex Retail Co", "EmailService must read siteName from BrandingSetting");
  });

  await suite.test("10. Customer email templates accept and render dynamic storeName", async () => {
    const testStore = "Custom Brand Enterprise";
    const dummyOrder = { orderNumber: "ORD-9999", items: [], total: 100, shippingAddress: "123 Test St", billingAddress: "123 Test St" };
    const dummyPayment = { currency: "BDT", amount: 100, provider: "bKash" };
    const dummyShipment = { trackingNumber: "TRK-123", courier: { name: "Pathao" } };
    const dummyReturn = { id: "ret-1234-uuid" };
    const dummyRefund = { currency: "BDT", amount: 100 };

    const renderedTemplates = [
      getOrderConfirmationHtml("Alice", dummyOrder, testStore),
      getOrderProcessingHtml("Alice", dummyOrder, testStore),
      getOrderConfirmedHtml("Alice", dummyOrder, testStore),
      getOrderCancelledHtml("Alice", dummyOrder, testStore),
      getPaymentSuccessHtml("Alice", dummyPayment, dummyOrder, testStore),
      getPaymentFailedHtml("Alice", dummyPayment, dummyOrder, testStore),
      getOrderShippedHtml("Alice", dummyShipment, dummyOrder, testStore),
      getOrderDeliveredHtml("Alice", dummyShipment, dummyOrder, testStore),
      getReturnRequestedHtml("Alice", dummyReturn, dummyOrder, testStore),
      getReturnApprovedHtml("Alice", dummyReturn, dummyOrder, testStore),
      getReturnRejectedHtml("Alice", dummyReturn, dummyOrder, testStore),
      getReturnReceivedHtml("Alice", dummyReturn, dummyOrder, testStore),
      getRefundRequestedHtml("Alice", dummyRefund, dummyOrder, testStore),
      getRefundCompletedHtml("Alice", dummyRefund, dummyOrder, testStore),
      getRefundRejectedHtml("Alice", dummyRefund, dummyOrder, testStore),
    ];

    for (let i = 0; i < renderedTemplates.length; i++) {
      const html = renderedTemplates[i];
      assert.strictEqual(html.includes("Custom Brand Enterprise"), true, `Template ${i + 1} must include dynamic store name`);
      assert.strictEqual(html.includes("Storefront"), false, `Template ${i + 1} must not fall back to default Storefront`);
    }
  });
});
