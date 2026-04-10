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

const DEFAULT_MINIMAX_BASE_URL = "https://api.minimaxi.com/v1";

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

function validateHealthReportAnalysisShape(
  value: unknown,
): asserts value is HealthReportAnalysis {
  if (!value || typeof value !== "object") {
    throw new Error("MiniMax 返回的分析结果不是合法对象。");
  }

  const candidate = value as Record<string, unknown>;
  const requiredTopLevel = [
    "schemaVersion",
    "reportId",
    "generatedAt",
    "model",
    "reportMeta",
    "patient",
    "executiveSummary",
    "abnormalItems",
    "keyNormalItems",
    "riskBuckets",
    "systemRisks",
    "problemTags",
    "recommendations",
    "departmentSuggestions",
    "followUpPlan",
    "lifestyleAdvice",
    "questionsForDoctor",
    "evidenceMap",
    "uncertainties",
    "disclaimers",
  ];

  const missingTopLevel = requiredTopLevel.filter((key) => !(key in candidate));
  if (missingTopLevel.length > 0) {
    throw new Error(
      `MiniMax 返回结构不完整，缺少字段: ${missingTopLevel.join(", ")}`,
    );
  }

  if (
    !candidate.patient ||
    typeof candidate.patient !== "object" ||
    !("name" in (candidate.patient as Record<string, unknown>))
  ) {
    throw new Error("MiniMax 返回结构不完整，缺少 patient.name。");
  }

  if (
    !candidate.reportMeta ||
    typeof candidate.reportMeta !== "object" ||
    !("examDate" in (candidate.reportMeta as Record<string, unknown>))
  ) {
    throw new Error("MiniMax 返回结构不完整，缺少 reportMeta.examDate。");
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

  constructor(input?: { apiKey?: string; modelName?: string; baseUrl?: string }) {
    this.apiKey = input?.apiKey || process.env.MINIMAX_API_KEY || "";
    this.modelName =
      input?.modelName ||
      process.env.MINIMAX_MODEL ||
      process.env.AI_MODEL ||
      "MiniMax-M2.5";
    this.baseUrl =
      input?.baseUrl ||
      process.env.MINIMAX_BASE_URL ||
      process.env.AI_BASE_URL ||
      DEFAULT_MINIMAX_BASE_URL;
  }

  validateConfig(): AiConfigValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!this.apiKey) {
      issues.push("缺少 MiniMax 服务配置。");
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
      const response = await fetch(`${this.baseUrl}/models`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        return {
          status: "degraded",
          providerName: this.providerName,
          modelName: this.modelName,
          configured: true,
          live: false,
          checkedAt: new Date().toISOString(),
          issues: [`MiniMax 健康检查失败: ${await response.text()}`],
          warnings: validation.warnings,
          message: "配置完整，但当前无法确认模型可用性。",
        };
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

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.modelName,
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: `${buildHealthReportAnalysisInstructions()} 输出必须是纯 JSON，不要添加解释性前后缀。`,
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_object",
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`MiniMax 分析请求失败: ${await response.text()}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("MiniMax 未返回可解析的结构化分析内容。");
    }

    const analysis = JSON.parse(extractJsonBlock(content)) as unknown;
    validateHealthReportAnalysisShape(analysis);
    return analysis;
  }
}
