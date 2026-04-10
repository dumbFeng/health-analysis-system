import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportDetailToc } from "@/components/report-detail-toc";
import { normalizeHealthReportAnalysis } from "@/lib/report-analysis-normalizer";
import { getReport } from "@/lib/report-store";
import type { HealthReportAnalysis, RiskLevel } from "@/lib/report-types";

const levelClass: Record<RiskLevel, string> = {
  高风险: "risk-high",
  中风险: "risk-mid",
  低风险: "risk-low",
};

const systemLabels: Record<HealthReportAnalysis["systemRisks"][number]["system"], string> = {
  cardiovascular: "心脑血管",
  endocrine_metabolic: "内分泌与代谢",
  hepatic: "肝胆",
  renal: "肾脏",
  thyroid: "甲状腺",
  respiratory: "呼吸系统",
  urology: "泌尿系统",
  gynecology: "妇科",
  bone: "骨骼健康",
  gastrointestinal: "消化系统",
  tumor_screening: "肿瘤筛查",
  other: "其他",
};

function renderMetaRow(label: string, value: string | number) {
  return (
    <div className="rounded-[1.3rem] bg-stone-50/90 px-4 py-4">
      <p className="text-xs tracking-[0.16em] text-stone-500 uppercase">{label}</p>
      <p className="mt-2 text-sm leading-7 text-stone-700">{String(value || "未提取")}</p>
    </div>
  );
}

