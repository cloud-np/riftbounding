"use client";

import type { CardSide } from "../card/types";

function ResourceGlyph({ kind }: { kind: "energy" | "power" }) {
  return (
    <span
      aria-hidden="true"
      className="relative inline-grid h-5 w-5 place-items-center"
      data-resource-glyph={kind}
    >
      <span
        className={
          kind === "energy"
            ? "block h-[0.72rem] w-[0.72rem] rotate-45 rounded-[0.1rem] border border-[rgba(186,220,255,0.72)] bg-[linear-gradient(145deg,rgba(95,190,255,0.95),rgba(31,92,158,0.95))] shadow-[0_0_8px_rgba(88,182,255,0.6)]"
            : "block h-[0.72rem] w-[0.72rem] rounded-full border border-[rgba(255,218,190,0.72)] bg-[linear-gradient(145deg,rgba(255,187,110,0.95),rgba(171,88,40,0.95))] shadow-[0_0_8px_rgba(255,171,88,0.5)]"
        }
      />
    </span>
  );
}

const VALUE_ROW_CLASS =
  "inline-grid w-max grid-cols-[1.25rem_max-content_minmax(0.9rem,max-content)_1.25rem] items-center gap-x-[0.24rem] gap-y-[0.07rem]";

export function FloatingResources({
  owner,
  energy,
  power,
  interactive = false,
}: {
  owner: CardSide;
  energy: number;
  power: number;
  interactive?: boolean;
}) {
  return (
    <div
      data-player-area="resources"
      data-player-layer-owner={owner}
      className={
        "pointer-events-none col-start-2 row-start-1 grid py-[0.08rem] text-(length:--board-floating-value-size) leading-none [font-variant-numeric:tabular-nums]" +
        (owner === "opponent" ? " rotate-180 origin-center" : "")
      }
    >
      <div data-resources-content="true" className="grid w-max gap-[0.07rem]">
        <span className="text-(length:--board-floating-label-size) font-semibold uppercase tracking-[0.06em] text-[#a4bbd9]">
          Floating
        </span>
        <div className={VALUE_ROW_CLASS}>
          <ResourceGlyph kind="energy" />
          <span className="whitespace-nowrap transition-transform duration-180 ease-[cubic-bezier(0.2,0.7,0.2,1)] origin-left text-[#c6d4e2] scale-100">
            Energy
          </span>
          <span className="min-w-[0.9rem] text-right text-[0.78rem] font-semibold transition-transform duration-180 ease-[cubic-bezier(0.2,0.7,0.2,1)] origin-left text-[#c6d4e2] scale-100">
            {energy}
          </span>
          <span className="h-5 w-5 justify-self-center" aria-hidden="true">
            {interactive ? (
              <span className="grid h-full w-full place-items-center rounded-[0.2rem] border border-[rgba(174,199,227,0.24)] bg-[rgba(14,27,47,0.7)] text-[0.7rem] leading-none text-[#d9e8ff]">
                +
              </span>
            ) : null}
          </span>
          <ResourceGlyph kind="power" />
          <span className="whitespace-nowrap transition-transform duration-180 ease-[cubic-bezier(0.2,0.7,0.2,1)] origin-left text-[#bdc8d8] scale-100">
            Power
          </span>
          <span className="min-w-[0.9rem] text-right text-[0.78rem] font-semibold transition-transform duration-180 ease-[cubic-bezier(0.2,0.7,0.2,1)] origin-left text-[#bdc8d8] scale-100">
            {power}
          </span>
          <span className="h-5 w-5 justify-self-center" aria-hidden="true">
            {interactive ? (
              <span className="grid h-full w-full place-items-center rounded-[0.2rem] border border-[rgba(174,199,227,0.24)] bg-[rgba(14,27,47,0.7)] text-[0.7rem] leading-none text-[#d9e8ff]">
                +
              </span>
            ) : null}
          </span>
        </div>
      </div>
    </div>
  );
}
