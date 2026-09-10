import { api } from "../lib/api";

export interface CourierCapabilities {
  supportsCreateShipment: boolean;
  supportsCancelShipment: boolean;
  supportsTracking: boolean;
  supportsRateCalculation: boolean;
  supportsAddressValidation: boolean;
}

export interface CourierProviderInfo {
  id: string;
  name: string;
  description: string;
  isDefault: boolean;
  isEnabled: boolean;
  isConfigured: boolean;
  status: "AVAILABLE" | "CONFIGURED" | "NOT_CONFIGURED" | "DISABLED" | "ERROR";
  capabilities: CourierCapabilities;
  safeConfig: Record<string, any>;
}

export interface CourierSettingsResponse {
  activeProvider: string;
  providers: CourierProviderInfo[];
}

export interface ProviderHealthResponse {
  providerId: string;
  healthy: boolean;
  status: string;
  message: string;
  testedAt: string;
  details?: Record<string, any>;
}

export const listCourierProviders = async (): Promise<CourierSettingsResponse> => {
  const { data } = await api.get("/courier/providers");
  return data.data;
};

export const getCourierProvider = async (id: string): Promise<CourierProviderInfo> => {
  const { data } = await api.get(`/courier/providers/${id}`);
  return data.data;
};

export const updateCourierProvider = async (
  id: string,
  payload: any
): Promise<any> => {
  const { data } = await api.put(`/courier/providers/${id}`, payload);
  return data.data;
};

export const testCourierConnection = async (
  id: string
): Promise<ProviderHealthResponse> => {
  const { data } = await api.post(`/courier/providers/${id}/test`);
  return data.data;
};

export const setActiveCourierProvider = async (
  providerId: string
): Promise<any> => {
  const { data } = await api.post("/courier/providers/active", { providerId });
  return data.data;
};
