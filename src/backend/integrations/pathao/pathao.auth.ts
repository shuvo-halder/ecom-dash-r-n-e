import axios, { AxiosError } from "axios";
import { PathaoConfig } from "./pathao.config";
import { PathaoTokenResponse } from "./pathao.types";
import { PathaoAuthError, PathaoIntegrationError } from "./pathao.errors";
import { logger } from "../../config/logger";

interface TokenStore {
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null; // Timestamp in milliseconds
}

export class PathaoAuth {
  private static tokenStore: TokenStore = {
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
  };

  private static authPromise: Promise<string> | null = null;
  // A buffer to refresh the token slightly before it actually expires (e.g., 60 seconds)
  private static readonly EXPIRY_BUFFER_MS = 60 * 1000;

  /**
   * Retrieves a valid access token.
   * If the token is valid, returns it immediately.
   * If the token is expired or missing, acquires a new one.
   * Uses a singleton Promise (authPromise) to prevent concurrent auth calls.
   */
  public static async getAccessToken(): Promise<string> {
    if (this.isTokenValid() && this.tokenStore.accessToken) {
      return this.tokenStore.accessToken;
    }

    if (this.authPromise) {
      return this.authPromise;
    }

    this.authPromise = this.acquireToken()
      .then((token) => {
        this.authPromise = null;
        return token;
      })
      .catch((error) => {
        this.authPromise = null;
        throw error;
      });

    return this.authPromise;
  }

  /**
   * Clears the current token from memory. Useful if we get a 401 response and need to force re-auth.
   */
  public static invalidateToken(): void {
    this.tokenStore.accessToken = null;
    this.tokenStore.refreshToken = null;
    this.tokenStore.expiresAt = null;
    logger.info("[PathaoAuth] Token invalidated.");
  }

  /**
   * For testing purposes, inject a specific token state
   */
  public static _setTokenState(state: TokenStore): void {
    this.tokenStore = { ...state };
  }

  private static isTokenValid(): boolean {
    if (!this.tokenStore.accessToken || !this.tokenStore.expiresAt) {
      return false;
    }
    const now = Date.now();
    return this.tokenStore.expiresAt > now + this.EXPIRY_BUFFER_MS;
  }

  private static async acquireToken(): Promise<string> {
    // If we have a refresh token, try using it first
    if (this.tokenStore.refreshToken) {
      try {
        return await this.refreshAccessToken(this.tokenStore.refreshToken);
      } catch (error) {
        logger.warn("[PathaoAuth] Failed to refresh token, falling back to password grant.", {
          error: error instanceof Error ? error.message : "Unknown error",
        });
        // Clear refresh token so we don't try it again immediately if password grant fails
        this.tokenStore.refreshToken = null;
      }
    }

    return await this.loginWithPassword();
  }

  private static async loginWithPassword(): Promise<string> {
    try {
      const payload = {
        client_id: PathaoConfig.clientId,
        client_secret: PathaoConfig.clientSecret,
        username: PathaoConfig.username,
        password: PathaoConfig.password,
        grant_type: "password",
      };

      const response = await axios.post<PathaoTokenResponse>(
        `${PathaoConfig.baseURL}/aladdin/api/v1/issue-token`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          timeout: 10000,
        }
      );

      this.saveToken(response.data);
      logger.info("[PathaoAuth] Successfully authenticated with Pathao via password grant.");
      return response.data.access_token;
    } catch (error) {
      this.handleAuthError(error, "Password Grant");
    }
  }

  private static async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      const payload = {
        client_id: PathaoConfig.clientId,
        client_secret: PathaoConfig.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      };

      const response = await axios.post<PathaoTokenResponse>(
        `${PathaoConfig.baseURL}/aladdin/api/v1/issue-token`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          timeout: 10000,
        }
      );

      this.saveToken(response.data);
      logger.info("[PathaoAuth] Successfully refreshed Pathao access token.");
      return response.data.access_token;
    } catch (error) {
      this.handleAuthError(error, "Refresh Grant");
    }
  }

  private static saveToken(data: PathaoTokenResponse): void {
    this.tokenStore.accessToken = data.access_token;
    this.tokenStore.refreshToken = data.refresh_token;
    // expires_in is usually in seconds
    this.tokenStore.expiresAt = Date.now() + data.expires_in * 1000;
  }

  private static handleAuthError(error: unknown, context: string): never {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const responseData = error.response?.data;
      
      logger.error(`[PathaoAuth] API Error during ${context}`, {
        status,
        data: responseData,
        message: error.message,
      });

      if (status === 401 || status === 400) {
        throw new PathaoAuthError(`Pathao Authentication Failed (${context}): Invalid credentials or token.`);
      }
      if (status === 429) {
        throw new PathaoIntegrationError("Pathao API Rate Limit Exceeded during auth", 429, "PATHAO_RATE_LIMIT");
      }
      
      throw new PathaoIntegrationError(
        `Pathao API Error (${context}): ${error.message}`,
        status || 502,
        "PATHAO_AUTH_NETWORK_ERROR"
      );
    }
    
    logger.error(`[PathaoAuth] Unexpected error during ${context}`, { error });
    throw new PathaoIntegrationError("Unexpected error during Pathao Authentication", 500, "PATHAO_INTERNAL_ERROR");
  }
}
