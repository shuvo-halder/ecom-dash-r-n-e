import { api } from "../lib/api";

export interface PathaoCity {
  city_id: number;
  city_name: string;
}

export interface PathaoZone {
  zone_id: number;
  zone_name: string;
}

export interface PathaoArea {
  area_id: number;
  area_name: string;
  home_delivery_available: boolean;
  pickup_available: boolean;
}

export interface PathaoStore {
  store_id: number;
  store_name: string;
  store_address: string;
  city_id: number;
  zone_id: number;
  area_id: number;
}

export interface CreatePathaoShipmentPayload {
  store_id: number;
  recipient_city: number;
  recipient_zone: number;
  recipient_area: number;
  recipient_address: string;
  recipient_name?: string;
  recipient_phone?: string;
  cod_amount?: number;
  item_weight?: number;
  special_instruction?: string;
}

export const getPathaoCities = async (): Promise<PathaoCity[]> => {
  const { data } = await api.get("/pathao/cities");
  return data.data?.cities || [];
};

export const getPathaoZones = async (cityId: number): Promise<PathaoZone[]> => {
  const { data } = await api.get(`/pathao/cities/${cityId}/zones`);
  return data.data?.zones || [];
};

export const getPathaoAreas = async (zoneId: number): Promise<PathaoArea[]> => {
  const { data } = await api.get(`/pathao/zones/${zoneId}/areas`);
  return data.data?.areas || [];
};

export const getPathaoStores = async (): Promise<PathaoStore[]> => {
  const { data } = await api.get("/pathao/stores");
  return data.data?.stores || [];
};

export const createPathaoShipment = async (orderId: string, payload: CreatePathaoShipmentPayload) => {
  const { data } = await api.post(`/pathao/orders/${orderId}/ship`, payload);
  return data.data?.shipment;
};

export const refreshPathaoShipment = async (shipmentId: string) => {
  const { data } = await api.post(`/pathao/shipments/${shipmentId}/refresh`);
  return data.data?.shipment;
};

export const cancelPathaoShipment = async (shipmentId: string, reason?: string) => {
  const { data } = await api.post(`/pathao/shipments/${shipmentId}/cancel`, { reason });
  return data.data?.shipment;
};

export const getPathaoShipment = async (shipmentId: string) => {
  const { data } = await api.get(`/pathao/shipments/${shipmentId}`);
  return data.data?.shipment;
};
