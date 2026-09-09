import { prisma } from "../../config/db";
import { AuditService } from "../../services/audit.service";
import { Request } from "express";

export interface PathaoStoredConfig {
  enabled: boolean;
  baseURL: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
  webhookSecret: string;
  defaultStoreId?: number;
}

export interface CourierSettingsRecord {
  activeProvider: string;
  manual: {
    enabled: boolean;
    defaultCourierName?: string;
  };
  pathao: PathaoStoredConfig;
}

const SETTINGS_KEY = "courier.providers_config";
const ACTIVE_PROVIDER_KEY = "courier.active_provider";

export class CourierConfigService {
  private static cachedSettings: CourierSettingsRecord | null = null;
  private static cacheExpiresAt: number = 0;
  private static readonly TTL_MS = 60 * 1000; // 1 minute cache

  public static getDefaultSettings(): CourierSettingsRecord {
    return {
      activeProvider: "manual",
      manual: {
        enabled: true,
        defaultCourierName: "In-House Courier",
      },
      pathao: {
        enabled: process.env.PATHAO_ENABLED === "true",
        baseURL: process.env.PATHAO_BASE_URL || "https://api-hermes.pathao.com",
        clientId: process.env.PATHAO_CLIENT_ID || "",
        clientSecret: process.env.PATHAO_CLIENT_SECRET || "",
        username: process.env.PATHAO_USERNAME || "",
        password: process.env.PATHAO_PASSWORD || "",
        webhookSecret: process.env.PATHAO_WEBHOOK_SECRET || "",
        defaultStoreId: process.env.PATHAO_DEFAULT_STORE_ID ? Number(process.env.PATHAO_DEFAULT_STORE_ID) : undefined,
      },
    };
  }

  /**
   * Retrieves current courier settings from DB or env fallback.
   */
  public static async getSettings(): Promise<CourierSettingsRecord> {
    const now = Date.now();
    if (this.cachedSettings && this.cacheExpiresAt > now) {
      return this.cachedSettings;
    }

    try {
      const setting = await prisma.setting.findUnique({
        where: { key: SETTINGS_KEY },
      });

      if (setting && setting.value) {
        const parsed = JSON.parse(setting.value);
        this.cachedSettings = {
          activeProvider: parsed.activeProvider || "manual",
          manual: {
            enabled: parsed.manual?.enabled !== undefined ? parsed.manual.enabled : true,
            defaultCourierName: parsed.manual?.defaultCourierName || "In-House Courier",
          },
          pathao: {
            enabled: Boolean(parsed.pathao?.enabled),
            baseURL: parsed.pathao?.baseURL || process.env.PATHAO_BASE_URL || "https://api-hermes.pathao.com",
            clientId: parsed.pathao?.clientId || process.env.PATHAO_CLIENT_ID || "",
            clientSecret: parsed.pathao?.clientSecret || process.env.PATHAO_CLIENT_SECRET || "",
            username: parsed.pathao?.username || process.env.PATHAO_USERNAME || "",
            password: parsed.pathao?.password || process.env.PATHAO_PASSWORD || "",
            webhookSecret: parsed.pathao?.webhookSecret || process.env.PATHAO_WEBHOOK_SECRET || "",
            defaultStoreId: parsed.pathao?.defaultStoreId,
          },
        };
      } else {
        // Fallback to dynamic defaults from env
        this.cachedSettings = this.getDefaultSettings();
      }
    } catch {
      // In tests or DB error, fall back to dynamic default from env
      this.cachedSettings = this.getDefaultSettings();
    }

    this.cacheExpiresAt = now + this.TTL_MS;
    return this.cachedSettings;
  }

  /**
   * Check if Pathao is fully configured (all 4 primary credentials exist).
   */
  public static async isPathaoConfigured(): Promise<boolean> {
    const settings = await this.getSettings();
    const p = settings.pathao;
    return Boolean(
      p.clientId &&
      p.clientId.trim().length > 0 &&
      p.clientSecret &&
      p.clientSecret.trim().length > 0 &&
      p.username &&
      p.username.trim().length > 0 &&
      p.password &&
      p.password.trim().length > 0
    );
  }

