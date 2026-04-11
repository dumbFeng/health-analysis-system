const systemRiskEnum = [
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
] as const;

const riskLevelEnum = ["高风险", "中风险", "低风险"] as const;
const severityEnum = ["mild", "moderate", "severe"] as const;

export const healthReportAnalysisSchema = {
  name: "health_report_analysis_v1",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
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
    ],
    properties: {
      schemaVersion: { type: "string" },
      reportId: { type: "string" },
      generatedAt: { type: "string" },
      model: { type: "string" },
      reportMeta: {
        type: "object",
        additionalProperties: false,
        required: [
          "fileName",
          "reportType",
          "institution",
          "department",
          "reportNumber",
          "examDate",
          "reportDate",
          "pageCount",
          "sourceLanguage",
        ],
        properties: {
          fileName: { type: "string" },
          reportType: { type: "string" },
          institution: { type: "string" },
          department: { type: "string" },
          reportNumber: { type: "string" },
          examDate: { type: "string" },
          reportDate: { type: "string" },
          pageCount: { type: "integer" },
          sourceLanguage: { type: "string" },
        },
      },
      patient: {
        type: "object",
        additionalProperties: false,
        required: [
          "name",
          "gender",
          "age",
          "birthDate",
          "heightCm",
          "weightKg",
          "bmi",
          "waistCm",
          "hipCm",
          "menopauseStatus",
        ],
        properties: {
          name: { type: "string" },
          gender: { type: "string" },
          age: { type: "integer" },
          birthDate: { type: "string" },
          heightCm: { type: "number" },
          weightKg: { type: "number" },
          bmi: { type: "number" },
          waistCm: { type: "number" },
          hipCm: { type: "number" },
          menopauseStatus: { type: "string" },
        },
      },
      executiveSummary: {
        type: "object",
        additionalProperties: false,
        required: ["overallRiskLevel", "riskScore", "summary", "topSignals"],
        properties: {
          overallRiskLevel: {
            type: "string",
            enum: [...riskLevelEnum],
          },
          riskScore: { type: "number" },
          summary: { type: "string" },
          topSignals: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
      abnormalItems: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "id",
            "name",
            "category",
            "value",
            "unit",
            "referenceRange",
            "flag",
            "riskLevel",
            "severity",
            "interpretation",
            "sourceSection",
            "sourcePage",
          ],
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            category: { type: "string" },
            value: { type: "string" },
            unit: { type: "string" },
            referenceRange: { type: "string" },
            flag: { type: "string" },
            riskLevel: {
              type: "string",
              enum: [...riskLevelEnum],
            },
            severity: {
              type: "string",
              enum: [...severityEnum],
            },
            interpretation: { type: "string" },
            sourceSection: { type: "string" },
            sourcePage: { type: "integer" },
          },
        },
      },
      keyNormalItems: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "result", "sourceSection", "sourcePage"],
          properties: {
            name: { type: "string" },
            result: { type: "string" },
            sourceSection: { type: "string" },
            sourcePage: { type: "integer" },
          },
        },
      },
      riskBuckets: {
        type: "object",
        additionalProperties: false,
        required: ["high", "medium", "low"],
        properties: {
          high: { type: "array", items: { type: "string" } },
          medium: { type: "array", items: { type: "string" } },
          low: { type: "array", items: { type: "string" } },
        },
      },
      systemRisks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["system", "level", "summary", "findings"],
          properties: {
            system: {
              type: "string",
              enum: [...systemRiskEnum],
            },
            level: {
              type: "string",
              enum: [...riskLevelEnum],
            },
            summary: { type: "string" },
            findings: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
      problemTags: {
        type: "array",
        items: { type: "string" },
      },
      recommendations: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "priority",
            "timeframe",
            "department",
            "goal",
            "actions",
            "reason",
          ],
          properties: {
            title: { type: "string" },
            priority: {
              type: "string",
              enum: [...riskLevelEnum],
            },
            timeframe: { type: "string" },
            department: { type: "string" },
            goal: { type: "string" },
            actions: {
              type: "array",
              items: { type: "string" },
            },
            reason: { type: "string" },
          },
        },
      },
      departmentSuggestions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["department", "priority", "reason", "relatedProblems"],
          properties: {
            department: { type: "string" },
            priority: {
              type: "string",
              enum: [...riskLevelEnum],
            },
            reason: { type: "string" },
            relatedProblems: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
      followUpPlan: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["window", "tasks", "targetItems", "purpose"],
          properties: {
            window: { type: "string" },
            tasks: {
              type: "array",
              items: { type: "string" },
            },
            targetItems: {
              type: "array",
              items: { type: "string" },
            },
            purpose: { type: "string" },
          },
        },
      },
      lifestyleAdvice: {
        type: "object",
        additionalProperties: false,
        required: [
          "diet",
          "exercise",
          "weightManagement",
          "sleep",
          "smokingAlcohol",
          "homeMonitoring",
        ],
        properties: {
          diet: { type: "array", items: { type: "string" } },
          exercise: { type: "array", items: { type: "string" } },
          weightManagement: { type: "array", items: { type: "string" } },
          sleep: { type: "array", items: { type: "string" } },
          smokingAlcohol: { type: "array", items: { type: "string" } },
          homeMonitoring: { type: "array", items: { type: "string" } },
        },
      },
      questionsForDoctor: {
        type: "array",
        items: { type: "string" },
      },
      evidenceMap: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["findingTitle", "sourceSection", "sourcePage", "evidence"],
          properties: {
            findingTitle: { type: "string" },
            sourceSection: { type: "string" },
            sourcePage: { type: "integer" },
            evidence: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
      uncertainties: {
        type: "array",
        items: { type: "string" },
      },
      disclaimers: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
} as const;

