import {
  buildHealthReportAnalysisInstructions,
  buildHealthReportAnalysisUserPrompt,
} from "@/lib/ai/health-report-analysis-definition";
import type {
  AiConfigValidationResult,
  AiHealthCheckResult,
  AnalyzeHealthReportInput,
  HealthReportAiProvider,
} from "@/lib/ai/ai-provider";
import type { HealthReportAnalysis } from "@/lib/report-types";
import { extractPdfText } from "@/lib/pdf-text-extractor";

const DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io/anthropic";

type MiniMaxMessageResponse = {
  content?: Array<
    | {
        type?: "text";
        text?: string;
      }
    | {
        type?: "thinking";
        thinking?: string;
      }
    | Record<string, unknown>
  >;
  error?: {
    type?: string;
    message?: string;
  };
};

function readPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function extractTextContent(payload: MiniMaxMessageResponse) {
  return (payload.content ?? [])
    .map((block) => {
      if (
        block &&
        typeof block === "object" &&
        "text" in block &&
        typeof block.text === "string"
      ) {
        return block.text;
      }

      return "";
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

function extractJsonBlock(text: string) {
  const normalized = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  const fenced = normalized.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  let start = -1;
  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];

    if (inString) {
      if (escaping) {
        escaping = false;
        continue;
      }

      if (char === "\\") {
        escaping = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) {
        start = index;
      }
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        return normalized.slice(start, index + 1).trim();
      }
    }
  }

  const fallbackStart = normalized.indexOf("{");
  const fallbackEnd = normalized.lastIndexOf("}");
  if (fallbackStart >= 0 && fallbackEnd > fallbackStart) {
    return normalized.slice(fallbackStart, fallbackEnd + 1).trim();
  }

  return normalized;
}

function sanitizeJsonCandidate(text: string) {
  return text
    .replace(/\u201c|\u201d/g, "\"")
    .replace(/\u2018|\u2019/g, "'")
    .replace(/：/g, ":")
    .replace(/，/g, ",")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,\s*([}\]])/g, "$1")
    .trim();
}

function quoteBareJsonKeys(text: string) {
  return text.replace(/([{,]\s*)([A-Za-z0-9_\u4e00-\u9fa5-]+)\s*:/g, '$1"$2":');
}

function normalizeSingleQuotedStrings(text: string) {
  return text.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, content: string) => {
    const escaped = content.replace(/"/g, '\\"');
    return `"${escaped}"`;
  });
}

function parseJsonWithRepairAttempts(text: string) {
  const sanitized = sanitizeJsonCandidate(text);
  const candidates = [
    text,
    sanitized,
    quoteBareJsonKeys(sanitized),
    normalizeSingleQuotedStrings(sanitized),
    normalizeSingleQuotedStrings(quoteBareJsonKeys(sanitized)),
  ];
  let lastError: Error | null = null;

  for (const candidate of Array.from(new Set(candidates))) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("JSON 解析失败。");
    }
  }

  throw lastError ?? new Error("JSON 解析失败。");
}

function validateHealthReportAnalysisShape(
  value: unknown,
): asserts value is Partial<HealthReportAnalysis> {
  if (!value || typeof value !== "object") {
    throw new Error("MiniMax 返回的分析结果不是合法对象。");
  }

  const candidate = value as Record<string, unknown>;

  if (
    !candidate.patient ||
    typeof candidate.patient !== "object" ||
    Object.keys(candidate.patient as Record<string, unknown>).length === 0
  ) {
    throw new Error("MiniMax 返回结构不完整，缺少 patient。");
  }

  if (
    !candidate.reportMeta ||
    typeof candidate.reportMeta !== "object" ||
    Object.keys(candidate.reportMeta as Record<string, unknown>).length === 0
  ) {
    throw new Error("MiniMax 返回结构不完整，缺少 reportMeta。");
  }

  if (
    !candidate.executiveSummary ||
    typeof candidate.executiveSummary !== "object" ||
    !("summary" in (candidate.executiveSummary as Record<string, unknown>))
  ) {
    throw new Error("MiniMax 返回结构不完整，缺少 executiveSummary.summary。");
  }
}

export class MiniMaxHealthReportProvider implements HealthReportAiProvider {
  readonly providerName = "minimax";
  readonly modelName: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxTokens: number;

  constructor(input?: { apiKey?: string; modelName?: string; baseUrl?: string }) {
    this.apiKey =
      input?.apiKey ||
      process.env.MINIMAX_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      "";
    this.modelName =
      input?.modelName ||
      process.env.MINIMAX_MODEL ||
      process.env.AI_MODEL ||
      "MiniMax-M2.7";
    this.baseUrl =
      input?.baseUrl ||
      process.env.MINIMAX_BASE_URL ||
      process.env.ANTHROPIC_BASE_URL ||
      process.env.AI_BASE_URL ||
      DEFAULT_MINIMAX_BASE_URL;
    this.maxTokens = readPositiveInteger(process.env.MINIMAX_MAX_TOKENS, 20000);
  }

