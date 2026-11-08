"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { createTranslator } from "@rift/i18n";

import type { GameActionIntent } from "../../slot-types";

const t = createTranslator("en");
const SIDES = [4, 6, 8, 10, 12, 20] as const;

function DieIcon({ sides, className }: { sides: number; className?: string }) {
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
      <path d="M18 3 32 11v14L18 33 4 25V11Z" />
      <path d="M18 3v10m0 0 14-2M18 13 4 11m14 2v9m0 0 14-2m-14 2-14-2" opacity="0.55" />
      <text x="18" y="26" textAnchor="middle" fontSize="8" fontWeight="700" fill="currentColor" stroke="none">
        {sides}
      </text>
    </svg>
  );
}

export function DiceWheel({
  enabled,
  dispatch,
}: {
  enabled: boolean;
  dispatch: (intent: GameActionIntent) => void;
}) {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const wheelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);

  const open = position !== null;

  const show = () => {
    if (!enabled) return;
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const diameter = 224;
    const margin = 12;
    const left = Math.max(margin, Math.min(window.innerWidth - diameter - margin, rect.left + rect.width / 2 - diameter / 2));
    const top = Math.max(margin, Math.min(window.innerHeight - diameter - margin, rect.top + rect.height / 2 - diameter / 2));
    setPosition({ left, top });
  };

  const close = () => {
    setPosition(null);
    setHovered(null);
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && wheelRef.current?.contains(target)) return;
      if (target instanceof Node && buttonRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.shiftKey || event.key.toLowerCase() !== "r") return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      show();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [enabled]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={!enabled}
        aria-label={t("sim.diceWheel") ?? "Dice wheel"}
        aria-expanded={open}
        title={`${t("sim.diceWheel") ?? "Dice wheel"} · ${t("sim.hotkeyOpenDiceWheel") ?? "Shift+R"}`}
        onClick={() => (open ? close() : show())}
        className="pointer-events-auto grid h-[1.85rem] w-[1.85rem] place-items-center rounded-[0.3rem] border border-[rgba(174,199,227,0.28)] bg-[rgba(9,19,34,0.9)] text-[#cfe1f8] shadow-[0_8px_18px_rgba(3,8,20,0.4)] hover:border-[rgba(224,194,135,0.58)] hover:text-[#ffe6b8] disabled:opacity-40"
        data-testid="dice-wheel-toggle"
        data-setup-action="open-dice-wheel"
      >
        <DieIcon sides={20} className="h-[1.15rem] w-[1.15rem]" />
      </button>
      {open && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={wheelRef}
              role="group"
              aria-label={t("sim.diceWheel") ?? "Dice wheel"}
              className="pointer-events-none fixed z-[180] select-none rounded-full border border-[#d9bb792e] bg-[radial-gradient(circle_at_50%_42%,rgba(36,48,61,0.97),rgba(13,21,33,0.97)_72%)] shadow-[0_18px_48px_rgba(0,0,0,0.52),inset_0_1px_0_rgba(255,237,190,0.08)] backdrop-blur-md"
              style={{ left: position.left, top: position.top, width: 224, height: 224 }}
              data-testid="dice-wheel"
            >
              <div className="absolute inset-[7px] rounded-full border border-[#d9bb7914]" />
              <div className="absolute inset-[39px] rounded-full border border-[#d9bb7912]" />
              <div
                aria-hidden="true"
                className="absolute left-1/2 top-1/2 flex h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full border border-[#d9bb7924] bg-[#0b14218c] shadow-[inset_0_1px_8px_rgba(0,0,0,0.24)]"
              >
                <DieIcon sides={6} className="h-6 w-6 -rotate-12 text-[#d6bd8b8c]" />
                <kbd className="font-sans text-[9px] font-medium tracking-[0.18em] text-[#c8bdab99]">⇧ R</kbd>
              </div>
              {SIDES.map((sides, index) => {
                const angle = ((60 * index - 90) * Math.PI) / 180;
                const active = hovered === sides;
                return (
                  <button
                    key={sides}
                    type="button"
                    aria-label={t("sim.rollDieType", { sides }) ?? `Roll d${sides}`}
                    title={t("sim.rollDieType", { sides }) ?? `Roll d${sides}`}
                    className="pointer-events-auto absolute h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f5db9b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#121d2c]"
                    style={{ left: 112 + 76 * Math.cos(angle), top: 112 + 76 * Math.sin(angle) }}
                    onMouseEnter={() => setHovered(sides)}
                    onMouseLeave={() => setHovered(null)}
                    onFocus={() => setHovered(sides)}
                    onBlur={() => setHovered(null)}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      close();
                      dispatch({ type: "roll_die", sides });
                    }}
                    data-testid={`dice-roll-${sides}`}
                    data-setup-action="roll-die"
                  >
                    <span
                      className="flex h-full w-full flex-col items-center justify-center gap-0.5 rounded-full border transition-[background,border-color,box-shadow,transform,color] duration-150 ease-out motion-reduce:transition-none"
                      style={{
                        color: active ? "#ffe5ab" : "#c8d2dc",
                        borderColor: active ? "rgba(244,207,127,0.8)" : "rgba(180,196,215,0.16)",
                        background: active
                          ? "linear-gradient(155deg,rgba(106,80,39,0.98),rgba(47,39,29,0.98))"
                          : "linear-gradient(155deg,rgba(38,51,67,0.94),rgba(18,29,43,0.96))",
                        boxShadow: active
                          ? "0 0 22px rgba(239,191,96,0.2),0 6px 16px rgba(0,0,0,0.4),inset_0_1px_0 rgba(255,237,184,0.18)"
                          : "0 4px 12px rgba(0,0,0,0.24),inset_0_1px_0 rgba(233,240,255,0.04)",
                        transform: active ? "scale(1.1)" : "scale(1)",
                      }}
                    >
                      <DieIcon sides={sides} className="h-8 w-8" />
                      <span className="font-sans text-[10px] font-semibold leading-none tracking-wide tabular-nums">d{sides}</span>
                    </span>
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
