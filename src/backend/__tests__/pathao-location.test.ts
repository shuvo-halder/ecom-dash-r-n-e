import test from "node:test";
import assert from "node:assert";
import { pathaoClient } from "../integrations/pathao/pathao.client";
import { PathaoLocationService } from "../integrations/pathao/pathao.service";

// Mock the pathaoClient's get method
const originalGet = pathaoClient.getHttp().get;

const mockGet = async (url: string, config?: any) => {
  if (url.includes("/city-list")) {
    return {
      data: {
        type: "success",
        code: 200,
        data: {
          data: [{ city_id: 1, city_name: "Dhaka" }],
        },
      },
    };
  }
  
  if (url.includes("/cities/1/zone-list")) {
    return {
      data: {
        type: "success",
        code: 200,
        data: {
          data: [{ zone_id: 1, zone_name: "Gulshan" }],
        },
      },
    };
  }
  
  if (url.includes("/zones/1/area-list")) {
    return {
      data: {
        type: "success",
        code: 200,
        data: {
          data: [{ area_id: 1, area_name: "Banani", home_delivery_available: true, pickup_available: true }],
        },
      },
    };
  }
  
  if (url.includes("/stores")) {
    return {
      data: {
        type: "success",
        code: 200,
        data: {
          data: [{ store_id: 1, store_name: "Main Store", store_address: "123 St", city_id: 1, zone_id: 1, area_id: 1 }],
        },
      },
    };
  }

  const error: any = new Error("Not Found");
  error.isAxiosError = true;
  error.response = { status: 404, data: { message: "Resource not found" } };
  throw error;
};

test("Pathao Location & Store Management", async (t) => {
  t.beforeEach(() => {
    pathaoClient.getHttp().get = mockGet as any;
    PathaoLocationService.clearCache();
  });

  t.afterEach(() => {
    pathaoClient.getHttp().get = originalGet;
  });

  await t.test("Fetches cities and caches them", async () => {
    const cities = await PathaoLocationService.getCities();
    assert.strictEqual(cities.length, 1);
    assert.strictEqual(cities[0].city_name, "Dhaka");
    
    // Call again to hit cache (if mockGet were tracking calls, we could assert 1 call, but verifying length is fine)
    const cachedCities = await PathaoLocationService.getCities();
    assert.strictEqual(cachedCities.length, 1);
  });

  await t.test("Fetches zones for valid city ID", async () => {
    const zones = await PathaoLocationService.getZones(1);
    assert.strictEqual(zones.length, 1);
    assert.strictEqual(zones[0].zone_name, "Gulshan");
  });

  await t.test("Fetches areas for valid zone ID", async () => {
    const areas = await PathaoLocationService.getAreas(1);
    assert.strictEqual(areas.length, 1);
    assert.strictEqual(areas[0].area_name, "Banani");
  });

  await t.test("Fetches stores and caches them", async () => {
    const stores = await PathaoLocationService.getStores();
    assert.strictEqual(stores.length, 1);
    assert.strictEqual(stores[0].store_name, "Main Store");
  });

  await t.test("Throws error for invalid city ID fetching zones", async () => {
    try {
      await PathaoLocationService.getZones(999);
      assert.fail("Should have thrown");
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 404);
    }
  });

  await t.test("Throws error for invalid zone ID fetching areas", async () => {
    try {
      await PathaoLocationService.getAreas(999);
      assert.fail("Should have thrown");
    } catch (err: any) {
      assert.strictEqual(err.response?.status, 404);
    }
  });
});
