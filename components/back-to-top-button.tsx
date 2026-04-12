"use client";

import { useEffect, useState } from "react";

const SHOW_THRESHOLD_PX = 240;

export function BackToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      setVisible(window.scrollY > SHOW_THRESHOLD_PX);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, []);

  function scrollToTop() {
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }

  return (
    <button
      type="button"
      aria-label="回到顶部"
      onClick={scrollToTop}
      className={`fixed right-4 bottom-6 z-40 rounded-full border border-emerald-800/15 bg-[#fffaf3]/95 px-3 py-2 text-xs font-semibold tracking-[0.08em] text-[var(--accent)] shadow-[0_14px_30px_rgba(73,54,34,0.15)] backdrop-blur-sm transition sm:right-6 sm:bottom-8 sm:text-sm ${
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      }`}
    >
      回到顶部
    </button>
  );
}
