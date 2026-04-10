"use client";

import { useEffect, useRef, useState } from "react";

type SectionLink = {
  id: string;
  label: string;
};

type ReportDetailTocProps = {
  sectionLinks: SectionLink[];
};

export function ReportDetailToc({ sectionLinks }: ReportDetailTocProps) {
  const [activeId, setActiveId] = useState(sectionLinks[0]?.id ?? "");
  const itemRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

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

  useEffect(() => {
    const activeItem = itemRefs.current[activeId];
    if (!activeItem) {
      return;
    }

    activeItem.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: "smooth",
    });
  }, [activeId]);

  return (
    <div className="glass sticky top-3 z-30 rounded-[1.5rem] p-3 sm:top-4 sm:rounded-[1.7rem] sm:p-4 xl:top-6 xl:rounded-[2rem] xl:p-5">
      <div className="flex items-center justify-between gap-3 xl:block">
        <p className="section-title shrink-0">快捷导航</p>
        <p className="text-[11px] text-stone-500 xl:hidden">左右滑动查看全部模块</p>
      </div>
      <nav className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1 xl:mx-0 xl:mt-4 xl:flex-col xl:overflow-visible xl:px-0 xl:pb-0">
        {sectionLinks.map((item) => {
          const isActive = item.id === activeId;

          return (
            <a
              key={item.id}
              ref={(node) => {
                itemRefs.current[item.id] = node;
              }}
              href={`#${item.id}`}
              aria-current={isActive ? "location" : undefined}
              onClick={(event) => handleNavigate(event, item.id)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-xs transition sm:text-sm xl:rounded-[1.1rem] xl:px-3 xl:py-3 ${
                isActive
                  ? "border border-emerald-700/20 bg-[rgba(13,122,95,0.12)] text-emerald-900 shadow-[0_10px_30px_rgba(13,122,95,0.10)]"
                  : "border border-transparent text-stone-700 hover:border-stone-200/80 hover:bg-white/70 hover:text-stone-900"
              }`}
            >
              {item.label}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
