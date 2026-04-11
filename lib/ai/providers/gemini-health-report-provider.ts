import { createPartFromBase64, GoogleGenAI } from "@google/genai";
import {
  buildHealthReportAnalysisInstructions,
  buildHealthReportAnalysisUserPrompt,
  healthReportAnalysisSchema,
} from "@/lib/ai/health-report-analysis-definition";
import type {
  AiConfigValidationResult,
  AiHealthCheckResult,
  AnalyzeHealthReportInput,
  HealthReportAiProvider,
} from "@/lib/ai/ai-provider";
import type { HealthReportAnalysis } from "@/lib/report-types";
import { readStoredFile } from "@/lib/storage-provider";

const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

function extractJsonBlock(text: string) {
  const normalized = text.trim();
  const fenced = normalized.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = normalized.indexOf("{");
  const end = normalized.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return normalized.slice(start, end + 1);
  }

  return normalized;
}

export class GeminiHealthReportProvider implements HealthReportAiProvider {
  readonly providerName = "gemini";
  readonly modelName: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(input?: { apiKey?: string; modelName?: string; baseUrl?: string }) {
    this.apiKey =
      input?.apiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      "";
    this.modelName =
      input?.modelName ||
      process.env.GEMINI_MODEL ||
      process.env.AI_MODEL ||
      DEFAULT_GEMINI_MODEL;
    this.baseUrl = input?.baseUrl || process.env.GEMINI_BASE_URL || "";
  }

  private createClient() {
    return new GoogleGenAI({
      apiKey: this.apiKey,
      httpOptions: this.baseUrl
        ? {
            baseUrl: this.baseUrl,
          }
        : undefined,
    });
  }

  validateConfig(): AiConfigValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!this.apiKey) {
      issues.push("缺少 Gemini apiKey，请在 AI_PROVIDER_CHAIN 中配置 apiKey。");
    }

    if (!this.modelName) {
      issues.push("未配置 Gemini 模型。");
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
        message: "Gemini 配置不完整，当前无法执行报告分析。",
      };
    }

    try {
      const client = this.createClient();
      await client.models.generateContent({
        model: this.modelName,
        contents: "Return the word ok.",
        config: {
          temperature: 0,
        },
      });

      return {
        status: "healthy",
        providerName: this.providerName,
        modelName: this.modelName,
        configured: true,
        live: true,
        checkedAt: new Date().toISOString(),
        issues: [],
        warnings: validation.warnings,
        message: "Gemini Provider 配置完整，且模型连通性正常。",
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
            : "Gemini 健康检查失败，无法确认连通性。",
        ],
        warnings: validation.warnings,
        message: "配置完整，但当前 Gemini 健康检查请求失败。",
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

    const client = this.createClient();
    const buffer = await readStoredFile(report.fileKey, "upload");
    const pdfPart = createPartFromBase64(
      Buffer.from(buffer).toString("base64"),
      report.mimeType || "application/pdf",
    );

    const response = await client.models.generateContent({
      model: this.modelName,
      contents: [
        pdfPart,
        {
          text: buildHealthReportAnalysisUserPrompt({
            reportId: report.id,
            fileName: report.fileName,
          }),
        },
      ],
      config: {
        temperature: 0.1,
        systemInstruction: buildHealthReportAnalysisInstructions(),
        responseMimeType: "application/json",
        responseJsonSchema: healthReportAnalysisSchema.schema,
      },
    });

    const outputText = response.text?.trim();
    if (!outputText) {
      throw new Error("Gemini 未返回可解析的结构化分析内容。");
    }

    return JSON.parse(extractJsonBlock(outputText)) as HealthReportAnalysis;
  }
}
