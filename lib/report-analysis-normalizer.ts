import type {
  HealthReportAnalysis,
  RiskLevel,
  SeverityLevel,
  StoredReport,
  SystemRiskKey,
} from "@/lib/report-types";

const systemRiskKeys: SystemRiskKey[] = [
  "cardiovascular",
  "endocrine_metabolic",
  "hepatic",
  "renal",
  "thyroid",
  "respiratory",
  "urology",
  "gynecology",
  "bone",
  "gastrointestinal",
  "tumor_screening",
  "other",
];

const riskOrder: Record<RiskLevel, number> = {
  高风险: 0,
  中风险: 1,
  低风险: 2,
};

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      const record = asRecord(item);
      if (typeof record.finding === "string") {
        return record.finding;
      }
      if (typeof record.name === "string") {
        return record.name;
      }
      if (typeof record.detail === "string") {
        return record.detail;
      }
      if (typeof record.details === "string") {
        return record.details;
      }

      return "";
    })
    .filter((item): item is string => Boolean(item));
}

function normalizeRiskLevel(value: unknown): RiskLevel {
  if (value === "高风险" || value === "高" || value === "高优先级") {
    return "高风险";
  }

  if (value === "中风险" || value === "中" || value === "中优先级") {
    return "中风险";
  }

  if (value === "低风险" || value === "低" || value === "低优先级") {
    return "低风险";
  }

  return "低风险";
}

function normalizeSeverity(value: unknown): SeverityLevel {
  if (value === "mild" || value === "moderate" || value === "severe") {
    return value;
  }

  return "mild";
}

function normalizeSystemRiskKey(value: unknown): SystemRiskKey {
  return typeof value === "string" && systemRiskKeys.includes(value as SystemRiskKey)
    ? (value as SystemRiskKey)
    : "other";
}

