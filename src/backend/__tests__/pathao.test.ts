import test from "node:test";
import assert from "node:assert";
import axios, { AxiosError } from "axios";
import { PathaoAuth } from "../integrations/pathao/pathao.auth";
import { pathaoClient } from "../integrations/pathao/pathao.client";
import { validatePathaoConfig, PathaoConfig } from "../integrations/pathao/pathao.config";

// Mock axios since we can't make actual external requests
const mockAxiosPost = async (url: string, payload: any, config?: any) => {
  if (url.includes("/issue-token")) {
    if (payload.grant_type === "password" && payload.username === "testuser") {
      return {
        data: {
          access_token: "mock_access_token",
          refresh_token: "mock_refresh_token",
          expires_in: 3600,
          token_type: "Bearer"
        }
      };
    }
    
    if (payload.grant_type === "refresh_token" && payload.refresh_token === "valid_refresh_token") {
      return {
        data: {
          access_token: "new_mock_access_token",
          refresh_token: "new_mock_refresh_token",
          expires_in: 3600,
          token_type: "Bearer"
        }
      };
    }

    const error = new AxiosError("Auth Failed");
    error.response = { status: 401, data: { message: "Unauthorized" } } as any;
    throw error;
  }
};

// Override axios.post for testing
const originalPost = axios.post;

test("Pathao Integration Module Tests", async (t) => {
  // Setup mocks before tests
  t.beforeEach(() => {
    (axios as any).post = mockAxiosPost;
    
    // Set dummy config
    PathaoConfig.clientId = "test_client";
    PathaoConfig.clientSecret = "test_secret";
    PathaoConfig.username = "testuser";
    PathaoConfig.password = "testpass";
    
    // Clear auth state
    PathaoAuth.invalidateToken();
  });

  t.afterEach(() => {
    (axios as any).post = originalPost;
  });

  await t.test("Config validation throws on missing credentials", () => {
    PathaoConfig.username = "";
    assert.throws(() => validatePathaoConfig(), /Missing required environment variables/);
    PathaoConfig.username = "testuser"; // restore
  });

  await t.test("Config validation passes when credentials exist", () => {
    assert.doesNotThrow(() => validatePathaoConfig());
  });

  await t.test("PathaoAuth - getAccessToken fetches new token via password grant", async () => {
    const token = await PathaoAuth.getAccessToken();
    assert.strictEqual(token, "mock_access_token");
  });

  await t.test("PathaoAuth - getAccessToken reuses cached token", async () => {
    // Inject valid token
    PathaoAuth._setTokenState({
      accessToken: "cached_token",
      refreshToken: "cached_refresh",
      expiresAt: Date.now() + 600000 // 10 mins future
    });

    const token = await PathaoAuth.getAccessToken();
    assert.strictEqual(token, "cached_token");
  });

  await t.test("PathaoAuth - getAccessToken uses refresh token if cached access token is expired", async () => {
    // Inject expired access token but valid refresh token
    PathaoAuth._setTokenState({
      accessToken: "expired_token",
      refreshToken: "valid_refresh_token",
      expiresAt: Date.now() - 1000 // expired
    });

    const token = await PathaoAuth.getAccessToken();
    assert.strictEqual(token, "new_mock_access_token");
  });

  await t.test("PathaoAuth - handles authentication failure", async () => {
    PathaoConfig.username = "wronguser";
    
    try {
      await PathaoAuth.getAccessToken();
      assert.fail("Should have thrown");
    } catch (error: any) {
      assert.strictEqual(error.statusCode, 401);
      assert.strictEqual(error.code, "PATHAO_AUTH_ERROR");
    }
  });

  await t.test("PathaoClient - getHttp returns configured axios instance", () => {
    const http = pathaoClient.getHttp();
    assert.ok(http);
    assert.strictEqual(http.defaults.baseURL, PathaoConfig.baseURL);
  });
});
