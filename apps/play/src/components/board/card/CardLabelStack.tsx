"use client";

/**
 * Card label / tag stack (module 298551 `U`). Chips use the original class
 * strings so the imported compiled CSS styles them exactly.
 */
export function CardLabelStack({
  labels,
  insetPx = 1,
  className,
}: {
  labels: string[];
  insetPx?: number;
  className?: string;
}) {
  if (labels.length === 0) return null;
  return (
    <div
      data-card-label-stack="true"
      className={
        "pointer-events-none absolute isolate overflow-visible flex flex-col items-start gap-(--card-label-stack-gap)" +
        (className ? ` ${className}` : "")
      }
      style={{
        left: `calc(${insetPx}px + var(--card-label-stack-left))`,
        top: `calc(${insetPx}px + var(--card-label-stack-top, 1.48rem))`,
        maxWidth: `calc(100% - ${2 * insetPx}px - var(--card-label-stack-width-offset))`,
      }}
    >
      {labels.map((label, index) => {
        const match = /^(.*?)(?:\s+(\d+))?$/u.exec(label.trim());
        const name = (match?.[1] ?? label).trim();
        const count = match?.[2] ? Number(match[2]) : null;
        return (
          <div
            key={`card-label-chip-${index}`}
            className="card-tag-row relative flex max-w-full items-center leading-none"
            data-card-label-chip
          >
            <span
              aria-label={count === null ? name : `${name} ${count}`}
              className="pointer-events-none select-none inline-flex h-[var(--card-label-chip-fit-height,var(--card-label-chip-height))] max-w-full items-center overflow-hidden rounded-(--card-label-chip-radius) border border-[rgba(176,210,234,0.65)] bg-[rgba(20,28,41,0.92)] px-(--card-label-chip-pad-x) text-(length:--card-label-chip-font-size) font-bold leading-none tracking-[0.035em] text-[#edf2fb] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_3px_8px_rgba(0,0,0,0.4)]"
            >
              <span className="truncate uppercase">{name}</span>
              {count !== null ? (
                <span className="ml-1 inline-flex min-w-[1.05em] justify-center rounded-[0.15rem] bg-white/20 px-[0.2em] font-black tabular-nums">
                  {count}
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}
