
import { PermissionService } from "../services/permission.service";
import test from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import { prisma } from "../config/db";
import settingRoutes from "../routes/setting.routes";
import { errorHandler } from "../middlewares/errorHandler";
import { emailService } from "../services/email.service";


// Mock Authentication
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { 
    id: "admin1", 
    role: { name: "SUPER_ADMIN" }, 
    email: "admin@test.com",
    permissions: [{ module: "Settings", actions: ["read", "write"] }] // It expects 'module', not 'resource'
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
  const origBrandingFindFirst = prisma.brandingSetting.findFirst;
  const origCreateRealTransporter = emailService.createRealTransporter;
  
  suite.after(() => {
    prisma.sMTPSetting.findFirst = origSMTPFindFirst;
    prisma.brandingSetting.findFirst = origBrandingFindFirst;
    emailService.createRealTransporter = origCreateRealTransporter;
  });

  
  suite.beforeEach(() => {
    (PermissionService.isSuperAdmin as any) = () => true;
    (PermissionService.hasPermission as any) = () => true;

    verifyCalled = false;
    sentEmails = [];
    (prisma.sMTPSetting.findFirst as any) = async () => mockSMTPSetting;
    (prisma.brandingSetting.findFirst as any) = async () => ({ storeName: "Test Store Brand" });
    
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
    
    console.log("RESPONSE:", res.body);
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
});
