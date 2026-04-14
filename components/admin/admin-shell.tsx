"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import type { AdminNavItem } from "@/lib/navigation/admin-nav-items";

type AdminShellProps = {
  currentUser: {
    username: string;
    email: string;
  };
  navItems: AdminNavItem[];
  children: React.ReactNode;
};

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ currentUser, navItems, children }: AdminShellProps) {
  const pathname = usePathname();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    // 通过绑定 unload 处理器禁用 bfcache，避免从 admin 回退后首页交互偶发失效。
    const disableBfcache = () => {};
    window.addEventListener("unload", disableBfcache);
    return () => window.removeEventListener("unload", disableBfcache);
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/admin/login";
    }
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="border-b border-[var(--line)] bg-[#fff8ef]/86 backdrop-blur-sm lg:border-r lg:border-b-0">
          <div className="flex flex-col px-5 py-4 lg:sticky lg:top-0 lg:min-h-screen lg:py-6">
            <Link href="/" className="inline-flex">
              <BrandMark compact iconClassName="h-10 w-10 rounded-[0.9rem]" textClassName="text-lg" />
            </Link>

            <div className="mt-6 lg:mt-8">
              <p className="text-xs tracking-[0.16em] text-stone-500 uppercase">管理后台</p>
              <nav className="mt-4 grid gap-1 sm:grid-cols-2 lg:grid-cols-1">
                {navItems.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-lg px-3 py-3 transition ${
                        active
                          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
                          : "text-stone-700 hover:bg-white/70 hover:text-stone-950"
                      }`}
                    >
                      <p className="text-sm font-semibold">{item.label}</p>
                      <p className="mt-1 text-xs text-stone-500">{item.description}</p>
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="mt-4 rounded-lg border border-[var(--line)] bg-white/72 px-4 py-4 lg:mt-auto">
              <p className="text-xs tracking-[0.14em] text-stone-500 uppercase">当前管理员</p>
              <p className="mt-2 break-all text-sm font-semibold leading-6 text-stone-900">
                {currentUser.username}
              </p>
              <p className="mt-1 text-xs text-stone-500">{currentUser.email}</p>
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={() => {
                  void handleLogout();
                }}
                className="mt-4 w-full rounded-lg border border-stone-200/80 bg-white px-3 py-2 text-left text-sm font-medium text-stone-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoggingOut ? "退出中..." : "退出登录"}
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
