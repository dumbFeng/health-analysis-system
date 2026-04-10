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
      overallRiskLevel: normalizeRiskLevel(executiveSummary.overallRiskLevel),
      riskScore: typeof executiveSummary.riskScore === "number" ? executiveSummary.riskScore : 0,
      summary: typeof executiveSummary.summary === "string" ? executiveSummary.summary : "",
      topSignals: asStringArray(executiveSummary.topSignals),
    },
    abnormalItems: Array.isArray(analysis.abnormalItems)
      ? sortByRiskLevel(
          analysis.abnormalItems.map((item, index) => {
            const normalized = asRecord(item);
            return {
              id: typeof normalized.id === "string" ? normalized.id : `abnormal-${index + 1}`,
              name: typeof normalized.name === "string" ? normalized.name : "",
              category: typeof normalized.category === "string" ? normalized.category : "",
              value: typeof normalized.value === "string" ? normalized.value : "",
              unit: typeof normalized.unit === "string" ? normalized.unit : "",
              referenceRange:
                typeof normalized.referenceRange === "string" ? normalized.referenceRange : "",
              flag: typeof normalized.flag === "string" ? normalized.flag : "",
              riskLevel: normalizeRiskLevel(normalized.riskLevel),
              severity: normalizeSeverity(normalized.severity),
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
  if (!report.analysis) {
    return report;
  }

  const analysis = normalizeHealthReportAnalysis(report.analysis);

  return {
    ...report,
    patientName: analysis.patient.name || report.patientName,
    examDate: analysis.reportMeta.examDate || report.examDate,
    institution: analysis.reportMeta.institution || report.institution,
    summary: analysis.executiveSummary.summary || report.summary,
    analysis,
  };
}
