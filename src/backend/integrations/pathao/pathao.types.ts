export interface PathaoTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface PathaoErrorResponse {
  message?: string;
  error?: string;
  error_description?: string;
  errors?: Record<string, string[]>;
  code?: number;
}

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

export interface PathaoResponse<T> {
  type: string;
  data: T;
  code: number;
}

export interface PathaoDeliveryRequest {
  store_id: number;
  merchant_order_id: string;
  sender_name?: string;
  sender_phone?: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  recipient_city: number;
  recipient_zone: number;
  recipient_area: number;
  delivery_type: number; // 48 for normal, 12 for express
  item_type: number; // 1 for document, 2 for parcel
  special_instruction?: string;
  item_quantity: number;
  item_weight: number;
  amount_to_collect: number; // COD amount
  item_description?: string;
}

export interface PathaoDeliveryResponse {
  consignment_id: string;
  merchant_order_id: string;
  order_status: string;
  delivery_fee: number;
}
