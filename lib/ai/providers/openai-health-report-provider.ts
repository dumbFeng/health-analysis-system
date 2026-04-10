import { basename } from "node:path";
import OpenAI, { toFile } from "openai";
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

const OPENAI_API_BASE = "https://api.openai.com/v1";

export class OpenAIHealthReportProvider implements HealthReportAiProvider {
  readonly providerName = "openai";
  readonly modelName: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(input?: { apiKey?: string; modelName?: string; baseUrl?: string }) {
    this.apiKey = input?.apiKey || process.env.OPENAI_API_KEY || "";
    this.modelName =
      input?.modelName ||
      process.env.OPENAI_MODEL ||
      process.env.AI_MODEL ||
      "gpt-5.4-mini";
    this.baseUrl =
      input?.baseUrl ||
      process.env.OPENAI_BASE_URL ||
      process.env.AI_BASE_URL ||
      OPENAI_API_BASE;
  }

  private createClient() {
    return new OpenAI({
      apiKey: this.apiKey,
      baseURL: this.baseUrl,
    });
  }

  validateConfig(): AiConfigValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!this.apiKey) {
      issues.push("缺少 OPENAI_API_KEY。");
    }

    if (!this.modelName) {
      issues.push("未配置 OpenAI 模型。");
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
      const client = this.createClient();
      await client.models.retrieve(this.modelName);

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
            : "AI 健康检查失败，无法确认连通性。",
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

  private async uploadPdf(report: AnalyzeHealthReportInput["report"]) {
    const client = this.createClient();
    const buffer = await readStoredFile(report.fileKey, "upload");
    const file = await toFile(buffer, basename(report.fileKey), {
      type: report.mimeType || "application/pdf",
    });
    const uploaded = await client.files.create({
      file,
      purpose: "user_data",
    });

    return uploaded.id;
  }

  async analyzeHealthReport({
    report,
  }: AnalyzeHealthReportInput): Promise<HealthReportAnalysis> {
    this.ensureReady();

    const client = this.createClient();
    const fileId = await this.uploadPdf(report);

    const response = await client.responses.create({
      model: this.modelName,
      store: false,
      instructions: buildHealthReportAnalysisInstructions(),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_file",
              file_id: fileId,
            },
            {
              type: "input_text",
              text: buildHealthReportAnalysisUserPrompt({
                reportId: report.id,
                fileName: report.fileName,
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          ...healthReportAnalysisSchema,
        },
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) {
      throw new Error("OpenAI 未返回可解析的结构化分析内容。");
    }

    return JSON.parse(outputText) as HealthReportAnalysis;
  }
}
