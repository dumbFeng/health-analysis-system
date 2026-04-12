"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { appNavTabs, type AppNavTab } from "@/lib/navigation/app-nav-tabs";

type AppTopNavProps = {
  currentUser: {
    username: string;
    avatarUrl?: string;
  };
};

function isTabActive(tab: AppNavTab, pathname: string) {
  return tab.activePathPrefixes.some((prefix) => {
    if (prefix === "/") {
      return pathname === "/";
    }

    return pathname === prefix || pathname.startsWith(`${prefix}/`);
  });
}

export function AppTopNav({ currentUser }: AppTopNavProps) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const pathname = usePathname();
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isUserMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isUserMenuOpen]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-stone-200/70 bg-[#fffaf3]/92 backdrop-blur-sm">
      <div className="w-full px-4 sm:px-5 lg:px-6">
        <div className="flex min-h-16 items-center gap-4">
          <Link href="/" className="min-w-0 shrink-0">
            <BrandMark compact iconClassName="h-9 w-9 rounded-[0.9rem]" />
          </Link>

          <div className="ml-auto flex items-center gap-4">
            <nav aria-label="主导航" className="flex items-center gap-1">
              {appNavTabs.map((tab) => {
                const active = isTabActive(tab, pathname);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative px-3 py-5 text-sm font-medium transition ${
                      active
                        ? "text-[var(--accent)] after:absolute after:right-3 after:bottom-0 after:left-3 after:h-0.5 after:rounded-full after:bg-[var(--accent)]"
                        : "text-stone-600 hover:text-stone-950"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
            <span className="h-6 w-px bg-stone-200/90" aria-hidden="true" />
          </div>

          <div className="relative shrink-0" ref={userMenuRef}>
            <button
              type="button"
              aria-label="用户菜单"
              aria-expanded={isUserMenuOpen}
              onClick={() => {
                setIsUserMenuOpen((current) => !current);
              }}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-stone-200/80 bg-white/70 text-sm font-semibold text-[var(--accent)] transition hover:border-emerald-700/20 hover:bg-white"
            >
              {currentUser.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentUser.avatarUrl}
                  alt={currentUser.username}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                currentUser.username.trim().slice(0, 1).toUpperCase() || "U"
              )}
            </button>

            {isUserMenuOpen ? (
              <div className="absolute top-11 right-0 z-[80] w-56 rounded-[1rem] border border-stone-200/80 bg-[#fffaf3] p-2 shadow-[0_18px_44px_rgba(41,37,36,0.10)]">
                <div className="rounded-[0.8rem] bg-stone-50/80 px-3 py-3">
                  <p className="text-xs tracking-[0.16em] text-stone-500 uppercase">
                    当前账号
                  </p>
                  <p className="mt-1 truncate text-sm font-semibold text-stone-900">
                    {currentUser.username}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleLogout();
                  }}
                  className="mt-2 w-full rounded-[1rem] px-3 py-2 text-left text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-950"
                >
                  退出登录
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