  validateConfig(): AiConfigValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!this.apiKey) {
      issues.push("缺少 MiniMax apiKey，请在 AI_PROVIDER_CHAIN 中配置 apiKey。");
    }

    if (!this.modelName) {
      issues.push("未配置可用的报告分析模型。");
    }

    return {
      providerName: this.providerName,
      modelName: this.modelName,
      ok: issues.length === 0,
      issues,
      warnings,
    };
  }

  async healthCheck(): Promise<AiHealthCheckResult> {
    const validation = this.validateConfig();

    if (!validation.ok) {
      return {
        status: "invalid",
        providerName: this.providerName,
        modelName: this.modelName,
        configured: false,
        live: false,
        checkedAt: new Date().toISOString(),
        issues: validation.issues,
        warnings: validation.warnings,
        message: "AI 配置不完整，当前无法执行报告分析。",
      };
    }

    try {
      const payload = await this.createMessage(
        [
          {
            role: "user",
            content: "请回复 ok。",
          },
        ],
        {
          system: "你是健康检查助手。只回复 ok。",
          maxTokens: 16,
        },
      );

      const content = extractTextContent(payload).trim();
      if (!content) {
        throw new Error("MiniMax 健康检查未返回文本内容。");
      }

      return {
        status: "healthy",
        providerName: this.providerName,
        modelName: this.modelName,
        configured: true,
        live: true,
        checkedAt: new Date().toISOString(),
        issues: [],
        warnings: validation.warnings,
        message: "AI Provider 配置完整，且模型连通性正常。",
      };
    } catch (error) {
      return {
        status: "degraded",
        providerName: this.providerName,
        modelName: this.modelName,
        configured: true,
        live: false,
        checkedAt: new Date().toISOString(),
        issues: [
          error instanceof Error
            ? error.message
            : "MiniMax 健康检查失败，无法确认连通性。",
        ],
        warnings: validation.warnings,
        message: "配置完整，但当前健康检查请求失败。",
      };
    }
  }

  private ensureReady() {
    const validation = this.validateConfig();
    if (!validation.ok) {
      throw new Error(validation.issues.join(" "));
    }
  }

  private getMessagesEndpoint() {
    const normalized = this.baseUrl.replace(/\/+$/g, "");
    if (normalized.endsWith("/v1")) {
      return `${normalized}/messages`;
    }

    return `${normalized}/v1/messages`;
  }

  private async createMessage(
    messages: Array<{ role: "user" | "assistant"; content: string }>,
    options?: { system?: string; maxTokens?: number },
  ) {
    const response = await fetch(this.getMessagesEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.modelName,
        max_tokens: options?.maxTokens || this.maxTokens,
        temperature: 0.1,
        system: options?.system,
        messages: messages.map((message) => ({
          role: message.role,
          content: [
            {
              type: "text",
              text: message.content,
            },
          ],
        })),
      }),
    });

    const rawText = await response.text();
    let data: MiniMaxMessageResponse = {};

    try {
      data = rawText ? (JSON.parse(rawText) as MiniMaxMessageResponse) : {};
    } catch {
      data = {};
    }

    if (!response.ok || data.error) {
      const detail = data.error?.message || rawText;
      throw new Error(`MiniMax 请求失败: ${detail || response.statusText}`);
    }

    return data;
  }

  private async repairMalformedJson(rawContent: string, parseError: Error) {
    const payload = await this.createMessage(
      [
        {
          role: "user",
          content: `下面这段内容本应是健康报告分析 JSON，但当前无法解析。

解析错误：
${parseError.message}

请在不引入额外说明文字的前提下，将它修复成一个合法的 JSON 对象。允许补齐必要的空数组、空字符串或空对象，但不要凭空添加报告事实。

原始内容：
${rawContent}`,
        },
      ],
      {
        system:
          "你是 JSON 修复器。你的任务是把用户提供的内容修复成单个合法 JSON 对象。不要输出解释、Markdown 或代码块，只输出 JSON。",
        maxTokens: this.maxTokens,
      },
    );

    const repaired = extractTextContent(payload).trim();
    if (!repaired) {
      throw new Error(`MiniMax JSON 修复失败：${parseError.message}`);
    }

    return parseJsonWithRepairAttempts(extractJsonBlock(repaired));
  }

  async analyzeHealthReport({
    report,
  }: AnalyzeHealthReportInput): Promise<HealthReportAnalysis> {
    this.ensureReady();

    const extracted = await extractPdfText(report);
    if (!extracted.text) {
      throw new Error("MiniMax 备用分析失败：无法从 PDF 中提取文本内容。");
    }

    const prompt = `${buildHealthReportAnalysisUserPrompt({
      reportId: report.id,
      fileName: report.fileName,
    })}

以下是从 PDF 中提取的文本内容，请仅基于这些内容完成结构化分析：

${extracted.text}`;

    const payload = await this.createMessage(
      [
        {
          role: "user",
          content: prompt,
        },
      ],
      {
        system: `${buildHealthReportAnalysisInstructions()} 输出必须是纯 JSON，不要添加解释性前后缀。`,
        maxTokens: this.maxTokens,
      },
    );

    const content = extractTextContent(payload).trim();
    if (!content) {
      throw new Error("MiniMax 未返回可解析的结构化分析内容。");
    }

    let analysis: unknown;
    const jsonBlock = extractJsonBlock(content);
    try {
      analysis = parseJsonWithRepairAttempts(jsonBlock);
    } catch (error) {
      analysis = await this.repairMalformedJson(
        jsonBlock,
        error instanceof Error ? error : new Error("JSON 解析失败。"),
      );
    }

    validateHealthReportAnalysisShape(analysis);
    return analysis as HealthReportAnalysis;
  }
}
