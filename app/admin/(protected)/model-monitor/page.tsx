import { getModelMonitorItemsFromMemory } from "@/lib/ai/model-monitor-registry";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}

export default function AdminModelMonitorPage() {
  const items = getModelMonitorItemsFromMemory();

  return (
    <section className="space-y-4">
      <header>
        <p className="text-xs tracking-[0.16em] text-stone-500 uppercase">模型监控</p>
        <h1 className="mt-2 text-2xl font-semibold text-stone-950">模型连续失败统计</h1>
      </header>

      <div className="overflow-x-auto rounded-xl border border-stone-200/80 bg-white">
        <table className="min-w-[760px] divide-y divide-stone-200 text-sm">
          <thead className="bg-stone-50 text-left text-xs tracking-[0.08em] text-stone-500 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">模型</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">连续失败次数</th>
              <th className="px-4 py-3 font-medium">最近失败原因</th>
              <th className="px-4 py-3 font-medium">最近报告</th>
              <th className="px-4 py-3 font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((item) => (
              <tr key={item.id} className="align-top">
                <td className="px-4 py-3 font-medium text-stone-900">{item.model}</td>
                <td className="px-4 py-3 text-stone-700">{item.provider}</td>
                <td className="px-4 py-3 text-stone-700">{item.consecutiveFailures}</td>
                <td className="max-w-[360px] px-4 py-3 text-stone-700">
                  <span className="line-clamp-2">{item.lastError || "-"}</span>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-stone-600">
                  {item.lastReportId || "-"}
                </td>
                <td className="px-4 py-3 text-stone-700">{formatTime(item.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
