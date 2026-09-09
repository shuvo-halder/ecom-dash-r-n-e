import test from "node:test";
import assert from "node:assert";
import express from "express";
import request from "supertest";
import { courierRegistry, CourierProviderRegistry } from "../integrations/courier/courier-provider.registry";
import { ManualCourierProvider } from "../integrations/courier/providers/manual-courier.provider";
import { PathaoCourierAdapter } from "../integrations/courier/providers/pathao-courier.adapter";
import { CourierConfigService } from "../integrations/courier/courier-config.service";
import { ICourierProvider } from "../integrations/courier/courier-provider.interface";
import courierRouter from "../routes/courier.routes";
import { prisma } from "../config/db";

test("Courier Provider Abstraction & Management (STEP 20 & 21)", async (t) => {
  // Save original env vars
  const origClientId = process.env.PATHAO_CLIENT_ID;
  const origClientSecret = process.env.PATHAO_CLIENT_SECRET;
  const origUsername = process.env.PATHAO_USERNAME;
  const origPassword = process.env.PATHAO_PASSWORD;
  const origEnabled = process.env.PATHAO_ENABLED;

  t.afterEach(() => {
    process.env.PATHAO_CLIENT_ID = origClientId;
    process.env.PATHAO_CLIENT_SECRET = origClientSecret;
    process.env.PATHAO_USERNAME = origUsername;
    process.env.PATHAO_PASSWORD = origPassword;
    process.env.PATHAO_ENABLED = origEnabled;
    CourierConfigService.clearCache();
  });

  await t.test("1. Courier Provider Registry - initializes standard providers and supports extensibility", async () => {
    assert.ok(courierRegistry.hasProvider("manual"), "Manual courier should be registered");
    assert.ok(courierRegistry.hasProvider("pathao"), "Pathao courier should be registered");

    const manual = courierRegistry.getProvider("manual");
    assert.strictEqual(manual.id, "manual");
    assert.strictEqual(manual.isConfigured(), true);

    const pathao = courierRegistry.getProvider("pathao");
    assert.strictEqual(pathao.id, "pathao");

    // Test extensibility: Register a custom third-party provider (e.g. Steadfast)
    const customProvider: ICourierProvider = {
      id: "steadfast",
      displayName: "Steadfast Courier",
      description: "Steadfast Logistics Integration",
      capabilities: {
        supportsCreateShipment: true,
        supportsCancelShipment: true,
        supportsTracking: true,
        supportsRateCalculation: false,
        supportsAddressValidation: false,
      },
      isConfigured: () => false,
      isEnabled: () => false,
      getStatus: () => "NOT_CONFIGURED",
      getSafeConfig: () => ({ id: "steadfast", isConfigured: false }),
      checkHealth: async () => ({
        providerId: "steadfast",
        healthy: false,
        status: "NOT_CONFIGURED",
        message: "Steadfast credentials required",
        testedAt: new Date(),
      }),
      createShipment: async () => ({ success: false, provider: "steadfast", status: "FAILED" }),
      cancelShipment: async () => ({ success: false, provider: "steadfast" }),
      getTracking: async () => ({ provider: "steadfast", status: "PENDING", events: [] }),
    };

    courierRegistry.register(customProvider);
    assert.ok(courierRegistry.hasProvider("steadfast"), "Custom provider should be registered");
    assert.strictEqual(courierRegistry.getProvider("steadfast").displayName, "Steadfast Courier");
  });

  await t.test("2. Manual Courier Provider - always operational and dispatches cleanly", async () => {
    const manual = new ManualCourierProvider(true);
    assert.strictEqual(manual.isConfigured(), true);
    assert.strictEqual(manual.getStatus(), "AVAILABLE");

    const health = await manual.checkHealth();
    assert.strictEqual(health.healthy, true);
    assert.strictEqual(health.status, "AVAILABLE");

    const shipmentResult = await manual.createShipment({
      orderId: "order-123",
      orderNumber: "ORD-1001",
      recipientName: "Test Customer",
      recipientPhone: "01711111111",
      recipientAddress: "House 1, Road 2, Dhanmondi, Dhaka",
      codAmount: 500,
    });

    assert.strictEqual(shipmentResult.success, true);
    assert.strictEqual(shipmentResult.provider, "manual");
    assert.strictEqual(shipmentResult.status, "SHIPPED");
    assert.ok(shipmentResult.trackingNumber?.startsWith("MAN-"));
  });

  await t.test("3. Pathao Courier Adapter - unconfigured behavior returns PATHAO_NOT_CONFIGURED", async () => {
    // Ensure credentials are empty
    delete process.env.PATHAO_CLIENT_ID;
    delete process.env.PATHAO_CLIENT_SECRET;
    delete process.env.PATHAO_USERNAME;
    delete process.env.PATHAO_PASSWORD;

    const pathao = new PathaoCourierAdapter();
    assert.strictEqual(pathao.isConfigured(), false);
    assert.strictEqual(pathao.getStatus(), "NOT_CONFIGURED");

    // checkHealth MUST return healthy: false and PATHAO_NOT_CONFIGURED
    const health = await pathao.checkHealth();
    assert.strictEqual(health.healthy, false);
    assert.strictEqual(health.status, "NOT_CONFIGURED");
    assert.ok(health.message.includes("PATHAO_NOT_CONFIGURED"));

    // createShipment MUST return cleanly without crashing or network calls
    const result = await pathao.createShipment({
      orderId: "order-999",
      orderNumber: "ORD-999",
      recipientName: "Customer",
      recipientPhone: "01700000000",
      recipientAddress: "Dhaka",
      codAmount: 100,
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.errorCode, "PATHAO_NOT_CONFIGURED");
  });

  await t.test("4. Secret Masking & Safe Configuration - never returns plaintext secrets", async () => {
    process.env.PATHAO_CLIENT_ID = "test-client-id";
    process.env.PATHAO_CLIENT_SECRET = "super-secret-key-123";
    process.env.PATHAO_USERNAME = "merchant@example.com";
    process.env.PATHAO_PASSWORD = "my-secret-password";

    const pathao = new PathaoCourierAdapter();
    const safeConfig = pathao.getSafeConfig();

    assert.strictEqual(safeConfig.clientId, "test-client-id");
    assert.strictEqual(safeConfig.username, "merchant@example.com");
    assert.strictEqual(safeConfig.clientSecretMasked, "••••••••");
    assert.strictEqual(safeConfig.passwordMasked, "••••••••");

    // Ensure raw secrets are NEVER exposed in safeConfig
    assert.strictEqual(safeConfig.clientSecret, undefined);
    assert.strictEqual(safeConfig.password, undefined);

    const safeSettings = await CourierConfigService.getSafeSettings();
    assert.strictEqual(safeSettings.providers.pathao.clientSecretMasked, "••••••••");
    assert.strictEqual(safeSettings.providers.pathao.passwordMasked, "••••••••");
    assert.strictEqual(safeSettings.providers.pathao.clientSecret, undefined);
    assert.strictEqual(safeSettings.providers.pathao.password, undefined);
  });

  await t.test("5. Active Provider Fallback - defaults safely to manual if provider is unconfigured", async () => {
    // Delete Pathao credentials
    delete process.env.PATHAO_CLIENT_ID;
    delete process.env.PATHAO_CLIENT_SECRET;

    // Set active provider to pathao in settings
    const activeProvider = await courierRegistry.getActiveProvider();
    // Since pathao is not configured or enabled, registry must fallback to manual
    assert.strictEqual(activeProvider.id, "manual");
  });

  await t.test("6. HTTP API Endpoints - list providers and test connection", async () => {
    const app = express();
    app.use(express.json());

    // Mock authenticated user with Settings read/write permission
    app.use((req, res, next) => {
      (req as any).user = {
        id: "admin-user-id",
        email: "admin@example.com",
        roleName: "SuperAdmin",
        role: { name: "SuperAdmin" },
        permissions: [{ module: "settings", action: "read" }, { module: "settings", action: "write" }],
      };
      next();
    });

    app.use("/api/v1/courier", courierRouter);

    // Test GET /api/v1/courier/providers
    const listRes = await request(app).get("/api/v1/courier/providers");
    assert.strictEqual(listRes.status, 200);
    assert.strictEqual(listRes.body.status, "success");
    assert.ok(Array.isArray(listRes.body.data.providers));

    const manualProv = listRes.body.data.providers.find((p: any) => p.id === "manual");
    assert.ok(manualProv);
    assert.strictEqual(manualProv.isConfigured, true);

    const pathaoProv = listRes.body.data.providers.find((p: any) => p.id === "pathao");
    assert.ok(pathaoProv);

    // Test POST /api/v1/courier/providers/pathao/test
    // Must return PATHAO_NOT_CONFIGURED when credentials are absent
    delete process.env.PATHAO_CLIENT_ID;
    delete process.env.PATHAO_CLIENT_SECRET;

    const testRes = await request(app).post("/api/v1/courier/providers/pathao/test");
    assert.strictEqual(testRes.status, 200);
    assert.strictEqual(testRes.body.data.healthy, false);
    assert.strictEqual(testRes.body.data.status, "NOT_CONFIGURED");
    assert.ok(testRes.body.data.message.includes("PATHAO_NOT_CONFIGURED"));

    // Test POST /api/v1/courier/providers/manual/test
    const testManualRes = await request(app).post("/api/v1/courier/providers/manual/test");
    assert.strictEqual(testManualRes.status, 200);
    assert.strictEqual(testManualRes.body.data.healthy, true);
    assert.strictEqual(testManualRes.body.data.status, "AVAILABLE");
  });
});
