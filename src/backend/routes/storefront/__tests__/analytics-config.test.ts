import test from "node:test";
import assert from "node:assert";
import request from "supertest";
import express from "express";
import storefrontAnalyticsRouter from "../analytics.routes";
import storefrontSettingRouter from "../setting.routes";
import { errorHandler } from "../../../middlewares/errorHandler";
import { prisma } from "../../../config/db";

const app = express();
app.use(express.json());

const storefrontRouter = express.Router();
storefrontRouter.use("/analytics", storefrontAnalyticsRouter);
storefrontRouter.use("/settings", storefrontSettingRouter);
app.use("/api/storefront/v1", storefrontRouter);
app.use(errorHandler);

test("Storefront Analytics Configuration API Contract Tests", async (t) => {
  let existingAnalytics: any = null;

  t.before(async () => {
    existingAnalytics = await prisma.analyticsSetting.findFirst();
  });

  t.after(async () => {
    // Restore state if needed
    if (existingAnalytics) {
      await prisma.analyticsSetting.update({
        where: { id: existingAnalytics.id },
        data: {
          googleAnalyticsId: existingAnalytics.googleAnalyticsId,
          googleTagManagerId: existingAnalytics.googleTagManagerId,
          facebookPixelId: existingAnalytics.facebookPixelId,
          tiktokPixelId: existingAnalytics.tiktokPixelId,
          googleAdsId: existingAnalytics.googleAdsId,
          googleAdsConversionId: existingAnalytics.googleAdsConversionId,
          googleAdsConversionLabel: existingAnalytics.googleAdsConversionLabel,
          hotjarId: existingAnalytics.hotjarId,
          enableAnalytics: existingAnalytics.enableAnalytics,
        }
      });
    }
  });

  await t.test("GET /api/storefront/v1/analytics/config returns expected analytics contract", async () => {
    // Set test configuration
    let setting = await prisma.analyticsSetting.findFirst();
    if (setting) {
      await prisma.analyticsSetting.update({
        where: { id: setting.id },
        data: {
          googleAnalyticsId: "G-TEST123456",
          googleTagManagerId: "GTM-TEST999",
          facebookPixelId: "FB-PIXEL-888",
          tiktokPixelId: "TT-PIXEL-777",
          googleAdsId: "AW-111222333",
          googleAdsConversionId: "AW-111222333",
          googleAdsConversionLabel: "ConvLabelTest",
          hotjarId: "HJ-555444",
          enableAnalytics: true,
        }
      });
    } else {
      await prisma.analyticsSetting.create({
        data: {
          googleAnalyticsId: "G-TEST123456",
          googleTagManagerId: "GTM-TEST999",
          facebookPixelId: "FB-PIXEL-888",
          tiktokPixelId: "TT-PIXEL-777",
          googleAdsId: "AW-111222333",
          googleAdsConversionId: "AW-111222333",
          googleAdsConversionLabel: "ConvLabelTest",
          hotjarId: "HJ-555444",
          enableAnalytics: true,
        }
      });
    }

    const res = await request(app).get("/api/storefront/v1/analytics/config");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.status, "success");
    assert.ok(res.body.data);

    const config = res.body.data;
    assert.strictEqual(config.ga4MeasurementId, "G-TEST123456");
    assert.strictEqual(config.googleAnalyticsId, undefined);
    assert.strictEqual(config.gtmContainerId, "GTM-TEST999");
    assert.strictEqual(config.googleTagManagerId, undefined);
    assert.strictEqual(config.metaPixelId, undefined);
    assert.strictEqual(config.facebookPixelId, "FB-PIXEL-888");
    assert.strictEqual(config.tiktokPixelId, "TT-PIXEL-777");
    assert.strictEqual(config.googleAdsId, "AW-111222333");
    assert.strictEqual(config.googleAdsConversionId, "AW-111222333");
    assert.strictEqual(config.googleAdsConversionLabel, "ConvLabelTest");
    assert.strictEqual(config.hotjarId, "HJ-555444");
    assert.strictEqual(config.enableAnalytics, true);

    // Verify secret credentials are NOT exposed
    assert.strictEqual(config.ga4ApiSecret, undefined);
    assert.strictEqual(config.secret, undefined);
    assert.strictEqual(config.apiKey, undefined);
  });

  await t.test("GET /api/storefront/v1/settings/public includes unified analytics config", async () => {
    const res = await request(app).get("/api/storefront/v1/settings/public");
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data.analytics);

    const analytics = res.body.data.analytics;
    assert.strictEqual(analytics.ga4MeasurementId, "G-TEST123456");
    assert.strictEqual(analytics.googleAnalyticsId, undefined);
    assert.strictEqual(analytics.gtmContainerId, "GTM-TEST999");
    assert.strictEqual(analytics.googleTagManagerId, undefined);
    assert.strictEqual(analytics.metaPixelId, undefined);
    assert.strictEqual(analytics.facebookPixelId, "FB-PIXEL-888");
    assert.strictEqual(analytics.tiktokPixelId, "TT-PIXEL-777");
    assert.strictEqual(analytics.googleAdsId, "AW-111222333");
    assert.strictEqual(analytics.googleAdsConversionId, "AW-111222333");
    assert.strictEqual(analytics.googleAdsConversionLabel, "ConvLabelTest");
    assert.strictEqual(analytics.hotjarId, "HJ-555444");
    assert.strictEqual(analytics.enableAnalytics, true);

    // Verify secret credentials are NOT exposed
    assert.strictEqual(analytics.ga4ApiSecret, undefined);
  });
});
