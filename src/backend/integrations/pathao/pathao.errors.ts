import { AppError } from "../../utils/AppError";

export class PathaoIntegrationError extends AppError {
  constructor(message: string, statusCode: number = 502, code: string = "PATHAO_API_ERROR") {
    super(message, statusCode, code);
  }
}

export class PathaoAuthError extends PathaoIntegrationError {
  constructor(message: string = "Failed to authenticate with Pathao API") {
    super(message, 401, "PATHAO_AUTH_ERROR");
  }
}

export class PathaoRateLimitError extends PathaoIntegrationError {
  constructor(message: string = "Pathao API rate limit exceeded") {
    super(message, 429, "PATHAO_RATE_LIMIT_ERROR");
  }
}
