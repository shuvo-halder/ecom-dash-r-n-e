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
