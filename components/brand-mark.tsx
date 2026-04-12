type BrandMarkProps = {
  compact?: boolean;
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  taglineClassName?: string;
};

export function BrandMark({
  compact = false,
  className = "",
  iconClassName = "",
  textClassName = "",
  taglineClassName = "",
}: BrandMarkProps) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-3 ${className}`}>
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[1rem] border border-emerald-800/10 bg-[#f7efe1] shadow-[0_10px_24px_rgba(13,122,95,0.12)] ${iconClassName}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="知几 CareYou 图标" className="h-full w-full object-cover" />
      </span>
      <span className="min-w-0">
        <span
          className={`block truncate text-base font-semibold tracking-tight text-stone-950 ${textClassName}`}
        >
          知几
          <span className="ml-2 text-[0.72em] font-medium tracking-[0.18em] text-[var(--accent)] uppercase">
            CareYou
          </span>
        </span>
        {!compact ? (
          <span
            className={`mt-0.5 block truncate text-xs tracking-[0.16em] text-stone-500 uppercase ${taglineClassName}`}
          >
            AI Health Insight
          </span>
        ) : null}
      </span>
    </span>
  );
}
