import { Response, NextFunction } from "express";
import { AuthRequest } from "../middlewares/auth";
import { courierRegistry } from "../integrations/courier/courier-provider.registry";
import { CourierConfigService } from "../integrations/courier/courier-config.service";
import { AppError } from "../utils/AppError";

export class CourierController {
  /**
   * List all registered courier providers with safe, masked configurations.
   * GET /api/v1/courier/providers
   */
  public static async listProviders(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const providers = await courierRegistry.listProvidersSafeInfo();
      const settings = await CourierConfigService.getSafeSettings();

      res.status(200).json({
        status: "success",
        data: {
          activeProvider: settings.activeProvider,
          providers,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get specific provider details and capabilities.
   * GET /api/v1/courier/providers/:id
   */
  public static async getProvider(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const provider = courierRegistry.getProvider(id);
      const settings = await CourierConfigService.getSettings();

      res.status(200).json({
        status: "success",
        data: {
          id: provider.id,
          name: provider.displayName,
          description: provider.description,
          isDefault: settings.activeProvider?.toLowerCase() === provider.id.toLowerCase(),
          isEnabled: provider.isEnabled(),
          isConfigured: provider.isConfigured(),
          status: provider.getStatus(),
          capabilities: provider.capabilities,
          safeConfig: provider.getSafeConfig(),
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update courier provider configuration or enabled status.
   * PUT /api/v1/courier/providers/:id
   */
  public static async updateProviderConfig(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user?.id || "system";

      if (!courierRegistry.hasProvider(id)) {
        throw new AppError(`Courier provider '${id}' not found.`, 404, "PROVIDER_NOT_FOUND");
      }

      const updatedSettings = await CourierConfigService.updateProviderConfig(
        id,
        req.body,
        userId,
        req
      );

      res.status(200).json({
        status: "success",
        message: `Courier provider '${id}' configuration updated successfully.`,
        data: updatedSettings,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Set the active/default courier provider for order dispatches.
   * POST /api/v1/courier/providers/active
   */
  public static async setActiveProvider(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { providerId } = req.body;
      const userId = req.user?.id || "system";

      if (!providerId || !courierRegistry.hasProvider(providerId)) {
        throw new AppError(
          `Invalid or unregistered courier provider: ${providerId}`,
          400,
          "INVALID_PROVIDER"
        );
      }

      await CourierConfigService.setActiveProvider(providerId, userId, req);

      res.status(200).json({
        status: "success",
        message: `Active courier provider set to '${providerId}'.`,
        data: { activeProvider: providerId },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Test connection and health check for a courier provider.
   * POST /api/v1/courier/providers/:id/test
   */
  public static async testProvider(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const health = await courierRegistry.testProvider(id);

      res.status(200).json({
        status: "success",
        data: health,
      });
    } catch (error) {
      next(error);
    }
  }
}
