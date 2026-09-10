/**
 * Courier Provider Abstraction Types & Interfaces (STEP 20 & 21)
 * Provider-neutral contracts for shipping and courier integrations.
 */

export type CourierProviderId = "manual" | "pathao" | string;

export type CourierProviderStatus =
  | "AVAILABLE"
  | "CONFIGURED"
  | "NOT_CONFIGURED"
  | "DISABLED"
  | "ERROR";

export interface CourierCapabilities {
  supportsCreateShipment: boolean;
  supportsCancelShipment: boolean;
  supportsTracking: boolean;
  supportsRateCalculation: boolean;
  supportsAddressValidation: boolean;
}

export interface ProviderShipmentItem {
  orderItemId: string;
  name?: string;
  sku?: string;
  quantity: number;
  unitPrice?: number;
}

export interface NormalizedShipmentRequest {
  orderId: string;
  orderNumber: string;
  merchantReference?: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  recipientCity?: string;
  recipientZone?: string;
  recipientArea?: string;
  codAmount: number; // 0 for prepaid orders
  itemWeight?: number; // In kg (e.g. 0.5)
  itemQuantity?: number;
  specialInstructions?: string;
  items?: ProviderShipmentItem[];
  metadata?: Record<string, any>;
}

export interface NormalizedShipmentResult {
  success: boolean;
  provider: string;
  providerShipmentId?: string; // Consignment ID or provider tracking ID
  trackingNumber?: string;
  trackingUrl?: string;
  status: string; // Internal normalized status (e.g. PROCESSING, SHIPPED)
  deliveryFee?: number;
  estimatedDeliveryDays?: number;
  providerMetadata?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
}

export interface NormalizedCancelResult {
  success: boolean;
  provider: string;
  providerShipmentId?: string;
  cancelledAt?: Date;
  message?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface NormalizedTrackingEvent {
  status: string;
  message: string;
  location?: string;
  timestamp: Date;
}

export interface NormalizedTrackingResult {
  provider: string;
  providerShipmentId?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  status: string;
  providerStatus?: string;
  events: NormalizedTrackingEvent[];
}

export interface ProviderHealthCheck {
  providerId: string;
  healthy: boolean;
  status: CourierProviderStatus;
  message: string;
  testedAt: Date;
  details?: Record<string, any>;
}

export interface CourierProviderInfo {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  isEnabled: boolean;
  isConfigured: boolean;
  status: CourierProviderStatus;
  capabilities: CourierCapabilities;
  safeConfig: Record<string, any>;
}