function joinFindingText(record: Record<string, unknown>) {
  return [
    record.name,
    record.category,
    record.value,
    record.unit,
    record.referenceRange,
    record.flag,
    record.interpretation,
    record.sourceSection,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
}

function joinMeasuredFindingText(record: Record<string, unknown>) {
  return [
    record.name,
    record.category,
    record.value,
    record.unit,
    record.referenceRange,
    record.flag,
    record.sourceSection,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
}

function parseFirstNumber(value: string) {
  const matched = value.match(/-?\d+(?:\.\d+)?/);
  if (!matched) {
    return null;
  }

  const parsed = Number.parseFloat(matched[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractThyroidTiradsLevel(text: string) {
  if (!/甲状腺|thyroid/i.test(text)) {
    return null;
  }

  const matched = text.match(
    /(?:ti[-\s]?rads|tirads|acr\s*ti[-\s]?rads)[^\d]{0,12}([3-6])\s*(?:级|类)?|([3-6])\s*级/i,
  );
  if (!matched) {
    return null;
  }

  const parsed = Number.parseInt(matched[1] || matched[2] || "", 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBloodPressure(text: string) {
  const matched = text.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
  if (!matched) {
    return null;
  }

  const systolic = Number.parseInt(matched[1], 10);
  const diastolic = Number.parseInt(matched[2], 10);
  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
    return null;
  }

  return { systolic, diastolic };
}

function canonicalizeAbnormalItemRisk(record: Record<string, unknown>) {
  const normalized = {
    riskLevel: normalizeRiskLevel(record.riskLevel),
    severity: normalizeSeverity(record.severity),
  };
  const text = joinFindingText(record);
  const measuredText = joinMeasuredFindingText(record);
  const lowerText = text.toLowerCase();

  if (/血压|blood pressure/i.test(text)) {
    const bloodPressure = parseBloodPressure(text);
    if (bloodPressure) {
      if (bloodPressure.systolic >= 180 || bloodPressure.diastolic >= 120) {
        return { riskLevel: "高风险" as const, severity: "severe" as const };
      }

      if (bloodPressure.systolic >= 140 || bloodPressure.diastolic >= 90) {
        return { riskLevel: "中风险" as const, severity: "moderate" as const };
      }
    }
  }

  if (/颈动脉.*(?:软斑|粥样斑块)|(?:软斑|粥样斑块).*颈动脉/.test(text)) {
    return { riskLevel: "高风险" as const, severity: "moderate" as const };
  }

  if (/内中膜|内膜中层|imt|锁骨下动脉/i.test(text) && !/软斑|粥样斑块/.test(text)) {
    return { riskLevel: "中风险" as const, severity: "moderate" as const };
  }

  if (/低密度脂蛋白|ldl/i.test(text)) {
    const ldl = parseFirstNumber(String(record.value || text));
    if (ldl !== null && ldl >= 4.9) {
      return { riskLevel: "高风险" as const, severity: "severe" as const };
    }

    return { riskLevel: "中风险" as const, severity: "moderate" as const };
  }

  if (/空腹血糖|本次血糖|血糖|glucose|糖化血红蛋白|hba1c/i.test(text)) {
    const glucoseOrHba1c = parseFirstNumber(String(record.value || text));
    if (glucoseOrHba1c !== null && glucoseOrHba1c >= 11.1) {
      return { riskLevel: "高风险" as const, severity: "severe" as const };
    }

    return { riskLevel: "中风险" as const, severity: "moderate" as const };
  }

  if (/体重指数|肥胖|bmi/i.test(text)) {
    const bmi = parseFirstNumber(String(record.value || text));
    return {
      riskLevel: "中风险" as const,
      severity: bmi !== null && bmi >= 35 ? ("severe" as const) : ("moderate" as const),
    };
  }

  if (/肺.*(?:结节|炎症)|(?:结节|炎症).*肺/.test(text) && !/恶性|肿瘤|癌|高度可疑/.test(text)) {
    return { riskLevel: "中风险" as const, severity: "moderate" as const };
  }

  if (/附件区|卵巢|子宫/.test(measuredText) && /低回声|稍低回声/.test(measuredText)) {
    if (/恶性|肿瘤|癌|高度可疑/.test(measuredText)) {
      return { riskLevel: "高风险" as const, severity: "moderate" as const };
    }

    return { riskLevel: "中风险" as const, severity: "moderate" as const };
  }

  if (
    /fpsa\s*\/\s*tpsa|f-?psa\s*\/\s*t-?psa|游离前列腺特异性抗原.*总前列腺特异性抗原|游离psa.*总psa/i.test(
      text,
    )
  ) {
    const ratio = parseFirstNumber(String(record.value || text));
    if (ratio !== null && ratio <= 0.15) {
      return { riskLevel: "高风险" as const, severity: "moderate" as const };
    }
  }

  const thyroidTiradsLevel = extractThyroidTiradsLevel(text);
  if (thyroidTiradsLevel !== null && thyroidTiradsLevel >= 4) {
    return {
      riskLevel: "高风险" as const,
      severity: thyroidTiradsLevel >= 5 ? ("severe" as const) : ("moderate" as const),
    };
  }

  if (/骨质疏松/.test(text)) {
    return { riskLevel: "高风险" as const, severity: "severe" as const };
  }

  if (/t值|t-score|t score/i.test(lowerText)) {
    const tScore = parseFirstNumber(text);
    if (tScore !== null && tScore <= -2.5) {
      return { riskLevel: "高风险" as const, severity: "severe" as const };
    }
  }

  return normalized;
}

function countRiskSignals(analysis: HealthReportAnalysis) {
  let high = 0;
  let highSevere = 0;
  let highModerate = 0;
  let medium = 0;
  let mediumSevere = 0;
  let mediumSevereOrModerate = 0;

  for (const item of Array.isArray(analysis.abnormalItems) ? analysis.abnormalItems : []) {
    const record = asRecord(item);
    const { riskLevel: level, severity } = canonicalizeAbnormalItemRisk(record);
    if (level === "高风险") {
      high += 1;
      if (severity === "severe") {
        highSevere += 1;
      }
      if (severity === "moderate") {
        highModerate += 1;
      }
    }
    if (level === "中风险") {
      medium += 1;
      if (severity === "severe") {
        mediumSevere += 1;
      }
      if (severity === "severe" || severity === "moderate") {
        mediumSevereOrModerate += 1;
      }
    }
  }

  return { high, highSevere, highModerate, medium, mediumSevere, mediumSevereOrModerate };
}

function deriveRiskScore(riskLevel: RiskLevel, analysis: HealthReportAnalysis) {
  const signals = countRiskSignals(analysis);

  if (signals.high >= 5) {
    return Math.min(95, 88 + Math.min(signals.highSevere, 4) + Math.min(signals.mediumSevere, 3));
  }

  if (signals.high >= 3) {
    return Math.min(
      87,
      82 + Math.min(signals.highSevere, 3) + Math.min(signals.mediumSevereOrModerate, 2),
    );
  }

  if (signals.high === 2) {
    if (signals.highSevere >= 2) {
      return 78;
    }

    return signals.highSevere === 1 ? 76 : 72;
  }

  if (riskLevel === "高风险" || signals.high === 1) {
    return Math.min(69, 62 + Math.min(signals.mediumSevereOrModerate, 5));
  }

  if (signals.medium >= 3) {
    return Math.min(59, 52 + Math.min(signals.mediumSevereOrModerate, 7));
  }

  if (riskLevel === "中风险" || signals.medium > 0) {
    return 46;
  }

  const hasAnyFinding =
    signals.high > 0 ||
    signals.medium > 0 ||
    (Array.isArray(analysis.abnormalItems) && analysis.abnormalItems.length > 0);

  return hasAnyFinding ? 28 : 12;
}

function normalizeRiskScore(
  _value: unknown,
  riskLevel: RiskLevel,
  analysis: HealthReportAnalysis,
) {
  return deriveRiskScore(riskLevel, analysis);
}

function deriveRiskLevelFromScore(score: number): RiskLevel {
  if (score >= 70) {
    return "高风险";
  }

  if (score >= 40) {
    return "中风险";
  }

  return "低风险";
}

function sortByRiskLevel<T>(items: T[], getRiskLevel: (item: T) => RiskLevel) {
  return [...items].sort(
    (left, right) => riskOrder[getRiskLevel(left)] - riskOrder[getRiskLevel(right)],
  );
}

export function normalizeHealthReportAnalysis(
  analysis: HealthReportAnalysis,
): HealthReportAnalysis {
  const reportMeta = asRecord(analysis.reportMeta);
  const patient = asRecord(analysis.patient);
  const executiveSummary = asRecord(analysis.executiveSummary);
  const riskBuckets = asRecord(analysis.riskBuckets);
  const lifestyleAdvice = asRecord(analysis.lifestyleAdvice);
  const modelOverallRiskLevel = normalizeRiskLevel(executiveSummary.overallRiskLevel);
  const normalizedRiskScore = normalizeRiskScore(
    executiveSummary.riskScore,
    modelOverallRiskLevel,
    analysis,
  );
  const normalizedOverallRiskLevel = deriveRiskLevelFromScore(normalizedRiskScore);

  return {
    ...analysis,
    schemaVersion:
      typeof analysis.schemaVersion === "string" ? analysis.schemaVersion : "1.0.0",
    reportId: typeof analysis.reportId === "string" ? analysis.reportId : "",
    generatedAt: typeof analysis.generatedAt === "string" ? analysis.generatedAt : "",
    model: typeof analysis.model === "string" ? analysis.model : "",
    reportMeta: {
      fileName: typeof reportMeta.fileName === "string" ? reportMeta.fileName : "",
      reportType: typeof reportMeta.reportType === "string" ? reportMeta.reportType : "",
      institution: typeof reportMeta.institution === "string" ? reportMeta.institution : "",
      department: typeof reportMeta.department === "string" ? reportMeta.department : "",
      reportNumber: typeof reportMeta.reportNumber === "string" ? reportMeta.reportNumber : "",
      examDate: typeof reportMeta.examDate === "string" ? reportMeta.examDate : "",
      reportDate: typeof reportMeta.reportDate === "string" ? reportMeta.reportDate : "",
      pageCount: typeof reportMeta.pageCount === "number" ? reportMeta.pageCount : 0,
      sourceLanguage:
        typeof reportMeta.sourceLanguage === "string" ? reportMeta.sourceLanguage : "",
    },
    patient: {
      name: typeof patient.name === "string" ? patient.name : "",
      gender: typeof patient.gender === "string" ? patient.gender : "",
      age: typeof patient.age === "number" ? patient.age : 0,
      birthDate: typeof patient.birthDate === "string" ? patient.birthDate : "",
      heightCm: typeof patient.heightCm === "number" ? patient.heightCm : 0,
      weightKg: typeof patient.weightKg === "number" ? patient.weightKg : 0,
      bmi: typeof patient.bmi === "number" ? patient.bmi : 0,
      waistCm: typeof patient.waistCm === "number" ? patient.waistCm : 0,
      hipCm: typeof patient.hipCm === "number" ? patient.hipCm : 0,
      menopauseStatus:
        typeof patient.menopauseStatus === "string" ? patient.menopauseStatus : "",
    },
    executiveSummary: {
      overallRiskLevel: normalizedOverallRiskLevel,
      riskScore: normalizedRiskScore,
      summary: typeof executiveSummary.summary === "string" ? executiveSummary.summary : "",
      topSignals: asStringArray(executiveSummary.topSignals),
    },
    abnormalItems: Array.isArray(analysis.abnormalItems)
      ? sortByRiskLevel(
          analysis.abnormalItems.map((item, index) => {
            const normalized = asRecord(item);
            const calibratedRisk = canonicalizeAbnormalItemRisk(normalized);
            return {
              id: typeof normalized.id === "string" ? normalized.id : `abnormal-${index + 1}`,
              name: typeof normalized.name === "string" ? normalized.name : "",
              category: typeof normalized.category === "string" ? normalized.category : "",
              value: typeof normalized.value === "string" ? normalized.value : "",
              unit: typeof normalized.unit === "string" ? normalized.unit : "",
              referenceRange:
                typeof normalized.referenceRange === "string" ? normalized.referenceRange : "",
              flag: typeof normalized.flag === "string" ? normalized.flag : "",
              riskLevel: calibratedRisk.riskLevel,
              severity: calibratedRisk.severity,
              interpretation:
                typeof normalized.interpretation === "string" ? normalized.interpretation : "",
              sourceSection:
                typeof normalized.sourceSection === "string" ? normalized.sourceSection : "",
              sourcePage: typeof normalized.sourcePage === "number" ? normalized.sourcePage : 0,
            };
          }),
          (item) => item.riskLevel,
        )
      : [],
    keyNormalItems: Array.isArray(analysis.keyNormalItems)
      ? analysis.keyNormalItems.map((item) => {
          const normalized = asRecord(item);
          return {
            name: typeof normalized.name === "string" ? normalized.name : "",
            result: typeof normalized.result === "string" ? normalized.result : "",
            sourceSection:
              typeof normalized.sourceSection === "string" ? normalized.sourceSection : "",
            sourcePage: typeof normalized.sourcePage === "number" ? normalized.sourcePage : 0,
          };
        })
      : [],
    riskBuckets: {
      high: asStringArray(riskBuckets.high),
      medium: asStringArray(riskBuckets.medium),
      low: asStringArray(riskBuckets.low),
    },
    systemRisks: Array.isArray(analysis.systemRisks)
      ? sortByRiskLevel(
          analysis.systemRisks.map((item) => {
            const normalized = asRecord(item);
            return {
              system: normalizeSystemRiskKey(normalized.system),
              level: normalizeRiskLevel(normalized.level),
              summary: typeof normalized.summary === "string" ? normalized.summary : "",
              findings: asStringArray(normalized.findings),
            };
          }),
          (item) => item.level,
        )
      : [],
    problemTags: asStringArray(analysis.problemTags),
    recommendations: Array.isArray(analysis.recommendations)
      ? sortByRiskLevel(
          analysis.recommendations.map((item) => {
            const normalized = asRecord(item);
            return {
              title: typeof normalized.title === "string" ? normalized.title : "",
              priority: normalizeRiskLevel(normalized.priority),
              timeframe: typeof normalized.timeframe === "string" ? normalized.timeframe : "",
              department: typeof normalized.department === "string" ? normalized.department : "",
              goal: typeof normalized.goal === "string" ? normalized.goal : "",
              actions: asStringArray(normalized.actions),
              reason: typeof normalized.reason === "string" ? normalized.reason : "",
            };
          }),
          (item) => item.priority,
        )
      : [],
    departmentSuggestions: Array.isArray(analysis.departmentSuggestions)
      ? sortByRiskLevel(
          analysis.departmentSuggestions.map((item) => {
            const normalized = asRecord(item);
            return {
              department:
                typeof normalized.department === "string" ? normalized.department : "",
              priority: normalizeRiskLevel(normalized.priority),
              reason: typeof normalized.reason === "string" ? normalized.reason : "",
              relatedProblems: asStringArray(normalized.relatedProblems),
            };
          }),
          (item) => item.priority,
        )
      : [],
    followUpPlan: Array.isArray(analysis.followUpPlan)
      ? analysis.followUpPlan.map((item) => {
          const normalized = asRecord(item);
          return {
            window: typeof normalized.window === "string" ? normalized.window : "",
            tasks: asStringArray(normalized.tasks),
            targetItems: asStringArray(normalized.targetItems),
            purpose: typeof normalized.purpose === "string" ? normalized.purpose : "",
          };
        })
      : [],
    lifestyleAdvice: {
      diet: asStringArray(lifestyleAdvice.diet),
      exercise: asStringArray(lifestyleAdvice.exercise),
      weightManagement: asStringArray(lifestyleAdvice.weightManagement),
      sleep: asStringArray(lifestyleAdvice.sleep),
      smokingAlcohol: asStringArray(lifestyleAdvice.smokingAlcohol),
      homeMonitoring: asStringArray(lifestyleAdvice.homeMonitoring),
    },
    questionsForDoctor: asStringArray(analysis.questionsForDoctor),
    evidenceMap: Array.isArray(analysis.evidenceMap)
      ? analysis.evidenceMap.map((item) => {
          const normalized = asRecord(item);
          return {
            findingTitle:
              typeof normalized.findingTitle === "string" ? normalized.findingTitle : "",
            sourceSection:
              typeof normalized.sourceSection === "string" ? normalized.sourceSection : "",
            sourcePage: typeof normalized.sourcePage === "number" ? normalized.sourcePage : 0,
            evidence: asStringArray(normalized.evidence),
          };
        })
      : [],
    uncertainties: asStringArray(analysis.uncertainties),
    disclaimers: asStringArray(analysis.disclaimers),
  };
}

export function normalizeStoredReport(report: StoredReport): StoredReport {
  const legacyReport = report as StoredReport & {
    fileKey?: string;
    fileLocation?: string;
    fileUrl?: string;
    reportKey?: string;
    sourceFileKey?: string;
    sourceFileLocation?: string;
    sourceFileUrl?: string;
    analysisFileKey?: string;
    analysisFileLocation?: string;
    analysisFileUrl?: string;
  };
  const reportWithStorage = {
    ...report,
    sourceFilePath:
      report.sourceFilePath ||
      legacyReport.sourceFileLocation ||
      legacyReport.sourceFileKey ||
      legacyReport.fileLocation ||
      legacyReport.fileKey ||
      "",
    analysisFilePath:
      report.analysisFilePath ||
      legacyReport.analysisFileLocation ||
      legacyReport.analysisFileKey ||
      legacyReport.reportKey ||
      "",
  };

  if (!report.analysis) {
    return {
      ...reportWithStorage,
      userId: typeof report.userId === "string" ? report.userId : null,
      analysisModel:
        typeof report.analysisModel === "string" ? report.analysisModel : null,
      overallRiskLevel:
        report.overallRiskLevel === "高风险" ||
        report.overallRiskLevel === "中风险" ||
        report.overallRiskLevel === "低风险"
          ? report.overallRiskLevel
          : null,
      riskScore:
        typeof report.riskScore === "number" && Number.isFinite(report.riskScore)
          ? report.riskScore
          : null,
    };
  }

  const analysis = normalizeHealthReportAnalysis(report.analysis);

  return {
    ...reportWithStorage,
    userId: typeof report.userId === "string" ? report.userId : null,
    patientName: analysis.patient.name || report.patientName,
    examDate: analysis.reportMeta.examDate || report.examDate,
    institution: analysis.reportMeta.institution || report.institution,
    summary: analysis.executiveSummary.summary || report.summary,
    analysisModel: analysis.model || report.analysisModel || "",
    overallRiskLevel:
      analysis.executiveSummary.overallRiskLevel || report.overallRiskLevel || null,
    riskScore: analysis.executiveSummary.riskScore || report.riskScore || null,
    analysis,
  };
}
