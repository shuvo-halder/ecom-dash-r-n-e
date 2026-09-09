import {
  CourierCapabilities,
  CourierProviderStatus,
  NormalizedShipmentRequest,
  NormalizedShipmentResult,
  NormalizedCancelResult,
  NormalizedTrackingResult,
  ProviderHealthCheck,
} from "./courier.types";

/**
 * Standard Provider Interface that every Courier implementation must satisfy.
 * Guarantees that Order & Shipment business logic never couples directly to a specific third-party carrier.
 */
export interface ICourierProvider {
  /** Unique provider identifier ('manual', 'pathao', etc.) */
  readonly id: string;

  /** Human-readable display name ('Manual Courier', 'Pathao Courier', etc.) */
  readonly displayName: string;

  /** Descriptive summary of the provider */
  readonly description: string;

  /** Explicit capabilities supported by this courier provider */
  readonly capabilities: CourierCapabilities;

  /** Whether the provider has required credentials / configuration */
  isConfigured(): boolean;

  /** Whether the provider is enabled for use by the store */
  isEnabled(): boolean;

  /** Current normalized status ('AVAILABLE', 'CONFIGURED', 'NOT_CONFIGURED', 'DISABLED', 'ERROR') */
  getStatus(): CourierProviderStatus;

  /** Safe, sanitized configuration dictionary with all secrets stripped or masked */
  getSafeConfig(): Record<string, any>;

  /** Test the connection and health of the provider */
  checkHealth(): Promise<ProviderHealthCheck>;

  /** Create a shipment with the courier provider */
  createShipment(request: NormalizedShipmentRequest): Promise<NormalizedShipmentResult>;

  /** Cancel an existing shipment with the courier provider */
  cancelShipment(providerShipmentId: string, reason?: string): Promise<NormalizedCancelResult>;

  /** Retrieve normalized tracking information */
  getTracking(providerShipmentId: string, trackingNumber?: string): Promise<NormalizedTrackingResult>;

  /** Optional: Estimate courier delivery cost for merchant */
  calculateDeliveryCost?(request: {
    weightKg: number;
    city?: string;
    zone?: string;
    area?: string;
  }): Promise<{ deliveryFee: number } | null>;
}