function RecommendationCard({
  title,
  priority,
  timeframe,
  department,
  goal,
  actions,
  reason,
}: HealthReportAnalysis["recommendations"][number]) {
  return (
    <article className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${levelClass[priority]}`}>
          {priority}
        </span>
        <span className="rounded-full bg-stone-900 px-3 py-1 text-xs tracking-[0.16em] text-stone-50 uppercase">
          {timeframe}
        </span>
        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
          {department}
        </span>
      </div>
      <h3 className="mt-4 text-xl font-semibold text-stone-900">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-stone-700">{goal}</p>
      <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-700">
        {actions.map((action) => (
          <li key={action}>{action}</li>
        ))}
      </ul>
      <p className="mt-4 text-sm leading-7 text-stone-500">{reason}</p>
    </article>
  );
}

function AdviceGroup({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <article className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 p-4">
      <h3 className="text-lg font-semibold text-stone-900">{title}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-700">
        {items.length > 0 ? items.map((item) => <li key={item}>{item}</li>) : <li>暂无</li>}
      </ul>
    </article>
  );
}

function DetailSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="glass scroll-mt-24 rounded-[2rem] p-6 sm:p-8">
      <p className="section-title">{title}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function ReportDetailPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;

  if (!id) {
    notFound();
  }

  let report;
  try {
    report = await getReport(id);
  } catch {
    notFound();
  }

  if (!report.analysis || report.status !== "succeeded") {
    notFound();
  }

  const analysis = normalizeHealthReportAnalysis(report.analysis);
  const sectionLinks = [
    { id: "key-signals", label: "关键提示" },
    { id: "risk-buckets", label: "风险分层" },
    { id: "abnormal-items", label: "异常项目" },
    { id: "system-risks", label: "系统风险" },
    { id: "recommendations", label: "下一步建议" },
    { id: "department-suggestions", label: "挂号建议" },
    { id: "follow-up-plan", label: "复查时间线" },
    { id: "key-normal-items", label: "关键正常项" },
    { id: "lifestyle-advice", label: "生活方式建议" },
    { id: "questions-for-doctor", label: "看诊时可问医生" },
    { id: "evidence-map", label: "证据映射" },
    { id: "uncertainties", label: "不确定性与提醒" },
  ];

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="glass rounded-[2rem] p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-4">
              <Link
                href="/"
                className="button-primary inline-flex rounded-full px-4 py-2 text-sm font-medium transition"
              >
                返回首页
              </Link>
              <div>
                <p className="section-title">体检报告分析结果</p>
                <h1 className="mt-2 text-4xl font-semibold tracking-tight text-stone-900">
                  {analysis.patient.name || report.fileName}
                </h1>
                <p className="mt-3 max-w-3xl text-base leading-8 text-stone-700">
                  {analysis.executiveSummary.summary}
                </p>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-stone-200/70 bg-white/80 px-5 py-4">
              {/* <p className="text-xs tracking-[0.16em] text-stone-500 uppercase">
                总体风险
              </p> */}
              <div className="mt-3 flex items-center gap-3">
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${levelClass[analysis.executiveSummary.overallRiskLevel]}`}
                >
                  {analysis.executiveSummary.overallRiskLevel}
                </span>
                <span className="text-sm text-stone-500">
                  风险分 {analysis.executiveSummary.riskScore}
                </span>
              </div>
              <p className="mt-3 text-sm text-stone-500">分析模型：{analysis.model}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {renderMetaRow("姓名", analysis.patient.name)}
            {renderMetaRow("性别 / 年龄", `${analysis.patient.gender} / ${analysis.patient.age}`)}
            {renderMetaRow("身高 / 体重", `${analysis.patient.heightCm} cm / ${analysis.patient.weightKg} kg`)}
            {renderMetaRow("BMI", analysis.patient.bmi)}
            {renderMetaRow("腰围 / 臀围", `${analysis.patient.waistCm} cm / ${analysis.patient.hipCm} cm`)}
            {renderMetaRow("体检日期", analysis.reportMeta.examDate)}
            {renderMetaRow("机构", analysis.reportMeta.institution)}
            {renderMetaRow("原文件", analysis.reportMeta.fileName)}
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <ReportDetailToc sectionLinks={sectionLinks} />
          </aside>

          <div className="space-y-6">
            <DetailSection id="key-signals" title="关键提示">
              <div className="grid gap-4 md:grid-cols-3">
                {analysis.executiveSummary.topSignals.map((signal) => (
                  <div
                    key={signal}
                    className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 p-5 text-sm leading-7 text-stone-700"
                  >
                    {signal}
                  </div>
                ))}
              </div>
            </DetailSection>

            <DetailSection id="risk-buckets" title="风险分层">
              <div className="space-y-4">
                <div className="rounded-[1.4rem] bg-rose-50 px-5 py-5">
                  <p className="text-sm font-semibold text-rose-700">高风险</p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-rose-900">
                    {analysis.riskBuckets.high.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[1.4rem] bg-amber-50 px-5 py-5">
                  <p className="text-sm font-semibold text-amber-700">中风险</p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-amber-900">
                    {analysis.riskBuckets.medium.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-[1.4rem] bg-emerald-50 px-5 py-5">
                  <p className="text-sm font-semibold text-emerald-700">低风险</p>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-emerald-900">
                    {analysis.riskBuckets.low.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </DetailSection>

            <DetailSection id="abnormal-items" title="异常项目">
              <div className="space-y-4">
                {analysis.abnormalItems.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 p-5"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${levelClass[item.riskLevel]}`}
                      >
                        {item.riskLevel}
                      </span>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                        {item.category}
                      </span>
                      <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600">
                        {item.severity}
                      </span>
                      <h3 className="text-lg font-semibold text-stone-900">{item.name}</h3>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-3">
                      <div className="rounded-[1.2rem] bg-stone-50/90 px-4 py-3">
                        <p className="text-xs tracking-[0.16em] text-stone-500 uppercase">检测值</p>
                        <p className="mt-2 text-sm text-stone-700">
                          {item.value} {item.unit}
                        </p>
                      </div>
                      <div className="rounded-[1.2rem] bg-stone-50/90 px-4 py-3">
                        <p className="text-xs tracking-[0.16em] text-stone-500 uppercase">参考范围</p>
                        <p className="mt-2 text-sm text-stone-700">{item.referenceRange}</p>
                      </div>
                      <div className="rounded-[1.2rem] bg-stone-50/90 px-4 py-3">
                        <p className="text-xs tracking-[0.16em] text-stone-500 uppercase">标记</p>
                        <p className="mt-2 text-sm text-stone-700">{item.flag}</p>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-stone-700">{item.interpretation}</p>
                    <p className="mt-3 text-xs text-stone-500">
                      依据：{item.sourceSection} · 第 {item.sourcePage} 页
                    </p>
                  </article>
                ))}
              </div>
            </DetailSection>

            <DetailSection id="system-risks" title="系统风险">
              <div className="space-y-4">
                {analysis.systemRisks.map((item) => (
                  <article
                    key={`${item.system}-${item.summary}`}
                    className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${levelClass[item.level]}`}
                      >
                        {item.level}
                      </span>
                      <h3 className="text-lg font-semibold text-stone-900">
                        {systemLabels[item.system]}
                      </h3>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-stone-700">{item.summary}</p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-700">
                      {item.findings.map((finding) => (
                        <li key={finding}>{finding}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </DetailSection>

            <DetailSection id="recommendations" title="下一步建议">
              <div className="space-y-4">
                {analysis.recommendations.map((item) => (
                  <RecommendationCard key={`${item.title}-${item.timeframe}`} {...item} />
                ))}
              </div>
            </DetailSection>

            <DetailSection id="department-suggestions" title="挂号建议">
              <div className="space-y-4">
                {analysis.departmentSuggestions.map((item) => (
                  <article
                    key={`${item.department}-${item.reason}`}
                    className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${levelClass[item.priority]}`}
                      >
                        {item.priority}
                      </span>
                      <h3 className="text-lg font-semibold text-stone-900">{item.department}</h3>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-stone-700">{item.reason}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.relatedProblems.map((problem) => (
                        <span
                          key={problem}
                          className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-600"
                        >
                          {problem}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </DetailSection>

            <DetailSection id="follow-up-plan" title="复查时间线">
              <div className="space-y-4">
                {analysis.followUpPlan.map((plan) => (
                  <article
                    key={plan.window}
                    className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 p-4"
                  >
                    <h3 className="text-lg font-semibold text-stone-900">{plan.window}</h3>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-700">
                      {plan.tasks.map((task) => (
                        <li key={task}>{task}</li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-stone-500">
                      目标项：{plan.targetItems.join("、")} | {plan.purpose}
                    </p>
                  </article>
                ))}
              </div>
            </DetailSection>

            <DetailSection id="key-normal-items" title="关键正常项">
              <div className="grid gap-4 md:grid-cols-2">
                {analysis.keyNormalItems.map((item) => (
                  <article
                    key={`${item.name}-${item.result}`}
                    className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 p-4"
                  >
                    <h3 className="text-lg font-semibold text-stone-900">{item.name}</h3>
                    <p className="mt-2 text-sm leading-7 text-stone-700">{item.result}</p>
                    <p className="mt-2 text-xs text-stone-500">
                      {item.sourceSection} · 第 {item.sourcePage} 页
                    </p>
                  </article>
                ))}
              </div>
            </DetailSection>

            <DetailSection id="lifestyle-advice" title="生活方式建议">
              <div className="space-y-4">
                <AdviceGroup title="饮食" items={analysis.lifestyleAdvice.diet} />
                <AdviceGroup title="运动" items={analysis.lifestyleAdvice.exercise} />
                <AdviceGroup
                  title="体重管理"
                  items={analysis.lifestyleAdvice.weightManagement}
                />
                <AdviceGroup title="睡眠" items={analysis.lifestyleAdvice.sleep} />
                <AdviceGroup
                  title="烟酒与习惯"
                  items={analysis.lifestyleAdvice.smokingAlcohol}
                />
                <AdviceGroup
                  title="居家监测"
                  items={analysis.lifestyleAdvice.homeMonitoring}
                />
              </div>
            </DetailSection>

            <DetailSection id="questions-for-doctor" title="看诊时可问医生">
              <ul className="mt-5 space-y-3 text-sm leading-7 text-stone-100">
                {analysis.questionsForDoctor.map((item) => (
                  <li key={item} className="rounded-[1.3rem] bg-stone-900 px-4 py-4">
                    {item}
                  </li>
                ))}
              </ul>
            </DetailSection>

            <DetailSection id="evidence-map" title="证据映射">
              <div className="space-y-4">
                {analysis.evidenceMap.map((item) => (
                  <article
                    key={`${item.findingTitle}-${item.sourcePage}`}
                    className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 p-4"
                  >
                    <h3 className="text-lg font-semibold text-stone-900">{item.findingTitle}</h3>
                    <p className="mt-2 text-xs text-stone-500">
                      {item.sourceSection} · 第 {item.sourcePage} 页
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-700">
                      {item.evidence.map((evidence) => (
                        <li key={evidence}>{evidence}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </DetailSection>

            <DetailSection id="uncertainties" title="不确定性与提醒">
              <div className="space-y-4">
                <article className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 p-4">
                  <h3 className="text-lg font-semibold text-stone-900">不确定性</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-700">
                    {analysis.uncertainties.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
                <article className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 p-4">
                  <h3 className="text-lg font-semibold text-stone-900">免责声明</h3>
                  <ul className="mt-3 space-y-2 text-sm leading-7 text-stone-700">
                    {analysis.disclaimers.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              </div>
            </DetailSection>
          </div>
        </section>
      </div>
    </main>
  );
}
