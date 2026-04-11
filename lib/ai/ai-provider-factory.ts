import type {
  AiProviderConfig,
  HealthReportAiProvider,
} from "@/lib/ai/ai-provider";
import { GeminiHealthReportProvider } from "@/lib/ai/providers/gemini-health-report-provider";
import { MiniMaxHealthReportProvider } from "@/lib/ai/providers/minimax-health-report-provider";
import { OpenAIHealthReportProvider } from "@/lib/ai/providers/openai-health-report-provider";

function parseProviderChainFromEnv(): AiProviderConfig[] {
  const rawChain = process.env.AI_PROVIDER_CHAIN;

  if (rawChain) {
    try {
      const parsed = JSON.parse(rawChain) as unknown;
      if (
        Array.isArray(parsed) &&
        parsed.every(
          (item) =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as AiProviderConfig).provider === "string",
        )
      ) {
        return parsed.map((item) => {
          const config = item as AiProviderConfig;
          if (config.model !== undefined && typeof config.model !== "string") {
            throw new Error("provider.model 必须是字符串。");
          }
          if (config.apiKey !== undefined && typeof config.apiKey !== "string") {
            throw new Error("provider.apiKey 必须是字符串。");
          }
          if (config.baseUrl !== undefined && typeof config.baseUrl !== "string") {
            throw new Error("provider.baseUrl 必须是字符串。");
          }
          return config;
        });
      }
      throw new Error("AI_PROVIDER_CHAIN 不是合法的 provider 配置数组。");
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `AI_PROVIDER_CHAIN 解析失败: ${error.message}`
          : "AI_PROVIDER_CHAIN 解析失败。",
      );
    }
  }

  return [
    {
      provider: process.env.AI_PROVIDER || "openai",
      model: process.env.AI_MODEL || undefined,
      baseUrl: process.env.AI_BASE_URL || undefined,
    },
  ];
}

export function getConfiguredAiProviderChain() {
  return parseProviderChainFromEnv().map((item) => ({
    provider: item.provider.toLowerCase(),
    model: item.model,
    baseUrl: item.baseUrl,
  }));
}

function getProviderChainWithSecrets(): AiProviderConfig[] {
  return parseProviderChainFromEnv().map((item) => ({
    provider: item.provider.toLowerCase(),
    model: item.model,
    apiKey: item.apiKey,
    baseUrl: item.baseUrl,
  }));
}

function createProviderFromConfig(config: AiProviderConfig): HealthReportAiProvider {
  switch (config.provider.toLowerCase()) {
    case "openai":
      return new OpenAIHealthReportProvider({
        apiKey: config.apiKey,
        modelName: config.model,
        baseUrl: config.baseUrl,
      });
    case "minimax":
      return new MiniMaxHealthReportProvider({
        apiKey: config.apiKey,
        modelName: config.model,
        baseUrl: config.baseUrl,
      });
    case "gemini":
      return new GeminiHealthReportProvider({
        apiKey: config.apiKey,
        modelName: config.model,
        baseUrl: config.baseUrl,
      });
    default:
      throw new Error(`不支持的 AI Provider: ${config.provider}`);
  }
}

export function createPrimaryHealthReportAiProvider(): HealthReportAiProvider {
  const [first] = getProviderChainWithSecrets();

  if (!first) {
    throw new Error("未配置任何 AI Provider。");
  }

  return createProviderFromConfig(first);
}

export function createHealthReportAiProviders(): HealthReportAiProvider[] {
  const chain = getProviderChainWithSecrets();

  if (chain.length === 0) {
    throw new Error("未配置任何 AI Provider。");
  }

  return chain.map(createProviderFromConfig);
}
