import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from "axios";
import { PathaoConfig } from "./pathao.config";
import { PathaoAuth } from "./pathao.auth";
import { PathaoIntegrationError, PathaoRateLimitError } from "./pathao.errors";
import { logger } from "../../config/logger";

export class PathaoClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: PathaoConfig.baseURL,
      timeout: 15000,
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request Interceptor: Attach access token
    this.client.interceptors.request.use(
      async (config: InternalAxiosRequestConfig) => {
        // Skip attaching token if the request is for issuing token (though we use raw axios in auth.ts anyway)
        if (!config.url?.includes("/issue-token")) {
          const token = await PathaoAuth.getAccessToken();
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response Interceptor: Handle 401s, 429s and retry
    this.client.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (!originalRequest) {
          return Promise.reject(error);
        }

        const status = error.response?.status;

        // Handle Rate Limiting
        if (status === 429) {
          logger.warn("[PathaoClient] Rate limit exceeded.", { url: originalRequest.url });
          throw new PathaoRateLimitError();
        }

        // Handle Unauthorized (Token Expired/Invalid)
        if (status === 401 && !originalRequest._retry && !originalRequest.url?.includes("/issue-token")) {
          originalRequest._retry = true;
          logger.warn("[PathaoClient] Received 401. Invalidating token and retrying request.", { url: originalRequest.url });
          
          try {
            // Invalidate the current token
            PathaoAuth.invalidateToken();
            // This will trigger a new token request because invalidateToken clears the cache
            const newToken = await PathaoAuth.getAccessToken();
            
            // Update the authorization header
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            
            // Retry the original request with the new token
            return this.client(originalRequest);
          } catch (retryError) {
            logger.error("[PathaoClient] Retry failed after 401.", { 
              url: originalRequest.url, 
              error: retryError instanceof Error ? retryError.message : "Unknown error" 
            });
            throw new PathaoIntegrationError("Pathao request failed after token refresh attempt", 401, "PATHAO_RETRY_FAILED");
          }
        }

        // Wrap other API errors
        const responseData = error.response?.data as any;
        const message = responseData?.message || responseData?.error_description || error.message;
        
        logger.error(`[PathaoClient] API Error`, {
          url: originalRequest.url,
          method: originalRequest.method,
          status,
          response: responseData,
        });

        throw new PathaoIntegrationError(message, status || 502, "PATHAO_API_ERROR");
      }
    );
  }

  /**
   * Expose the configured axios instance for making requests
   */
  public getHttp(): AxiosInstance {
    return this.client;
  }
}

// Export a singleton instance
export const pathaoClient = new PathaoClient();
