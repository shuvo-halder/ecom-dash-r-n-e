import { ICourierProvider } from "../courier-provider.interface";
import {
  CourierCapabilities,
  CourierProviderStatus,
  NormalizedShipmentRequest,
  NormalizedShipmentResult,
  NormalizedCancelResult,
  NormalizedTrackingResult,
  ProviderHealthCheck,
} from "../courier.types";
import { CourierConfigService } from "../courier-config.service";

export class ManualCourierProvider implements ICourierProvider {
  public readonly id = "manual";
  public readonly displayName = "Manual / In-House Courier";
  public readonly description =
    "In-house or manual shipping management. Allows assigning arbitrary tracking numbers and managing dispatch internally.";

  public readonly capabilities: CourierCapabilities = {
    supportsCreateShipment: true,
    supportsCancelShipment: true,
    supportsTracking: true,
    supportsRateCalculation: false,
    supportsAddressValidation: false,
  };

  private enabled: boolean = true;

  constructor(enabled: boolean = true) {
    this.enabled = enabled;
  }

  public isConfigured(): boolean {
    // Manual courier never requires external API credentials
    return true;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
  }

  public getStatus(): CourierProviderStatus {
    return this.enabled ? "AVAILABLE" : "DISABLED";
  }

  public getSafeConfig(): Record<string, any> {
    return {
      providerId: this.id,
      name: this.displayName,
      isConfigured: true,
      isEnabled: this.enabled,
      status: this.getStatus(),
    };
  }

  public async checkHealth(): Promise<ProviderHealthCheck> {
    return {
      providerId: this.id,
      healthy: this.enabled,
      status: this.getStatus(),
      message: this.enabled
        ? "Manual Courier provider is available and ready."
        : "Manual Courier provider is currently disabled in settings.",
      testedAt: new Date(),
    };
  }

  public async createShipment(
    request: NormalizedShipmentRequest
  ): Promise<NormalizedShipmentResult> {
    if (!this.enabled) {
      return {
        success: false,
        provider: this.id,
        status: "FAILED",
        errorCode: "PROVIDER_DISABLED",
        errorMessage: "Manual Courier provider is disabled.",
      };
    }

    // Generate or format a manual tracking reference if not supplied
    const trackingNumber =
      request.merchantReference ||
      `MAN-${request.orderNumber || Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 6)
        .toUpperCase()}`;

    const deliveryFee =
      typeof request.metadata?.deliveryFee === "number"
        ? request.metadata.deliveryFee
        : 0;

    const notes = request.specialInstructions || request.metadata?.notes;

    return {
      success: true,
      provider: this.id,
      providerShipmentId: trackingNumber,
      trackingNumber,
      trackingUrl: undefined,
      status: (request.metadata?.status as string) || "SHIPPED",
      deliveryFee,
      estimatedDeliveryDays: 2,
      providerMetadata: {
        method: "MANUAL_DISPATCH",
        notes: notes || undefined,
        dispatchedAt: new Date().toISOString(),
      },
    };
  }

  public async cancelShipment(
    providerShipmentId: string,
    reason?: string
  ): Promise<NormalizedCancelResult> {
    return {
      success: true,
      provider: this.id,
      providerShipmentId,
      cancelledAt: new Date(),
      message: reason ? `Cancelled: ${reason}` : "Manual shipment cancelled successfully.",
    };
  }

  public async getTracking(
    providerShipmentId: string,
    trackingNumber?: string
  ): Promise<NormalizedTrackingResult> {
    const trackingRef = trackingNumber || providerShipmentId;
    return {
      provider: this.id,
      providerShipmentId,
      trackingNumber: trackingRef,
      status: "IN_TRANSIT",
      providerStatus: "DISPATCHED",
      events: [
        {
          status: "DISPATCHED",
          message: "Shipment assigned for manual delivery",
          timestamp: new Date(),
        },
      ],
    };
  }
}
