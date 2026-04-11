import type { StoredReport, HealthReportAnalysis } from "@/lib/report-types";

export type AnalyzeHealthReportInput = {
  report: StoredReport;
};

export type AiProviderConfig = {
  provider: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
};

export type AiHealthStatus = "healthy" | "degraded" | "invalid";

export type AiConfigValidationResult = {
  providerName: string;
  modelName: string;
  ok: boolean;
  issues: string[];
  warnings: string[];
};

export type AiHealthCheckResult = {
  status: AiHealthStatus;
  providerName: string;
  modelName: string;
  configured: boolean;
  live: boolean;
  checkedAt: string;
  issues: string[];
  warnings: string[];
  message: string;
};

export interface HealthReportAiProvider {
  readonly providerName: string;
  readonly modelName: string;
  validateConfig(): AiConfigValidationResult;
  healthCheck(): Promise<AiHealthCheckResult>;
  analyzeHealthReport(
    input: AnalyzeHealthReportInput,
  ): Promise<HealthReportAnalysis>;
}
