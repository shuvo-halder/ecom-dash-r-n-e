import { pathaoClient } from "./pathao.client";
import {
  PathaoCity,
  PathaoZone,
  PathaoArea,
  PathaoStore,
  PathaoResponse,
} from "./pathao.types";
import { logger } from "../../config/logger";

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export class PathaoLocationService {
  private static cache = new Map<string, CacheEntry<any>>();
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours for locations

  private static getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private static setCache<T>(key: string, data: T, ttl: number = this.CACHE_TTL_MS): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttl });
  }

  /**
   * For testing: clear the cache
   */
  public static clearCache(): void {
    this.cache.clear();
  }

  /**
   * Fetch all Pathao cities
   */
  public static async getCities(): Promise<PathaoCity[]> {
    const cacheKey = "pathao_cities";
    const cached = this.getFromCache<PathaoCity[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await pathaoClient.getHttp().get<PathaoResponse<{ data: PathaoCity[] }>>(
        "/aladdin/api/v1/countries/1/city-list"
      );
      const cities = response.data.data.data;
      this.setCache(cacheKey, cities);
      return cities;
    } catch (error) {
      logger.error("[PathaoLocationService] Error fetching cities", { error });
      throw error;
    }
  }

  /**
   * Fetch Pathao zones for a specific city
   */
  public static async getZones(cityId: number): Promise<PathaoZone[]> {
    const cacheKey = `pathao_zones_${cityId}`;
    const cached = this.getFromCache<PathaoZone[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await pathaoClient.getHttp().get<PathaoResponse<{ data: PathaoZone[] }>>(
        `/aladdin/api/v1/cities/${cityId}/zone-list`
      );
      const zones = response.data.data.data;
      this.setCache(cacheKey, zones);
      return zones;
    } catch (error) {
      logger.error(`[PathaoLocationService] Error fetching zones for city ${cityId}`, { error });
      throw error;
    }
  }

  /**
   * Fetch Pathao areas for a specific zone
   */
  public static async getAreas(zoneId: number): Promise<PathaoArea[]> {
    const cacheKey = `pathao_areas_${zoneId}`;
    const cached = this.getFromCache<PathaoArea[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await pathaoClient.getHttp().get<PathaoResponse<{ data: PathaoArea[] }>>(
        `/aladdin/api/v1/zones/${zoneId}/area-list`
      );
      const areas = response.data.data.data;
      this.setCache(cacheKey, areas);
      return areas;
    } catch (error) {
      logger.error(`[PathaoLocationService] Error fetching areas for zone ${zoneId}`, { error });
      throw error;
    }
  }

  /**
   * Fetch all merchant stores configured in Pathao
   */
  public static async getStores(): Promise<PathaoStore[]> {
    const cacheKey = "pathao_stores";
    const cached = this.getFromCache<PathaoStore[]>(cacheKey);
    if (cached) return cached;

    try {
      const response = await pathaoClient.getHttp().get<PathaoResponse<{ data: PathaoStore[] }>>(
        "/aladdin/api/v1/stores"
      );
      const stores = response.data.data.data;
      // Stores might change more frequently than cities/zones, cache for 1 hour
      this.setCache(cacheKey, stores, 60 * 60 * 1000);
      return stores;
    } catch (error) {
      logger.error("[PathaoLocationService] Error fetching stores", { error });
      throw error;
    }
  }
}
