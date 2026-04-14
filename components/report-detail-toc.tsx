"use client";

import { useEffect, useState } from "react";

type SectionLink = {
  id: string;
  label: string;
};

type ReportDetailTocProps = {
  sectionLinks: SectionLink[];
};

export function ReportDetailToc({ sectionLinks }: ReportDetailTocProps) {
  const [activeId, setActiveId] = useState(sectionLinks[0]?.id ?? "");
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  function handleNavigate(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();

    const section = document.getElementById(id);
    if (!section) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    section.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "start",
    });

    window.history.replaceState(null, "", `#${id}`);
    setActiveId(id);
    setIsMobileOpen(false);
  }

  useEffect(() => {
    if (sectionLinks.length === 0) {
      return;
    }

    const sections = sectionLinks
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => Boolean(section));

    if (sections.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visibleEntries.length > 0) {
          setActiveId(visibleEntries[0].target.id);
          return;
        }

        const nearestSection = sections
          .map((section) => ({
            id: section.id,
            offset: Math.abs(section.getBoundingClientRect().top - 120),
          }))
          .sort((a, b) => a.offset - b.offset)[0];

        if (nearestSection) {
          setActiveId(nearestSection.id);
        }
      },
      {
        root: null,
        rootMargin: "-96px 0px -55% 0px",
        threshold: [0.15, 0.35, 0.6],
      },
    );

    sections.forEach((section) => observer.observe(section));

    const syncFromHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash && sectionLinks.some((item) => item.id === hash)) {
        setActiveId(hash);
      }
    };

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);

    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", syncFromHash);
    };
  }, [sectionLinks]);

  function renderLinks(mode: "mobile" | "desktop") {
    return sectionLinks.map((item) => {
      const isActive = item.id === activeId;

      return (
        <a
          key={`${mode}-${item.id}`}
          href={`#${item.id}`}
          aria-current={isActive ? "location" : undefined}
          onClick={(event) => handleNavigate(event, item.id)}
          className={`transition ${
            mode === "mobile"
              ? `block rounded-[1rem] px-3 py-2.5 text-sm ${
                  isActive
                    ? "border border-emerald-700/20 bg-[rgba(13,122,95,0.12)] text-emerald-900 shadow-[0_10px_30px_rgba(13,122,95,0.10)]"
                    : "border border-transparent text-stone-700 hover:border-stone-200/80 hover:bg-white/70 hover:text-stone-900"
                }`
              : `rounded-[1.1rem] px-3 py-3 text-sm ${
                  isActive
                    ? "border border-emerald-700/20 bg-[rgba(13,122,95,0.12)] text-emerald-900 shadow-[0_10px_30px_rgba(13,122,95,0.10)]"
                    : "border border-transparent text-stone-700 hover:border-stone-200/80 hover:bg-white/70 hover:text-stone-900"
                }`
          }`}
        >
          {item.label}
        </a>
      );
    });
  }

  return (
    <>
      <div className="fixed right-4 bottom-5 z-40 xl:hidden">
        <div className="glass flex items-center gap-2 rounded-[1.4rem] p-2 shadow-[0_18px_40px_rgba(41,37,36,0.18)]">
          <button
            type="button"
            aria-expanded={isMobileOpen}
            aria-controls="report-detail-mobile-toc"
            onClick={() => {
              setIsMobileOpen((current) => !current);
            }}
            className="flex min-h-11 min-w-14 items-center justify-center rounded-[1rem] bg-[rgba(13,122,95,0.12)] px-3 text-xs font-medium tracking-[0.12em] text-emerald-900 uppercase"
          >
            目录
          </button>
          {isMobileOpen ? (
            <div
              id="report-detail-mobile-toc"
              className="max-h-[70vh] w-[220px] overflow-y-auto rounded-[1.2rem] border border-stone-200/80 bg-[var(--panel-strong)] p-2"
            >
              <p className="px-2 py-1 text-[11px] text-stone-500">文章导航</p>
              <nav className="mt-1 flex flex-col gap-1">{renderLinks("mobile")}</nav>
            </div>
          ) : null}
        </div>
      </div>

      <div className="hidden xl:block">
        <div className="glass sticky top-6 z-30 rounded-[1.8rem] p-4 shadow-[0_18px_48px_rgba(73,54,34,0.08)]">
          <p className="section-title">快捷导航</p>
          <nav className="mt-3 flex flex-col gap-1.5">{renderLinks("desktop")}</nav>
        </div>
      </div>
    </>
  );
}