export function buildHealthReportAnalysisInstructions() {
  return `你是一名谨慎的中文健康体检报告分析助手。

你的目标不是自由发挥，而是稳定地产出一份完整的 Schema v1 JSON。

全局规则：
1. 只能基于报告原文或提取文本作答，不要编造未出现的检查、诊断、治疗史或症状。
2. 不确定时可以保守判断，但仍必须把字段补齐。
3. 输出必须是单个 JSON 对象，不能输出 Markdown、解释、前后缀、代码块、注释或额外文字。
4. 不要输出 <think>、analysis、reasoning 等隐藏推理内容。
5. 所有必填字段都必须存在；不能省略字段，不能输出 null。
6. 缺失值处理：
   - 字符串字段填 ""
   - 普通数值字段填 0
   - executiveSummary.riskScore 不能填 0，必须按风险等级和异常项估算 1-100 的整数分
   - 数组字段填 []
   - 对象字段必须完整保留其内部必填字段
7. 枚举值必须严格使用：
   - overallRiskLevel / riskLevel / priority / level: 只能是 "高风险"、"中风险"、"低风险"
   - severity: 只能是 "mild"、"moderate"、"severe"
   - system: 只能是 "cardiovascular"、"endocrine_metabolic"、"hepatic"、"renal"、"thyroid"、"respiratory"、"urology"、"gynecology"、"bone"、"gastrointestinal"、"tumor_screening"、"other"
8. 页面编号 sourcePage 无法判断时填 0。
9. 日期字段无法判断时填 ""，不要猜测。
10. topSignals 最多 5 条，abnormalItems 最多 15 条，keyNormalItems 最多 5 条，recommendations 最多 8 条，departmentSuggestions 最多 5 条，evidenceMap 仅保留关键结论依据。
11. executiveSummary.riskScore 必须使用下面的稳定评分规程，不要凭直觉自由给分：
   - 评分只基于 abnormalItems 中的核心异常项，不要把 riskBuckets、systemRisks、recommendations 里的同一问题重复计数。
   - “高风险异常项”只包括：恶性肿瘤高度可疑或需排除、TI-RADS 4级及以上、严重心脑血管事件风险、重度骨质疏松、明确严重器官功能异常、报告明确建议尽快专科排查的关键异常。
   - 普通血压/血糖/血脂升高、肥胖、脂肪肝、轻中度肝功能异常、轻度炎症、低级别结节，通常归为中风险，除非报告明确提示严重或紧急。
   - 高风险异常项 >= 5：overallRiskLevel = "高风险"，riskScore = 88-95；severe 高风险和 severe 中风险越多分数越高。
   - 高风险异常项 3-4 个：overallRiskLevel = "高风险"，riskScore = 82-87；severe 高风险和中重度中风险越多分数越高。
   - 高风险异常项 2 个：overallRiskLevel = "高风险"，riskScore = 72-78；两个均为 moderate 取 72，包含一个 severe 取 76，两个均为 severe 取 78。
   - 高风险异常项 1 个：如果合并多个中重度中风险异常，overallRiskLevel = "中风险"，riskScore = 62-69；否则靠近 62。
   - 无高风险异常项，且中风险异常项 >= 3：overallRiskLevel = "中风险"，riskScore = 52-59；中重度中风险异常越多分数越高。
   - 无高风险异常项，且中风险异常项 1-2 个：overallRiskLevel = "中风险"，riskScore = 46。
   - 仅有轻微异常或生活方式相关问题：overallRiskLevel = "低风险"，riskScore = 28。
   - 未发现明确异常：overallRiskLevel = "低风险"，riskScore = 12。
   - 如果证据不足，不要随机选择分数；使用对应区间的低位分数。
   - 同一份报告、同一组异常证据，每次必须输出相同的 overallRiskLevel 和 riskScore。
   - riskScore 必须是整数，不能为 0。

顶层字段必须完整输出：
schemaVersion, reportId, generatedAt, model, reportMeta, patient, executiveSummary, abnormalItems, keyNormalItems, riskBuckets, systemRisks, problemTags, recommendations, departmentSuggestions, followUpPlan, lifestyleAdvice, questionsForDoctor, evidenceMap, uncertainties, disclaimers

其中以下嵌套对象也必须完整：
- reportMeta: fileName, reportType, institution, department, reportNumber, examDate, reportDate, pageCount, sourceLanguage
- patient: name, gender, age, birthDate, heightCm, weightKg, bmi, waistCm, hipCm, menopauseStatus
- executiveSummary: overallRiskLevel, riskScore, summary, topSignals
- riskBuckets: high, medium, low
- lifestyleAdvice: diet, exercise, weightManagement, sleep, smokingAlcohol, homeMonitoring

abnormalItems 中每一项都必须完整：
id, name, category, value, unit, referenceRange, flag, riskLevel, severity, interpretation, sourceSection, sourcePage

keyNormalItems 中每一项都必须完整：
name, result, sourceSection, sourcePage

systemRisks 中每一项都必须完整：
system, level, summary, findings

recommendations 中每一项都必须完整：
title, priority, timeframe, department, goal, actions, reason

departmentSuggestions 中每一项都必须完整：
department, priority, reason, relatedProblems

followUpPlan 中每一项都必须完整：
window, tasks, targetItems, purpose

evidenceMap 中每一项都必须完整：
findingTitle, sourceSection, sourcePage, evidence

特别注意：
- patient.name、reportMeta.examDate、executiveSummary.summary 这三个字段必须始终存在，缺失时也要按规则填默认值。
- 风险评分要由异常证据数量和严重程度决定，不要受措辞风格、输出长度、建议数量影响。
- 如果文本内容不足以支持复杂结论，也要返回“保守但完整”的结构化结果。`;
}