  /**
   * Returns safe, masked configuration for the Admin UI.
   * NEVER exposes clientSecret, password, or tokens!
   */
  public static async getSafeSettings(): Promise<{
    activeProvider: string;
    providers: Record<string, any>;
  }> {
    const settings = await this.getSettings();
    const isPathaoConfigured = await this.isPathaoConfigured();

    return {
      activeProvider: settings.activeProvider,
      providers: {
        manual: {
          id: "manual",
          name: "Manual / In-House Courier",
          enabled: settings.manual.enabled,
          isConfigured: true,
          status: settings.manual.enabled ? "AVAILABLE" : "DISABLED",
          defaultCourierName: settings.manual.defaultCourierName,
        },
        pathao: {
          id: "pathao",
          name: "Pathao Courier",
          enabled: settings.pathao.enabled,
          isConfigured: isPathaoConfigured,
          status: !settings.pathao.enabled
            ? "DISABLED"
            : isPathaoConfigured
            ? "CONFIGURED"
            : "NOT_CONFIGURED",
          baseURL: settings.pathao.baseURL,
          clientId: settings.pathao.clientId || "",
          username: settings.pathao.username || "",
          defaultStoreId: settings.pathao.defaultStoreId || null,
          hasClientSecret: Boolean(settings.pathao.clientSecret && settings.pathao.clientSecret.length > 0),
          hasPassword: Boolean(settings.pathao.password && settings.pathao.password.length > 0),
          hasWebhookSecret: Boolean(settings.pathao.webhookSecret && settings.pathao.webhookSecret.length > 0),
          clientSecretMasked: settings.pathao.clientSecret ? "••••••••" : "",
          passwordMasked: settings.pathao.password ? "••••••••" : "",
          webhookSecretMasked: settings.pathao.webhookSecret ? "••••••••" : "",
        },
      },
    };
  }

  /**
   * Updates provider configuration safely. Masks sensitive fields.
   */
  public static async updateProviderConfig(
    providerId: string,
    updates: any,
    userId: string,
    req?: Request
  ): Promise<any> {
    const current = await this.getSettings();

    if (providerId === "manual") {
      if (updates.enabled !== undefined) {
        current.manual.enabled = Boolean(updates.enabled);
      }
      if (updates.defaultCourierName !== undefined) {
        current.manual.defaultCourierName = String(updates.defaultCourierName);
      }
      if (updates.isDefault) {
        current.activeProvider = "manual";
      }
    } else if (providerId === "pathao") {
      if (updates.enabled !== undefined) {
        current.pathao.enabled = Boolean(updates.enabled);
      }
      if (updates.baseURL) {
        current.pathao.baseURL = updates.baseURL;
      }
      if (updates.clientId !== undefined) {
        current.pathao.clientId = updates.clientId.trim();
      }
      // Only overwrite secret/password if not masked
      if (updates.clientSecret && !updates.clientSecret.includes("••••") && updates.clientSecret !== "********") {
        current.pathao.clientSecret = updates.clientSecret.trim();
      }
      if (updates.username !== undefined) {
        current.pathao.username = updates.username.trim();
      }
      if (updates.password && !updates.password.includes("••••") && updates.password !== "********") {
        current.pathao.password = updates.password.trim();
      }
      if (updates.webhookSecret && !updates.webhookSecret.includes("••••") && updates.webhookSecret !== "********") {
        current.pathao.webhookSecret = updates.webhookSecret.trim();
      }
      if (updates.defaultStoreId !== undefined) {
        current.pathao.defaultStoreId = updates.defaultStoreId ? Number(updates.defaultStoreId) : undefined;
      }
      if (updates.isDefault) {
        current.activeProvider = "pathao";
      }
    } else {
      throw new Error(`Unknown courier provider: ${providerId}`);
    }

    // Save to DB
    try {
      await prisma.setting.upsert({
        where: { key: SETTINGS_KEY },
        update: {
          value: JSON.stringify(current),
          type: "json",
          updatedAt: new Date(),
        },
        create: {
          group: "courier",
          key: SETTINGS_KEY,
          value: JSON.stringify(current),
          type: "json",
          description: "Courier providers configuration",
          isPublic: false,
        },
      });
    } catch {
      // In-memory update persisted anyway
    }

    this.cachedSettings = current;
    this.cacheExpiresAt = Date.now() + this.TTL_MS;

    // Audit Logging
    await AuditService.createLog(
      userId,
      "UPDATE_COURIER_CONFIG",
      "Settings",
      providerId,
      null,
      {
        provider: providerId,
        enabled: providerId === "manual" ? current.manual.enabled : current.pathao.enabled,
        activeProvider: current.activeProvider,
      },
      req
    );

    return this.getSafeSettings();
  }

  /**
   * Sets the active/default courier provider.
   */
  public static async setActiveProvider(providerId: string, userId: string, req?: Request): Promise<void> {
    const current = await this.getSettings();
    current.activeProvider = providerId;
    this.cachedSettings = current;

    try {
      await prisma.setting.upsert({
        where: { key: SETTINGS_KEY },
        update: { value: JSON.stringify(current), updatedAt: new Date() },
        create: {
          group: "courier",
          key: SETTINGS_KEY,
          value: JSON.stringify(current),
          type: "json",
          description: "Courier providers configuration",
        },
      });
    } catch {
      // Ignore
    }

    await AuditService.createLog(
      userId,
      "SET_ACTIVE_COURIER_PROVIDER",
      "Settings",
      providerId,
      null,
      { activeProvider: providerId },
      req
    );
  }

  public static clearCache(): void {
    this.cachedSettings = null;
    this.cacheExpiresAt = 0;
  }
}
