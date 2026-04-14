import { getConfiguredAiProviderChain } from "@/lib/ai/ai-provider-factory";

export type AiModelOption = {
  id: string;
  provider: string;
  model: string;
  label: string;
};

function formatProviderLabel(provider: string) {
  if (provider === "openai") {
    return "OpenAI";
  }

  if (provider === "gemini") {
    return "Gemini";
  }

  if (provider === "minimax") {
    return "MiniMax";
  }

  return provider;
}

export function getAvailableAiModelOptions(): AiModelOption[] {
  return getConfiguredAiProviderChain().map((item, index) => {
    const provider = item.provider.toLowerCase();
    const model = item.model || "default";
    return {
      id: `${provider}:${model}:${index}`,
      provider,
      model,
      label: `${formatProviderLabel(provider)} · ${model}`,
    };
  });
}

export function findAiModelOptionById(id: string | null | undefined) {
  if (!id) {
    return null;
  }

  return getAvailableAiModelOptions().find((item) => item.id === id) || null;
}