export function buildHealthReportAnalysisUserPrompt(input: {
  reportId: string;
  fileName: string;
}) {
  return `请分析这份体检 PDF，生成最终 Schema v1 的结构化健康管理结果。

要求：
1. reportId 必须输出为 "${input.reportId}"
2. schemaVersion 固定输出为 "1.0.0"
3. reportMeta.fileName 输出原始文件名 "${input.fileName}"
4. 仅依据报告内容，不要补造没有依据的临床信息
5. 如果某字段无法明确识别，输出空字符串、0 或空数组，但必须保持 schema 完整
6. 风险判断和建议要克制、可执行、偏健康管理和就诊建议，不直接替代临床确诊
7. executiveSummary.overallRiskLevel 和 riskScore 必须严格按系统提示中的稳定评分规程生成
8. executiveSummary.riskScore 必须是 1-100 的整数，不能为 0
9. 请先检查顶层字段是否齐全，再检查每个嵌套对象是否齐全，最后再输出
10. 如果返回了 abnormalItems、recommendations、systemRisks、evidenceMap 等数组，数组里的每个对象都必须是完整对象，不能缺字段
11. 不能输出 null，不能省略字段，不能输出 JSON 以外的内容

输出前自检：
- patient.name 是否存在
- reportMeta.examDate 是否存在
- executiveSummary.summary 是否存在
- executiveSummary.overallRiskLevel 是否与高风险信号/中风险信号数量匹配
- executiveSummary.riskScore 是否是 1-100 的非零整数
- executiveSummary.riskScore 是否落在系统提示定义的稳定评分区间内
- lifestyleAdvice 六个数组字段是否都存在
- riskBuckets 是否同时含有 high、medium、low
- disclaimers 和 uncertainties 是否存在`;
}
