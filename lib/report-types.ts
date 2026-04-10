export type ReportStatus = "analyzing" | "failed" | "succeeded";
export type StorageMode = "local" | "oss";

export type RiskLevel = "高风险" | "中风险" | "低风险";
export type SeverityLevel = "mild" | "moderate" | "severe";
export type SystemRiskKey =
  | "cardiovascular"
  | "endocrine_metabolic"
  | "hepatic"
  | "renal"
  | "thyroid"
  | "respiratory"
  | "urology"
  | "gynecology"
  | "bone"
  | "gastrointestinal"
  | "tumor_screening"
  | "other";

export type HealthReportAnalysis = {
  schemaVersion: string;
  reportId: string;
  generatedAt: string;
  model: string;
  reportMeta: {
    fileName: string;
    reportType: string;
    institution: string;
    department: string;
    reportNumber: string;
    examDate: string;
    reportDate: string;
    pageCount: number;
    sourceLanguage: string;
  };
  patient: {
    name: string;
    gender: string;
    age: number;
    birthDate: string;
    heightCm: number;
    weightKg: number;
    bmi: number;
    waistCm: number;
    hipCm: number;
    menopauseStatus: string;
  };
  executiveSummary: {
    overallRiskLevel: RiskLevel;
    riskScore: number;
    summary: string;
    topSignals: string[];
  };
  abnormalItems: Array<{
    id: string;
    name: string;
    category: string;
    value: string;
    unit: string;
    referenceRange: string;
    flag: string;
    riskLevel: RiskLevel;
    severity: SeverityLevel;
    interpretation: string;
    sourceSection: string;
    sourcePage: number;
  }>;
  keyNormalItems: Array<{
    name: string;
    result: string;
    sourceSection: string;
    sourcePage: number;
  }>;
  riskBuckets: {
    high: string[];
    medium: string[];
    low: string[];
  };
  systemRisks: Array<{
    system: SystemRiskKey;
    level: RiskLevel;
    summary: string;
    findings: string[];
  }>;
  problemTags: string[];
  recommendations: Array<{
    title: string;
    priority: RiskLevel;
    timeframe: string;
    department: string;
    goal: string;
    actions: string[];
    reason: string;
  }>;
  departmentSuggestions: Array<{
    department: string;
    priority: RiskLevel;
    reason: string;
    relatedProblems: string[];
  }>;
  followUpPlan: Array<{
    window: string;
    tasks: string[];
    targetItems: string[];
    purpose: string;
  }>;
  lifestyleAdvice: {
    diet: string[];
    exercise: string[];
    weightManagement: string[];
    sleep: string[];
    smokingAlcohol: string[];
    homeMonitoring: string[];
  };
  questionsForDoctor: string[];
  evidenceMap: Array<{
    findingTitle: string;
    sourceSection: string;
    sourcePage: number;
    evidence: string[];
  }>;
  uncertainties: string[];
  disclaimers: string[];
};

export type StoredReport = {
  id: string;
  fileName: string;
  storageMode: StorageMode;
  fileKey: string;
  reportKey: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  updatedAt: string;
  status: ReportStatus;
  patientName: string | null;
  examDate: string | null;
  institution: string | null;
  summary: string | null;
  errorMessage: string | null;
  analysis: HealthReportAnalysis | null;
};

export type PublicReport = Omit<
  StoredReport,
  "fileKey" | "reportKey" | "analysis"
>;
