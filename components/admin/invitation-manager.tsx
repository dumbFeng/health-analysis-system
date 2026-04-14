"use client";

import { useState } from "react";

type InvitationItem = {
  id: string | null;
  code: string;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  expiresAt: string | null;
  createdAt: string | null;
  status: "valid" | "expired" | "exhausted" | "not_found";
  usable: boolean;
  inviteLink: string;
};

type InvitationManagerProps = {
  initialInvitations: InvitationItem[];
};

function formatTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(item: InvitationItem) {
  if (item.status === "expired") {
    return "已过期";
  }

  if (item.status === "exhausted") {
    return "已用尽";
  }

  return "可用中";
}

function statusClassName(item: InvitationItem) {
  if (item.status === "expired") {
    return "bg-stone-200/80 text-stone-700";
  }

  if (item.status === "exhausted") {
    return "bg-amber-100 text-[var(--warn)]";
  }

  return "bg-[var(--accent-soft)] text-[var(--accent)]";
}

export function InvitationManager({
  initialInvitations,
}: InvitationManagerProps) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [maxUses, setMaxUses] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function copyText(value: string, successMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(successMessage);
    } catch {
      setMessage("复制失败，请稍后重试。");
    }
  }

  async function handleCreate() {
    const normalizedMaxUses = Number(maxUses);
    const normalizedExpiresInDays = Number(expiresInDays);
    if (!Number.isFinite(normalizedMaxUses) || normalizedMaxUses <= 0) {
      setMessage("请输入大于 0 的可用次数。");
      return;
    }

    if (!Number.isFinite(normalizedExpiresInDays) || normalizedExpiresInDays <= 0) {
      setMessage("请输入大于 0 的有效期天数。");
      return;
    }

    setIsSubmitting(true);
    setMessage("");

    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxUses: normalizedMaxUses,
          expiresInDays: normalizedExpiresInDays,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        invitation?: InvitationItem;
      };
      if (!response.ok || !data.invitation) {
        setMessage(data.error || "邀请码生成失败。");
        return;
      }

      setInvitations((current) => [data.invitation!, ...current].slice(0, 50));
      setMessage(`邀请码 ${data.invitation.code} 已生成`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] px-5 py-5 shadow-[0_16px_36px_rgba(73,54,34,0.08)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">邀请码生成</p>
            <h1 className="mt-2 text-2xl font-semibold text-stone-950">邀请成员进入系统</h1>
            <p className="mt-2 text-sm leading-7 text-stone-600">
              新用户首次通过邮箱登录时，需要输入有效邀请码。邀请码会按剩余次数与过期时间实时校验。
            </p>
          </div>

          <div className="grid w-full max-w-xl gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-700">可用次数</span>
              <input
                value={maxUses}
                onChange={(event) => setMaxUses(event.target.value)}
                inputMode="numeric"
                placeholder="例如 10"
                className="w-full rounded-lg border border-stone-200/80 bg-white/90 px-3 py-3 text-sm text-stone-950 outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-stone-700">有效期（天）</span>
              <input
                value={expiresInDays}
                onChange={(event) => setExpiresInDays(event.target.value)}
                inputMode="numeric"
                placeholder="例如 7"
                className="w-full rounded-lg border border-stone-200/80 bg-white/90 px-3 py-3 text-sm text-stone-950 outline-none focus:border-[var(--accent)]"
              />
            </label>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                void handleCreate();
              }}
              className="button-primary rounded-lg px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "生成中..." : "生成邀请码"}
            </button>
          </div>
        </div>

        {message ? (
          <p className="mt-4 text-sm text-stone-700">{message}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-[var(--line)] bg-[var(--panel)] shadow-[0_16px_36px_rgba(73,54,34,0.08)]">
        <div className="border-b border-[var(--line)] px-5 py-4">
          <p className="text-xs tracking-[0.18em] text-stone-500 uppercase">最近生成</p>
          <h2 className="mt-2 text-xl font-semibold text-stone-950">邀请码列表</h2>
        </div>

        <div className="divide-y divide-[var(--line)]">
          {invitations.length === 0 ? (
            <div className="px-5 py-6 text-sm text-stone-500">还没有生成邀请码。</div>
          ) : (
            invitations.map((item) => (
              <div key={item.code} className="px-5 py-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-stone-900 px-2.5 py-1 text-sm font-semibold tracking-[0.14em] text-white">
                        {item.code}
                      </span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClassName(item)}`}>
                        {statusLabel(item)}
                      </span>
                    </div>
                    <p className="mt-3 text-sm text-stone-600">
                      已使用 {item.usedCount} / {item.maxUses}，剩余 {item.remainingUses}
                    </p>
                    <p className="mt-1 text-sm text-stone-600">过期时间：{formatTime(item.expiresAt)}</p>
                    <p className="mt-1 break-all text-sm text-stone-500">{item.inviteLink}</p>
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void copyText(item.code, `邀请码 ${item.code} 已复制`);
                      }}
                      className="rounded-lg border border-stone-200/80 bg-white/88 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      复制邀请码
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void copyText(item.inviteLink, "邀请链接已复制");
                      }}
                      className="rounded-lg border border-stone-200/80 bg-white/88 px-3 py-2 text-sm font-medium text-stone-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                    >
                      复制链接
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
