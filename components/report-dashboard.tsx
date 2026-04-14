"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { AiHealthCheckResult } from "@/lib/ai/ai-provider";
import type { PublicReport, ReportListSummary } from "@/lib/report-types";

type DashboardProps = {
  initialReports: PublicReport[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  initialSummary: ReportListSummary;
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

function getRiskClass(level: PublicReport["overallRiskLevel"]) {
  if (level === "高风险") {
    return "bg-rose-100 text-rose-700";
  }

  if (level === "中风险") {
    return "bg-amber-100 text-amber-800";
  }

  if (level === "低风险") {
    return "bg-emerald-100 text-emerald-700";
  }

  return "bg-stone-100 text-stone-500";
}

export function ReportDashboard({
  initialReports,
  initialNextCursor,
  initialHasMore,
  initialSummary,
  initialAiHealth,
}: DashboardProps) {
  const [reports, setReports] = useState(initialReports);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [summary, setSummary] = useState(initialSummary);
  const [aiHealth, setAiHealth] = useState(initialAiHealth);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reportPendingDelete, setReportPendingDelete] = useState<PublicReport | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [copiedReportId, setCopiedReportId] = useState<string | null>(null);
  const [selectedPatient, setSelectedPatient] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  async function refreshReports(limit = reports.length) {
    const response = await fetch(`/api/reports?limit=${limit}`, { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as {
      reports: PublicReport[];
      nextCursor: string | null;
      hasMore: boolean;
      summary: ReportListSummary;
    };
    setReports(data.reports);
    setNextCursor(data.nextCursor);
    setHasMore(data.hasMore);
    setSummary(data.summary);
  }

  async function loadMoreReports() {
    if (!hasMore || !nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    try {
      const response = await fetch(
        `/api/reports?cursor=${encodeURIComponent(nextCursor)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        reports: PublicReport[];
        nextCursor: string | null;
        hasMore: boolean;
        summary: ReportListSummary;
      };
      setReports((current) => [...current, ...data.reports]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
      setSummary(data.summary);
    } finally {
      setIsLoadingMore(false);
    }
  }

  useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);

  useEffect(() => {
    setNextCursor(initialNextCursor);
  }, [initialNextCursor]);

  useEffect(() => {
    setHasMore(initialHasMore);
  }, [initialHasMore]);

  useEffect(() => {
    setSummary(initialSummary);
  }, [initialSummary]);

  useEffect(() => {
    setAiHealth(initialAiHealth);
  }, [initialAiHealth]);

  useEffect(() => {
    if (!openMenuId) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [openMenuId]);

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

  useEffect(() => {
    if (!hasMore || isLoadingMore || !loadMoreRef.current) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadMoreReports();
        }
      },
      {
        rootMargin: "160px 0px",
      },
    );

    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, nextCursor]);

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
      setHasMore(true);
      setSummary((current) => ({
        ...current,
        totalCount: current.totalCount + 1,
        analyzingCount: current.analyzingCount + 1,
      }));

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

  async function handleDelete(reportId: string) {
    setPendingDeleteId(reportId);
    setOpenMenuId(null);
    try {
      const response = await fetch(`/api/reports?id=${reportId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setUploadError(data.error ?? "删除失败，请稍后再试。");
        return;
      }

      setReports((current) => current.filter((report) => report.id !== reportId));
      setSummary((current) => ({
        ...current,
        totalCount: Math.max(0, current.totalCount - 1),
        analyzingCount:
          reportPendingDelete?.status === "analyzing"
            ? Math.max(0, current.analyzingCount - 1)
            : current.analyzingCount,
        succeededCount:
          reportPendingDelete?.status === "succeeded"
            ? Math.max(0, current.succeededCount - 1)
            : current.succeededCount,
        failedCount:
          reportPendingDelete?.status === "failed"
            ? Math.max(0, current.failedCount - 1)
            : current.failedCount,
      }));
    } finally {
      setPendingDeleteId(null);
    }
  }

  async function handleCopyReportId(reportId: string) {
    try {
      await navigator.clipboard.writeText(reportId);
    } catch {
      const input = document.createElement("input");
      input.value = reportId;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }

    setCopiedReportId(reportId);
    window.setTimeout(() => {
      setCopiedReportId((current) => (current === reportId ? null : current));
    }, 1600);
  }

  return (
    <main className="px-4 py-4 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <section aria-label="体检报告分析">
        <section className="relative overflow-hidden border-b border-stone-200/70 py-5 sm:py-6 lg:py-8">
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-r from-emerald-100/30 via-amber-50/35 to-orange-100/25 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-5">
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
                <div className="rounded-[1.2rem] bg-sky-50 px-4 py-4 text-sky-900">
                  <p className="text-xs tracking-[0.16em] text-sky-700 uppercase">
                    已上传
                  </p>
                  <p className="mt-2 text-3xl font-semibold">{summary.totalCount}</p>
                </div>
                <div className="rounded-[1.2rem] bg-amber-50 px-4 py-4 text-amber-900">
                  <p className="text-xs tracking-[0.16em] uppercase">分析中</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {summary.analyzingCount}
                  </p>
                </div>
                <div className="rounded-[1.2rem] bg-emerald-50 px-4 py-4 text-emerald-900">
                  <p className="text-xs tracking-[0.16em] uppercase">已完成</p>
                  <p className="mt-2 text-3xl font-semibold">
                    {summary.succeededCount}
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

        <section className="py-5 sm:py-6 lg:py-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="section-title">报告列表</p>
              {/* <h2 className="mt-2 text-3xl font-semibold text-stone-900">
                分析任务卡片
              </h2> */}
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
            <div className="mt-4 grid gap-3 md:grid-cols-2">
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
            <div className="mt-4 rounded-[1.6rem] border border-dashed border-stone-300 bg-white/55 px-6 py-10 text-center">
              <h3 className="text-xl font-semibold text-stone-900">还没有上传记录</h3>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                从上面的上传入口选择 PDF 体检报告，系统会自动创建一张分析任务卡片。
              </p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="mt-4 rounded-[1.6rem] border border-dashed border-stone-300 bg-white/55 px-6 py-10 text-center">
              <h3 className="text-xl font-semibold text-stone-900">没有符合筛选条件的报告</h3>
              <p className="mt-3 text-sm leading-7 text-stone-600">
                可以切换受检人或分析状态，查看其他报告任务。
              </p>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 lg:gap-4">
              {filteredReports.map((report) => {
                const status = statusMeta[report.status];

                return (
                  <article
                    key={report.id}
                    className="rounded-[1.25rem] border border-stone-200/70 bg-white/75 p-3 shadow-[0_14px_30px_rgba(102,84,58,0.06)] sm:rounded-[1.6rem] sm:p-5"
                  >
                    <div className="flex items-start justify-between gap-2 sm:gap-3">
                      <div className="flex min-w-0 flex-col gap-2 sm:flex-wrap sm:flex-row sm:items-center sm:gap-3">
                        <span
                          className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium sm:px-3 sm:text-sm ${status.className}`}
                        >
                          {status.label}
                        </span>
                        <span className="text-xs text-stone-500 sm:text-sm">
                          {formatDate(report.createdAt)}
                        </span>
                      </div>
                      {report.status !== "analyzing" ? (
                        <div className="relative" ref={openMenuId === report.id ? menuRef : null}>
                          <button
                            type="button"
                            aria-label="更多操作"
                            aria-expanded={openMenuId === report.id}
                            onClick={() => {
                              setOpenMenuId((current) =>
                                current === report.id ? null : report.id,
                              );
                            }}
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white/85 text-stone-500 transition hover:border-stone-300 hover:text-stone-900 sm:h-10 sm:w-10"
                          >
                            <span className="text-base leading-none sm:text-lg">...</span>
                          </button>
                          {openMenuId === report.id ? (
                            <div className="absolute top-12 right-0 z-10 min-w-36 rounded-[1.1rem] border border-stone-200/80 bg-white p-2 shadow-[0_18px_40px_rgba(41,37,36,0.12)]">
                              <button
                                type="button"
                                disabled={pendingDeleteId === report.id}
                                onClick={() => {
                                  setReportPendingDelete(report);
                                  setOpenMenuId(null);
                                }}
                                className="w-full rounded-[0.9rem] px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {pendingDeleteId === report.id ? "删除中..." : "删除报告"}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-stone-900 sm:mt-4 sm:text-xl">
                      {report.patientName || report.fileName}
                    </h3>
                    {getReportSummary(report) ? (
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-stone-600 sm:text-sm sm:leading-7">
                        {getReportSummary(report)}
                      </p>
                    ) : null}
                    <div className="mt-2 flex w-full items-center gap-2 rounded-[0.9rem] bg-stone-50/90 px-2.5 py-2 sm:px-3">
                      <span className="shrink-0 text-[10px] tracking-[0.14em] text-stone-500 uppercase sm:text-xs">
                        ID
                      </span>
                      <code className="min-w-0 flex-1 truncate text-[11px] text-stone-600 sm:text-xs">
                        {report.id}
                      </code>
                      <button
                        type="button"
                        onClick={() => {
                          void handleCopyReportId(report.id);
                        }}
                        className="shrink-0 rounded-full border border-stone-200 bg-white px-2 py-1 text-[10px] font-medium text-stone-600 transition hover:border-emerald-300 hover:text-emerald-700 sm:text-xs"
                      >
                        {copiedReportId === report.id ? "已复制" : "复制"}
                      </button>
                    </div>

                    {report.status === "succeeded" ? (
                      <dl className="mt-4 grid gap-2 sm:mt-5 sm:gap-3 sm:grid-cols-2">
                        <div className="rounded-[1rem] bg-stone-50/90 px-3 py-2.5 sm:rounded-[1.2rem] sm:px-4 sm:py-3">
                          <dt className="text-[10px] tracking-[0.14em] text-stone-500 uppercase sm:text-xs sm:tracking-[0.16em]">
                            模型
                          </dt>
                          <dd className="mt-1.5 truncate text-xs text-stone-700 sm:mt-2 sm:text-sm">
                            {report.analysisModel || "-"}
                          </dd>
                        </div>
                        <div className="rounded-[1rem] bg-stone-50/90 px-3 py-2.5 sm:rounded-[1.2rem] sm:px-4 sm:py-3">
                          <dt className="text-[10px] tracking-[0.14em] text-stone-500 uppercase sm:text-xs sm:tracking-[0.16em]">
                            风险
                          </dt>
                          <dd className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-stone-700 sm:mt-2 sm:text-sm">
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] font-medium sm:text-xs ${getRiskClass(report.overallRiskLevel)}`}
                            >
                              {report.overallRiskLevel || "-"}
                            </span>
                            <span>
                              {typeof report.riskScore === "number"
                                ? `${report.riskScore} 分`
                                : "-"}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    ) : null}

                    {report.status !== "failed" ? (
                      <dl className="mt-4 grid gap-2 sm:mt-5 sm:gap-3 sm:grid-cols-2">
                        <div className="rounded-[1rem] bg-stone-50/90 px-3 py-2.5 sm:rounded-[1.2rem] sm:px-4 sm:py-3">
                          <dt className="text-[10px] tracking-[0.14em] text-stone-500 uppercase sm:text-xs sm:tracking-[0.16em]">
                            原文件
                          </dt>
                          <dd className="mt-1.5 truncate text-xs text-stone-700 sm:mt-2 sm:line-clamp-2 sm:text-sm">
                            {report.fileName}
                          </dd>
                        </div>
                        <div className="rounded-[1rem] bg-stone-50/90 px-3 py-2.5 sm:rounded-[1.2rem] sm:px-4 sm:py-3">
                          <dt className="text-[10px] tracking-[0.14em] text-stone-500 uppercase sm:text-xs sm:tracking-[0.16em]">
                            大小
                          </dt>
                          <dd className="mt-1.5 text-xs text-stone-700 sm:mt-2 sm:text-sm">
                            {formatFileSize(report.fileSize)}
                          </dd>
                        </div>
                        <div className="rounded-[1rem] bg-stone-50/90 px-3 py-2.5 sm:rounded-[1.2rem] sm:px-4 sm:py-3">
                          <dt className="text-[10px] tracking-[0.14em] text-stone-500 uppercase sm:text-xs sm:tracking-[0.16em]">
                            体检日期
                          </dt>
                          <dd className="mt-1.5 line-clamp-2 text-xs text-stone-700 sm:mt-2 sm:text-sm">
                            {report.examDate || "待分析"}
                          </dd>
                        </div>
                        <div className="hidden rounded-[1rem] bg-stone-50/90 px-3 py-2.5 sm:block sm:rounded-[1.2rem] sm:px-4 sm:py-3">
                          <dt className="text-[10px] tracking-[0.14em] text-stone-500 uppercase sm:text-xs sm:tracking-[0.16em]">
                            机构
                          </dt>
                          <dd className="mt-1.5 line-clamp-2 text-xs text-stone-700 sm:mt-2 sm:text-sm">
                            {report.institution || "待分析"}
                          </dd>
                        </div>
                      </dl>
                    ) : null}

                    <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:flex-wrap sm:gap-3">
                      {report.status === "succeeded" ? (
                        <Link
                          href={`/reports?id=${report.id}`}
                          scroll
                          className="button-primary rounded-full px-3 py-2 text-center text-xs font-medium transition sm:px-4 sm:text-sm"
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
                          className="rounded-full bg-rose-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-rose-500 sm:px-4 sm:text-sm"
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

          {filteredReports.length > 0 && hasMore ? (
            <div ref={loadMoreRef} className="mt-5 flex justify-center">
              <button
                type="button"
                disabled={isLoadingMore}
                onClick={() => {
                  void loadMoreReports();
                }}
                className="rounded-full border border-stone-200/80 bg-white/80 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingMore ? "加载中..." : "加载更多报告"}
              </button>
            </div>
          ) : null}
        </section>
        </section>
      </div>

      {reportPendingDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/35 px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-stone-200/80 bg-[var(--panel-strong)] p-6 shadow-[0_24px_60px_rgba(28,25,23,0.22)]">
            <p className="section-title">删除确认</p>
            <h3 className="mt-3 text-2xl font-semibold text-stone-900">确认删除这份报告？</h3>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              删除后将移除
              <span className="font-medium text-stone-900">
                {reportPendingDelete.patientName || reportPendingDelete.fileName}
              </span>
              的原始 PDF 和分析结果，操作后无法恢复。
            </p>

            <div className="mt-6 rounded-[1.3rem] bg-stone-50/90 px-4 py-4 text-sm text-stone-700">
              <p className="font-medium text-stone-900">将被删除的内容</p>
              <p className="mt-2">文件名：{reportPendingDelete.fileName}</p>
              <p className="mt-1">上传时间：{formatDate(reportPendingDelete.createdAt)}</p>
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                disabled={pendingDeleteId === reportPendingDelete.id}
                onClick={() => {
                  setReportPendingDelete(null);
                }}
                className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                取消
              </button>
              <button
                type="button"
                disabled={pendingDeleteId === reportPendingDelete.id}
                onClick={() => {
                  void handleDelete(reportPendingDelete.id).then(() => {
                    setReportPendingDelete(null);
                  });
                }}
                className="rounded-full bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pendingDeleteId === reportPendingDelete.id ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
