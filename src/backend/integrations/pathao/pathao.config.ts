import dotenv from "dotenv";

dotenv.config();

export const PathaoConfig = {
  baseURL: process.env.PATHAO_BASE_URL || "https://api-hermes.pathao.com",
  clientId: process.env.PATHAO_CLIENT_ID || "",
  clientSecret: process.env.PATHAO_CLIENT_SECRET || "",
  username: process.env.PATHAO_USERNAME || "",
  password: process.env.PATHAO_PASSWORD || "",
  webhookSecret: process.env.PATHAO_WEBHOOK_SECRET || "",
};

export const validatePathaoConfig = () => {
  const missingKeys: string[] = [];
  if (!PathaoConfig.clientId) missingKeys.push("PATHAO_CLIENT_ID");
  if (!PathaoConfig.clientSecret) missingKeys.push("PATHAO_CLIENT_SECRET");
  if (!PathaoConfig.username) missingKeys.push("PATHAO_USERNAME");
  if (!PathaoConfig.password) missingKeys.push("PATHAO_PASSWORD");

  if (missingKeys.length > 0) {
    throw new Error(
      `Pathao Integration Error: Missing required environment variables: ${missingKeys.join(
        ", "
      )}`
    );
  }
};
