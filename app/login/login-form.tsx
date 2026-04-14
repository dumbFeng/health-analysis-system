"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";

const rememberedEmailKey = "careyou:login-email-history";

type InviteStatus = {
  usable: boolean;
  status: "valid" | "expired" | "exhausted" | "not_found";
  usedCount: number;
  maxUses: number;
  remainingUses: number;
  expiresAt: string | null;
};

export function LoginForm({
  nextPath,
  initialMessage,
  initialInviteCode,
  mode = "default",
}: {
  nextPath: string;
  initialMessage?: string;
  initialInviteCode?: string;
  mode?: "default" | "admin";
}) {
  const isAdminMode = mode === "admin";
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [inviteCode, setInviteCode] = useState(initialInviteCode || "");
  const [hasRequestedCode, setHasRequestedCode] = useState(false);
  const [devCode, setDevCode] = useState("");
  const [message, setMessage] = useState(initialMessage || "");
  const [emailError, setEmailError] = useState("");
  const [codeError, setCodeError] = useState("");
  const [rememberedEmails, setRememberedEmails] = useState<string[]>([]);
  const [isEmailHistoryOpen, setIsEmailHistoryOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isInviteSubmitting, setIsInviteSubmitting] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [inviteStatus, setInviteStatus] = useState<InviteStatus | null>(null);
  const [isInviteChecking, setIsInviteChecking] = useState(false);
  const [pendingSignupToken, setPendingSignupToken] = useState("");
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    const parsed = JSON.parse(
      window.localStorage.getItem(rememberedEmailKey) || "[]",
    ) as unknown;
    if (Array.isArray(parsed)) {
      setRememberedEmails(
        parsed.filter((item): item is string => typeof item === "string").slice(0, 5),
      );
      return;
    }

    const legacyEmail = window.localStorage.getItem("careyou:last-login-email");
    if (legacyEmail) {
      setRememberedEmails([legacyEmail]);
      window.localStorage.setItem(rememberedEmailKey, JSON.stringify([legacyEmail]));
      window.localStorage.removeItem("careyou:last-login-email");
    }
  }, []);

  useEffect(() => {
    if (resendCountdown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setResendCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  useEffect(() => {
    const normalized = inviteCode.trim().toUpperCase();
    if (isAdminMode || !isInviteModalOpen || !normalized) {
      setInviteStatus(null);
      setIsInviteChecking(false);
      return;
    }

    setIsInviteChecking(true);
    const timer = window.setTimeout(() => {
      void fetch(`/api/auth/invite-code/status?code=${encodeURIComponent(normalized)}`)
        .then((response) => response.json())
        .then((data: { inviteCode?: InviteStatus }) => {
          setInviteStatus(data.inviteCode || null);
        })
        .catch(() => {
          setInviteStatus(null);
        })
        .finally(() => {
          setIsInviteChecking(false);
        });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [inviteCode, isAdminMode, isInviteModalOpen]);

  function validateEmailInput() {
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setEmailError("请输入邮箱地址");
      return "";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setEmailError("请输入有效邮箱地址");
      return "";
    }

    setEmailError("");
    return normalized;
  }

  function validateCodeInput() {
    const normalized = code.trim();
    if (!normalized) {
      setCodeError("请输入验证码。");
      return "";
    }

    if (!/^\d{6}$/.test(normalized)) {
      setCodeError("请输入 6 位数字验证码。");
      return "";
    }

    setCodeError("");
    return normalized;
  }

  function isEmailErrorMessage(value: string) {
    return value.includes("邮箱") || value.includes("管理员");
  }

  function isCodeErrorMessage(value: string) {
    return value.includes("验证码");
  }

  function getInviteStatusText() {
    if (!inviteCode.trim()) {
      return "这是一个新账号，请输入邀请码完成注册。";
    }

    if (isInviteChecking) {
      return "正在校验邀请码...";
    }

    if (!inviteStatus) {
      return "邀请码状态暂时无法获取，请稍后重试。";
    }

    if (inviteStatus.status === "valid") {
      return `邀请码可用，还可使用 ${inviteStatus.remainingUses} 次，过期时间 ${new Intl.DateTimeFormat(
        "zh-CN",
        {
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        },
      ).format(new Date(inviteStatus.expiresAt || Date.now()))}`;
    }

    if (inviteStatus.status === "expired") {
      return "邀请码已过期，请联系管理员获取新的邀请链接。";
    }

    if (inviteStatus.status === "exhausted") {
      return "邀请码可用次数已耗尽，请联系管理员重新生成。";
    }

    return "邀请码无效，请检查后重试。";
  }

  function getInviteStatusClassName() {
    if (!inviteCode.trim()) {
      return "text-stone-500";
    }

    if (isInviteChecking) {
      return "text-stone-500";
    }

    if (inviteStatus?.usable) {
      return "text-[var(--accent)]";
    }

    return "text-[var(--warn)]";
  }

  function rememberEmail(value: string) {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    const nextEmails = [
      normalized,
      ...rememberedEmails.filter((item) => item !== normalized),
    ].slice(0, 5);
    setRememberedEmails(nextEmails);
    window.localStorage.setItem(rememberedEmailKey, JSON.stringify(nextEmails));
  }

  function selectRememberedEmail(value: string) {
    setEmail(value);
    setEmailError("");
    setCodeError("");
    setMessage("");
    setHasRequestedCode(false);
    setResendCountdown(0);
    setIsEmailHistoryOpen(false);
  }

  function closeInviteModal() {
    setIsInviteModalOpen(false);
    setPendingSignupToken("");
    setInviteError("");
    setInviteStatus(null);
  }

  function finishLogin() {
    closeInviteModal();
    router.replace(nextPath);
  }

  async function requestEmailCode() {
    const normalizedEmail = validateEmailInput();
    if (!normalizedEmail) {
      return;
    }

    setIsBusy(true);
    setMessage("");
    setCodeError("");
    try {
      const response = await fetch("/api/auth/email/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = (await response.json()) as { error?: string; devCode?: string };
      if (!response.ok) {
        const error = data.error || "验证码发送失败。";
        if (isEmailErrorMessage(error)) {
          setEmailError(error);
        } else if (isCodeErrorMessage(error)) {
          setCodeError(error);
        } else {
          setMessage(error);
        }
        return;
      }

      rememberEmail(normalizedEmail);
      setDevCode(data.devCode || "");
      setHasRequestedCode(true);
      setResendCountdown(60);
      setMessage(data.devCode ? `开发环境验证码：${data.devCode}` : "验证码已发送，请查看邮箱。");
    } finally {
      setIsBusy(false);
    }
  }

  async function loginWithEmail() {
    const normalizedEmail = validateEmailInput();
    if (!normalizedEmail) {
      return;
    }
    const normalizedCode = validateCodeInput();
    if (!normalizedCode) {
      return;
    }

    setIsBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/email/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: normalizedEmail,
          code: normalizedCode,
          inviteCode: isAdminMode ? "" : inviteCode.trim().toUpperCase(),
          adminLogin: isAdminMode,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        requiresInvite?: boolean;
        pendingSignupToken?: string;
        inviteError?: string;
      };
      if (!response.ok) {
        const error = data.error || "登录失败。";
        if (isEmailErrorMessage(error)) {
          setEmailError(error);
        } else if (isCodeErrorMessage(error)) {
          setCodeError(error);
        } else {
          setMessage(error);
        }
        return;
      }

      if (data.requiresInvite && data.pendingSignupToken) {
        rememberEmail(normalizedEmail);
        setPendingSignupToken(data.pendingSignupToken);
        setInviteError(data.inviteError || "");
        setInviteStatus(null);
        setIsInviteModalOpen(true);
        return;
      }

      rememberEmail(normalizedEmail);
      finishLogin();
    } finally {
      setIsBusy(false);
    }
  }

  async function completeSignupWithInvite() {
    const normalizedInviteCode = inviteCode.trim().toUpperCase();
    if (!normalizedInviteCode) {
      setInviteError("请输入邀请码。");
      return;
    }

    setIsInviteSubmitting(true);
    setInviteError("");
    try {
      const response = await fetch("/api/auth/email/complete-signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingSignupToken,
          inviteCode: normalizedInviteCode,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setInviteError(data.error || "邀请码校验失败。");
        return;
      }

      finishLogin();
    } finally {
      setIsInviteSubmitting(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-32 -left-28 h-80 w-80 rounded-full bg-emerald-200/32 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-24 h-96 w-96 rounded-full bg-amber-200/36 blur-3xl" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#f0e9dc]/70 to-transparent" />

      <section className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(430px,0.82fr)]">
        <aside className="relative hidden overflow-hidden border-r border-stone-200/60 bg-white/18 px-10 py-10 lg:flex">
          <div className="absolute -top-28 -left-28 h-96 w-96 rounded-full bg-emerald-200/34 blur-3xl" />
          <div className="absolute right-4 bottom-24 h-80 w-80 rounded-full bg-[#f4c879]/28 blur-3xl" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_26%,rgba(255,255,255,0.56),transparent_30%),linear-gradient(135deg,rgba(255,250,243,0.58),rgba(255,250,243,0.16)_50%,transparent)]" />
          <div className="relative mx-auto flex w-full max-w-2xl flex-col text-stone-900">
            <div className="relative">
              <BrandMark
                compact
                iconClassName="h-11 w-11 rounded-[1rem]"
                textClassName="text-xl"
              />
            </div>

            <div className="relative mt-auto max-w-xl pb-20">
              <p className="text-sm tracking-[0.24em] text-[var(--accent)] uppercase">
                AI Health Insight
              </p>
              <h1 className="mt-5 text-5xl leading-[1.08] font-semibold tracking-tight text-stone-950">
                让体检报告，
                <span className="block text-[var(--accent)]">成为可行动的健康判断。</span>
              </h1>
              <p className="mt-6 max-w-md text-base leading-8 text-stone-600">
                知几 CareYou 帮你把复杂指标整理成清晰的风险分层、异常提示与就诊建议。
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 lg:px-12">
          <section className="w-full max-w-[26.5rem]">
            <div className="mb-8 flex justify-center lg:hidden">
              <BrandMark
                iconClassName="h-12 w-12 rounded-[1.1rem]"
                textClassName="text-xl"
                taglineClassName="text-[0.65rem]"
              />
            </div>

            <div className="px-0 py-0 sm:px-2">
              <div className="mt-0 text-center">
                <h2 className="text-3xl font-semibold tracking-tight text-stone-950">
                  {isAdminMode ? "管理员登录" : "欢迎回来"}
                </h2>
              </div>

              <div className="mt-7 space-y-4">
                <label className="relative block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">
                    邮箱地址
                  </span>
                  <input
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailError("");
                      setCodeError("");
                      setMessage("");
                      setHasRequestedCode(false);
                      setResendCountdown(0);
                      setIsEmailHistoryOpen(true);
                    }}
                    onFocus={() => setIsEmailHistoryOpen(true)}
                    onBlur={() => {
                      window.setTimeout(() => setIsEmailHistoryOpen(false), 120);
                    }}
                    placeholder="name@example.com"
                    type="email"
                    autoComplete="off"
                    aria-invalid={Boolean(emailError)}
                    aria-describedby={emailError ? "login-email-error" : undefined}
                    className={`w-full rounded-2xl border bg-white/82 px-4 py-3.5 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:bg-white focus:ring-4 ${
                      emailError
                        ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10"
                        : "border-stone-200/80 focus:border-emerald-700 focus:ring-emerald-700/10"
                    }`}
                  />
                  {emailError ? (
                    <p id="login-email-error" className="mt-2 text-sm leading-6 text-rose-600">
                      {emailError}
                    </p>
                  ) : null}
                  {isEmailHistoryOpen && rememberedEmails.length > 0 ? (
                    <div className="absolute top-[5.05rem] right-0 left-0 z-20 overflow-hidden rounded-2xl border border-stone-200/80 bg-[#fffaf3]/96 p-1.5 shadow-[0_18px_44px_rgba(73,54,34,0.12)] backdrop-blur-xl">
                      {rememberedEmails.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectRememberedEmail(item)}
                          className="block w-full truncate rounded-xl px-3 py-2.5 text-left text-sm text-stone-700 transition hover:bg-emerald-50/80 hover:text-emerald-800"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-stone-700">
                    验证码
                  </span>
                  <div className="flex gap-2">
                    <input
                      value={code}
                      onChange={(event) => {
                        setCode(event.target.value);
                        setCodeError("");
                        setMessage("");
                      }}
                      placeholder="输入 6 位验证码"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      aria-invalid={Boolean(codeError)}
                      aria-describedby={codeError ? "login-code-error" : undefined}
                      className={`min-w-0 flex-1 rounded-2xl border bg-white/82 px-4 py-3.5 text-base text-stone-950 outline-none transition placeholder:text-stone-400 focus:bg-white focus:ring-4 ${
                        codeError
                          ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10"
                          : "border-stone-200/80 focus:border-emerald-700 focus:ring-emerald-700/10"
                      }`}
                    />
                    <button
                      type="button"
                      disabled={isBusy || resendCountdown > 0}
                      onClick={() => {
                        void requestEmailCode();
                      }}
                      className="shrink-0 rounded-2xl border border-stone-200/80 bg-white/72 px-4 py-3.5 text-sm font-semibold text-stone-800 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-white hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isBusy
                        ? "发送中"
                        : resendCountdown > 0
                          ? `${resendCountdown}s`
                          : hasRequestedCode
                            ? "重发"
                            : "获取验证码"}
                    </button>
                  </div>
                  {codeError ? (
                    <p id="login-code-error" className="mt-2 text-sm leading-6 text-rose-600">
                      {codeError}
                    </p>
                  ) : null}
                </label>

                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => {
                    void loginWithEmail();
                  }}
                  className="button-primary w-full rounded-2xl px-5 py-3.5 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBusy ? "正在登录..." : "登录"}
                </button>
              </div>

              {isAdminMode ? null : (
                <>
                  <div className="my-6 flex items-center gap-3">
                    <span className="h-px flex-1 bg-stone-200/80" />
                    <span className="text-xs text-stone-400">或</span>
                    <span className="h-px flex-1 bg-stone-200/80" />
                  </div>

                  <div className="group relative">
                    <span className="pointer-events-none absolute -top-11 left-1/2 z-10 -translate-x-1/2 rounded-xl bg-stone-900 px-3 py-2 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-[0_10px_30px_rgba(28,25,23,0.18)] transition-opacity duration-75 group-hover:opacity-100">
                      紧锣密鼓开发中，敬请期待～
                    </span>
                    <button
                      type="button"
                      disabled
                      aria-label="微信登录开发中，紧锣密鼓开发中，敬请期待"
                      className="flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-stone-200/80 bg-stone-100 px-5 py-3.5 text-sm font-semibold text-stone-400 opacity-90"
                    >
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#89c985] text-xs text-white">
                        微
                      </span>
                      使用微信继续
                    </button>
                  </div>
                </>
              )}

              {message ? (
                <p className="mt-5 rounded-2xl bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-800">
                  {message}
                </p>
              ) : null}

              {devCode && hasRequestedCode ? (
                <button
                  type="button"
                  onClick={() => setCode(devCode)}
                  className="mt-3 w-full text-sm font-medium text-emerald-700 transition hover:text-emerald-800"
                >
                  填入开发验证码
                </button>
              ) : null}

              <p className="mt-7 text-center text-xs leading-6 text-stone-400">
                {isAdminMode ? "仅支持管理员邮箱登录后台" : "首次登录会自动注册账号"}
              </p>
            </div>
          </section>
        </div>
      </section>

      {isAdminMode || !isInviteModalOpen ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/28 px-4">
          <div className="w-full max-w-md rounded-2xl border border-stone-200/80 bg-[#fffaf3] p-5 shadow-[0_26px_80px_rgba(41,37,36,0.18)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs tracking-[0.16em] text-[var(--accent)] uppercase">完成注册</p>
                <h3 className="mt-2 text-2xl font-semibold text-stone-950">请输入邀请码</h3>
                <p className="mt-2 text-sm leading-7 text-stone-600">
                  新账号需要邀请码完成注册。邀请码会在提交前实时校验剩余次数和过期时间。
                </p>
              </div>
              <button
                type="button"
                onClick={closeInviteModal}
                className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                aria-label="关闭邀请码弹窗"
              >
                ×
              </button>
            </div>

            <div className="mt-5">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-stone-700">邀请码</span>
                <input
                  value={inviteCode}
                  onChange={(event) => {
                    setInviteCode(event.target.value.toUpperCase());
                    setInviteError("");
                  }}
                  placeholder="输入邀请码"
                  autoComplete="off"
                  className="w-full rounded-2xl border border-stone-200/80 bg-white/92 px-4 py-3.5 text-base tracking-[0.12em] text-stone-950 uppercase outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-stone-400 focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
                />
                <p className={`mt-2 text-sm leading-6 ${getInviteStatusClassName()}`}>
                  {getInviteStatusText()}
                </p>
                {inviteError ? (
                  <p className="mt-2 text-sm leading-6 text-rose-600">{inviteError}</p>
                ) : null}
              </label>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={closeInviteModal}
                className="flex-1 rounded-2xl border border-stone-200/80 bg-white px-4 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
              >
                稍后再说
              </button>
              <button
                type="button"
                disabled={isInviteSubmitting}
                onClick={() => {
                  void completeSignupWithInvite();
                }}
                className="button-primary flex-1 rounded-2xl px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isInviteSubmitting ? "提交中..." : "完成注册"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
