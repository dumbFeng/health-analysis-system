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

  return (
    <div className="glass rounded-[2rem] p-5">
      <p className="section-title">快捷导航</p>
      <nav className="mt-4 flex flex-col gap-2">
        {sectionLinks.map((item) => {
          const isActive = item.id === activeId;

          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={isActive ? "location" : undefined}
              onClick={(event) => handleNavigate(event, item.id)}
              className={`rounded-[1.1rem] px-3 py-3 text-sm transition ${
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
