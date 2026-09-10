import { ICourierProvider } from "./courier-provider.interface";
import { CourierProviderInfo, ProviderHealthCheck } from "./courier.types";
import { ManualCourierProvider } from "./providers/manual-courier.provider";
import { PathaoCourierAdapter } from "./providers/pathao-courier.adapter";
import { CourierConfigService } from "./courier-config.service";
import { AppError } from "../../utils/AppError";

/**
 * Central registry for all courier and shipping providers in the application.
 * Facilitates provider-agnostic dispatching, health-checks, and capability lookups.
 */
export class CourierProviderRegistry {
  private static instance: CourierProviderRegistry | null = null;
  private providers: Map<string, ICourierProvider> = new Map();

  private constructor() {
    // Register built-in providers
    this.register(new ManualCourierProvider(true));
    this.register(new PathaoCourierAdapter());
  }

  public static getInstance(): CourierProviderRegistry {
    if (!this.instance) {
      this.instance = new CourierProviderRegistry();
    }
    return this.instance;
  }

  /**
   * Register a new courier provider into the system (e.g. future providers like Steadfast or RedX).
   */
  public register(provider: ICourierProvider): void {
    this.providers.set(provider.id.toLowerCase(), provider);
  }

  /**
   * Retrieves a specific provider by its ID.
   */
  public getProvider(id: string): ICourierProvider {
    const normalized = id?.toLowerCase();
    const provider = this.providers.get(normalized);
    if (!provider) {
      throw new AppError(
        `Courier provider '${id}' is not registered in the system.`,
        404,
        "COURIER_PROVIDER_NOT_FOUND"
      );
    }
    return provider;
  }

  /**
   * Checks if a provider exists.
   */
  public hasProvider(id: string): boolean {
    return this.providers.has(id?.toLowerCase());
  }

  /**
   * Returns all registered courier providers.
   */
  public getAllProviders(): ICourierProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Returns the currently active/default courier provider as configured in settings.
   * If the active provider is not configured or disabled, falls back safely to 'manual'.
   */
  public async getActiveProvider(): Promise<ICourierProvider> {
    const settings = await CourierConfigService.getSettings();
    const targetId = settings.activeProvider?.toLowerCase() || "manual";

    if (this.hasProvider(targetId)) {
      const provider = this.getProvider(targetId);
      if (provider.isEnabled() && provider.isConfigured()) {
        return provider;
      }
    }

    // Always fallback to manual provider
    return this.getProvider("manual");
  }

  /**
   * Returns a sanitized, safe list of all courier providers for the Admin Panel.
   * No API keys, passwords, or client secrets are exposed.
   */
  public async listProvidersSafeInfo(): Promise<CourierProviderInfo[]> {
    const settings = await CourierConfigService.getSettings();
    const result: CourierProviderInfo[] = [];

    for (const provider of this.providers.values()) {
      const isDefault = settings.activeProvider?.toLowerCase() === provider.id.toLowerCase();
      const safeConfig = provider.getSafeConfig();
      const status = provider.getStatus();

      result.push({
        id: provider.id,
        name: provider.displayName,
        description: provider.description,
        isDefault,
        isEnabled: provider.isEnabled(),
        isConfigured: provider.isConfigured(),
        status,
        capabilities: provider.capabilities,
        safeConfig,
      });
    }

    return result;
  }

  /**
   * Tests the connection or health status of a provider.
   */
  public async testProvider(id: string): Promise<ProviderHealthCheck> {
    const provider = this.getProvider(id);
    return await provider.checkHealth();
  }
}

// Export singleton convenience reference
export const courierRegistry = CourierProviderRegistry.getInstance();
