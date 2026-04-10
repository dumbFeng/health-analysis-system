"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AiHealthCheckResult } from "@/lib/ai/ai-provider";
import type { PublicReport } from "@/lib/report-types";

type DashboardProps = {
  initialReports: PublicReport[];
  initialAiHealth: AiHealthCheckResult;
};

const statusMeta = {
  analyzing: {
    label: "分析中",
    className: "bg-amber-100 text-amber-800",
  },
  failed: {
    label: "分析失败",
    className: "bg-rose-100 text-rose-700",
  },
  succeeded: {
    label: "分析成功",
    className: "bg-emerald-100 text-emerald-700",
  },
};

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getReportSummary(report: PublicReport) {
  if (report.summary) {
    return report.summary;
  }

  if (report.status === "analyzing") {
    return "系统正在提取结构化数据，完成后这里会显示报告摘要。";
  }

  return "";
}

export function ReportDashboard({
  initialReports,
  initialAiHealth,
}: DashboardProps) {
  const [reports, setReports] = useState(initialReports);
  const [aiHealth, setAiHealth] = useState(initialAiHealth);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function refreshReports() {
    const response = await fetch("/api/reports", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { reports: PublicReport[] };
    setReports(data.reports);
  }

  useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);

  useEffect(() => {
    setAiHealth(initialAiHealth);
  }, [initialAiHealth]);

  const hasActiveAnalysis = useMemo(
    () => reports.some((report) => report.status === "analyzing"),
    [reports],
  );

  const patientOptions = useMemo(() => {
    return Array.from(
      new Set(
        reports
          .map((report) => report.patientName?.trim())
          .filter((name): name is string => Boolean(name)),
      ),
    ).sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [reports]);

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      const matchesPatient =
        selectedPatient === "all" ? true : report.patientName === selectedPatient;
      const matchesStatus =
        selectedStatus === "all" ? true : report.status === selectedStatus;

      return matchesPatient && matchesStatus;
    });
  }, [reports, selectedPatient, selectedStatus]);

  useEffect(() => {
    if (!hasActiveAnalysis) {
      return;
    }

    const timer = window.setInterval(() => {
      void refreshReports();
    }, 3000);

    return () => window.clearInterval(timer);
  }, [hasActiveAnalysis]);

  async function handleUpload(file: File) {
    setUploadError(null);

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadError("当前只支持上传 PDF 体检报告。");
      return;
    }

    const body = new FormData();
    body.append("file", file);

    setIsBusy(true);
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        body,
      });

      const data = (await response.json()) as {
        error?: string;
        report?: PublicReport;
      };

      if (!response.ok || !data.report) {
        setUploadError(data.error ?? "上传失败，请稍后再试。");
        return;
      }

      setReports((current) => [data.report as PublicReport, ...current]);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function handleRetry(reportId: string) {
    setIsBusy(true);
    try {
      await fetch(`/api/reports/retry?id=${reportId}`, { method: "POST" });
      await refreshReports();
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-8 lg:p-10">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-emerald-200/40 via-amber-100/30 to-orange-200/30 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
              <p className="section-title">Upload Health Reports</p>
              <div className="space-y-4">
                <h1 className="max-w-4xl text-4xl leading-tight font-semibold tracking-tight text-stone-900 sm:text-5xl">
                  体检报告分析中心
                </h1>
                <p className="max-w-3xl text-base leading-8 text-stone-700 sm:text-lg">
                  首页只保留上传入口和报告状态卡片。上传 PDF 后，服务端会自动调用 AI
                  生成结构化分析并存储，成功后即可进入详情页查看风险分层、异常项目和后续建议。
                </p>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-stone-200/70 bg-white/75 p-5 shadow-[0_18px_40px_rgba(102,84,58,0.08)]">
              <p className="section-title">上传入口</p>

              <label
                className={`mt-4 flex flex-col items-center justify-center rounded-[1.6rem] border border-dashed px-6 py-10 text-center transition ${
                  isBusy
                    ? "cursor-not-allowed border-stone-200 bg-stone-100/90 opacity-75"
                    : "cursor-pointer border-stone-300 bg-stone-50/90 hover:border-emerald-600 hover:bg-white"
                }`}
              >
                <span className="text-lg font-semibold text-stone-900">
                  选择 PDF 体检报告
                </span>
                <span className="mt-2 text-sm leading-6 text-stone-600">
                  当前先只支持单个 PDF 上传。上传后会自动进入“分析中”状态。
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  disabled={isBusy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file && !isBusy) {
                      void handleUpload(file);
                    }
                  }}
                />
              </label>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <div className="rounded-[1.2rem] bg-stone-900 px-4 py-4 text-stone-100">
                  <p className="text-xs tracking-[0.16em] text-stone-300 uppercase">
                    已上传
                  </p>
                  <p className="mt-2 text-3xl font-semibold">{reports.length}</p>
                </div>
                <div className="rounded-[1.2rem] bg-amber-50 px-4 py-4 text-amber-900">
                  <p className="text-xs tracking-[0.16em] uppercase">分析中</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {reports.filter((report) => report.status === "analyzing").length}
                  </p>
                </div>
                <div className="rounded-[1.2rem] bg-emerald-50 px-4 py-4 text-emerald-900">
                  <p className="text-xs tracking-[0.16em] uppercase">已完成</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {reports.filter((report) => report.status === "succeeded").length}
                  </p>
                </div>
              </div>

              {uploadError ? (
                <p className="mt-4 rounded-2xl bg-rose-100 px-4 py-3 text-sm text-rose-700">
                  {uploadError}
                </p>
              ) : null}

              <p className="mt-4 text-sm leading-6 text-stone-500">
                {isBusy
                  ? "请求正在处理，稍后卡片会自动更新状态。"
                  : "报告上传后会自动开始分析，完成后可进入详情页查看结果。"}
              </p>
            </div>
          </div>
        </section>

        <section className="glass rounded-[2rem] p-6 sm:p-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-title">报告列表</p>
              <h2 className="mt-2 text-3xl font-semibold text-stone-900">
                分析任务卡片
              </h2>
            </div>
            <button
              type="button"
              onClick={() => {
                void refreshReports();
              }}
              className="button-primary rounded-full px-4 py-2 text-sm font-medium transition"
            >
              刷新状态
            </button>
          </div>

          {reports.length > 0 ? (
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <label className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 px-4 py-3">
                <span className="text-xs tracking-[0.16em] text-stone-500 uppercase">
                  受检人
                </span>
                <select
                  value={selectedPatient}
                  onChange={(event) => {
                    setSelectedPatient(event.target.value);
                  }}
                  className="mt-2 w-full bg-transparent text-sm text-stone-800 outline-none"
                >
                  <option value="all">全部受检人</option>
                  {patientOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="rounded-[1.4rem] border border-stone-200/70 bg-white/75 px-4 py-3">
                <span className="text-xs tracking-[0.16em] text-stone-500 uppercase">
                  分析状态
                </span>
                <select
                  value={selectedStatus}
                  onChange={(event) => {
                    setSelectedStatus(event.target.value);
                  }}
                  className="mt-2 w-full bg-transparent text-sm text-stone-800 outline-none"
                >
                  <option value="all">全部状态</option>
                  <option value="analyzing">分析中</option>
                  <option value="succeeded">分析成功</option>
                  <option value="failed">分析失败</option>
                </select>
              </label>
            </div>
          ) : null}

          {reports.length === 0 ? (
            <div className="mt-6 rounded-[1.6rem] border border-dashed border-stone-300 bg-white/55 px-6 py-12 text-center">
              <h3 className="text-xl font-semibold text-stone-900">还没有上传记录</h3>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                从上面的上传入口选择 PDF 体检报告，系统会自动创建一张分析任务卡片。
              </p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="mt-6 rounded-[1.6rem] border border-dashed border-stone-300 bg-white/55 px-6 py-12 text-center">
              <h3 className="text-xl font-semibold text-stone-900">没有符合筛选条件的报告</h3>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                可以切换受检人或分析状态，查看其他报告任务。
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              {filteredReports.map((report) => {
                const status = statusMeta[report.status];

                return (
                  <article
                    key={report.id}
                    className="rounded-[1.6rem] border border-stone-200/70 bg-white/75 p-5 shadow-[0_14px_30px_rgba(102,84,58,0.06)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                      <span className="text-sm text-stone-500">
                        {formatDate(report.createdAt)}
                      </span>
                    </div>

                    <h3 className="mt-4 text-xl font-semibold text-stone-900">
                      {report.patientName || report.fileName}
                    </h3>
                    {getReportSummary(report) ? (
                      <p className="mt-2 text-sm leading-7 text-stone-600">
                        {getReportSummary(report)}
                      </p>
                    ) : null}

                    {report.status !== "failed" ? (
                      <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[1.2rem] bg-stone-50/90 px-4 py-3">
                          <dt className="text-xs tracking-[0.16em] text-stone-500 uppercase">
                            原文件
                          </dt>
                          <dd className="mt-2 text-sm text-stone-700">{report.fileName}</dd>
                        </div>
                        <div className="rounded-[1.2rem] bg-stone-50/90 px-4 py-3">
                          <dt className="text-xs tracking-[0.16em] text-stone-500 uppercase">
                            大小
                          </dt>
                          <dd className="mt-2 text-sm text-stone-700">
                            {formatFileSize(report.fileSize)}
                          </dd>
                        </div>
                        <div className="rounded-[1.2rem] bg-stone-50/90 px-4 py-3">
                          <dt className="text-xs tracking-[0.16em] text-stone-500 uppercase">
                            体检日期
                          </dt>
                          <dd className="mt-2 text-sm text-stone-700">
                            {report.examDate || "待分析"}
                          </dd>
                        </div>
                        <div className="rounded-[1.2rem] bg-stone-50/90 px-4 py-3">
                          <dt className="text-xs tracking-[0.16em] text-stone-500 uppercase">
                            机构
                          </dt>
                          <dd className="mt-2 text-sm text-stone-700">
                            {report.institution || "待分析"}
                          </dd>
                        </div>
                      </dl>
                    ) : null}

                    <div className="mt-5 flex flex-wrap gap-3">
                      {report.status === "succeeded" ? (
                        <Link
                          href={`/reports?id=${report.id}`}
                          className="button-primary rounded-full px-4 py-2 text-sm font-medium transition"
                        >
                          查看分析结果
                        </Link>
                      ) : null}

                      {report.status === "failed" ? (
                        <button
                          type="button"
                          onClick={() => {
                            void handleRetry(report.id);
                          }}
                          className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-500"
                        >
                          重新分析
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
