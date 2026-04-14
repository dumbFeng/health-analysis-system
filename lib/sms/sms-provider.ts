import { getAuthSmsProviderName } from "@/lib/auth/auth-config";

export type SendLoginCodeSmsInput = {
  phone: string;
  code: string;
  ttlMinutes: number;
};

export type SmsProvider = {
  sendLoginCode(input: SendLoginCodeSmsInput): Promise<void>;
};

class DevSmsProvider implements SmsProvider {
  async sendLoginCode() {
    return;
  }
}

export function getSmsProviderName() {
  return getAuthSmsProviderName().trim().toLowerCase();
}

export async function getSmsProvider(): Promise<SmsProvider> {
  const provider = getSmsProviderName();
  if (provider === "tencent") {
    const { TencentCloudSmsProvider } = await import("@/lib/sms/tencent-cloud-sms-provider");
    return new TencentCloudSmsProvider();
  }

  return new DevSmsProvider();
}
