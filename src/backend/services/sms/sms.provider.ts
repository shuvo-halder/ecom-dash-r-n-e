export interface SmsSendOptions {
  to: string;
  message: string;
}

export interface SmsSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
}

export interface ISmsProvider {
  sendSms(options: SmsSendOptions): Promise<SmsSendResult>;
}
