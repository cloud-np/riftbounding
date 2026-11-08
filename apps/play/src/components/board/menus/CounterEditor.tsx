"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { createTranslator } from "@rift/i18n";

import type { CardInstance } from "@rift/protocol";

const t = createTranslator("en");

export interface CounterEditorProps {
  card: CardInstance;
  open: boolean;
  onAdjust: (counter: "white" | "red", delta: number) => void;
  onClear: (counter: "white" | "red") => void;
  onClose: () => void;
}

export function CounterEditor({ card, open, onAdjust, onClear, onClose }: CounterEditorProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && ref.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const rows: Array<{ counter: "white" | "red"; label: string; value: number; tone: string }> = [
    { counter: "white", label: t("sim.tablet.white") ?? "White", value: Math.trunc(card.whiteCounter ?? 0), tone: "bg-[#f1f6ff] text-[#101c2e]" },
    { counter: "red", label: t("sim.tablet.red") ?? "Red", value: Math.trunc(card.redCounter ?? 0), tone: "bg-[#7e2222] text-[#ffe8e8]" },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[2147483400] flex items-center justify-center bg-[rgba(3,8,18,0.62)] p-3 backdrop-blur-[3px]">
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t("sim.tablet.editCounters") ?? "Edit counters"}
        className="w-[min(20rem,calc(100vw-1.5rem))] rounded-[0.5rem] border border-[rgba(141,176,232,0.24)] bg-[linear-gradient(155deg,#172b43,#0b1626_75%)] p-[0.9rem] text-[#e6f2ff] shadow-[0_24px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        <header className="mb-[0.55rem] flex items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-[0.78rem] font-bold uppercase tracking-[0.09em] text-[#edf5ff]">
              {t("sim.tablet.editCounters") ?? "Edit counters"}
            </h3>
            <p className="mt-[0.16rem] text-[0.6rem] text-[#9db5d4]">
              {card.name}
              {card.might !== undefined ? ` · ⚔ ${card.might}` : ""}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="grid h-[1.9rem] w-[1.9rem] place-items-center rounded-[0.2rem] border border-[rgba(192,209,236,0.24)] text-[#dce8fb] hover:bg-white/10"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="grid gap-[0.4rem]">
          {rows.map((row) => (
            <div
              key={row.counter}
              className="grid grid-cols-[minmax(0,1fr)_2rem_2.4rem_2rem_auto] items-center gap-[0.28rem] rounded-[0.3rem] border border-[rgba(144,172,197,0.22)] bg-[rgba(8,19,32,0.42)] p-[0.34rem]"
            >
              <span className={`inline-flex h-[1.5rem] min-w-[3.4rem] items-center justify-center rounded-[0.2rem] px-[0.4rem] text-[0.62rem] font-black uppercase tracking-[0.05em] ${row.tone}`}>
                {row.label}
              </span>
              <button
                type="button"
                aria-label={t("sim.decreaseTag", { tag: row.label }) ?? "Decrease"}
                className="h-[1.7rem] rounded-[0.2rem] border border-[rgba(166,185,209,0.26)] bg-[rgba(42,61,87,0.82)] text-[0.9rem] font-black leading-none hover:bg-[rgba(56,79,108,0.9)]"
                onClick={() => onAdjust(row.counter, -1)}
              >
                −
              </button>
              <output className="text-center text-[0.9rem] font-black tabular-nums">{row.value}</output>
              <button
                type="button"
                aria-label={t("sim.increaseTag", { tag: row.label }) ?? "Increase"}
                className="h-[1.7rem] rounded-[0.2rem] border border-[rgba(166,185,209,0.26)] bg-[rgba(42,61,87,0.82)] text-[0.9rem] font-black leading-none hover:bg-[rgba(56,79,108,0.9)]"
                onClick={() => onAdjust(row.counter, 1)}
              >
                +
              </button>
              <button
                type="button"
                className="rounded-[0.2rem] border border-[rgba(224,200,171,0.26)] bg-[rgba(46,34,26,0.72)] px-[0.42rem] py-[0.3rem] text-[0.56rem] font-semibold uppercase tracking-[0.05em] text-[#f3e4d8] hover:bg-[rgba(58,42,31,0.9)]"
                onClick={() => onClear(row.counter)}
              >
                {t("sim.tablet.clearCounter", { color: row.label }) ?? "Clear"}
              </button>
            </div>
          ))}
        </div>
        <p className="mt-[0.5rem] text-[0.56rem] leading-snug text-[#8ea9c9]">
          {t("sim.tablet.counterInstructions") ?? "Changes apply immediately."}
        </p>
      </div>
    </div>,
    document.body,
  );
}
