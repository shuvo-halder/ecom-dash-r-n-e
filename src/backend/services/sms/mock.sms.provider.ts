import { ISmsProvider, SmsSendOptions, SmsSendResult } from "./sms.provider";
import { logger } from "../../config/logger";

export class MockSmsProvider implements ISmsProvider {
  async sendSms(options: SmsSendOptions): Promise<SmsSendResult> {
    // In a real environment, this is where we'd call Twilio, AWS SNS, etc.
    // For now, we strictly log internally and do NOT expose in the API.
    
    // Using a mock message ID
    const providerMessageId = "mock-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    
    logger.info("[MockSmsProvider] Mock SMS Dispatch", {
      to: options.to,
      providerMessageId,
      // We log the message for dev/test visibility but this remains server-side.
      messageLength: options.message.length,
      content: process.env.NODE_ENV !== "production" ? options.message : "***REDACTED***"
    });

    return {
      success: true,
      providerMessageId
    };
  }
}
