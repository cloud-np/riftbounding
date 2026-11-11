"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { createTranslator } from "@rift/i18n";

import { CUSTOM_LABEL_HOTKEY, LABEL_PRESETS, labelColors, normalizeCardLabel, type LabelPreset } from "./label-presets";

const t = createTranslator("en");

export interface LabelWheelProps {
  open: boolean;
  selected: LabelPreset | null;
  anchorX: number;
  anchorY: number;
  onSelect: (preset: LabelPreset) => void;
  onCustom: (label: string) => void;
  onClose: () => void;
}

/** Hold-`L` tag wheel: 11 preset keys + the `=` custom tag (module 784635). */
export function LabelWheel({ open, selected, anchorX, anchorY, onSelect, onCustom, onClose }: LabelWheelProps) {
  const [custom, setCustom] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const left = Math.max(8, Math.min(anchorX - 150, window.innerWidth - 308));
  const top = Math.max(8, Math.min(anchorY - 150, window.innerHeight - 330));

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={t("sim.hotkeySelectLabel") ?? "Choose a tag"}
      className="fixed z-180 w-[18.2rem] overflow-hidden rounded-[0.42rem] border border-[rgba(236,230,218,0.24)] bg-[rgba(18,16,14,0.97)] p-[0.5rem] text-[#ece6da] shadow-[0_18px_40px_rgba(7,5,3,0.62),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl"
      style={{ left, top }}
    >
      <div className="mb-[0.34rem] flex items-center justify-between">
        <strong className="text-[0.58rem] font-bold uppercase tracking-[0.1em] text-[#ece6da]">
          {t("sim.hotkeySelectLabel") ?? "Choose a tag"}
        </strong>
        <span className="text-[0.5rem] uppercase tracking-[0.06em] text-[#a39d92]">
          {selected ? selected.label : "—"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-[0.22rem]">
        {LABEL_PRESETS.map((preset) => {
          const colors = labelColors(preset.label);
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelect(preset)}
              className={
                "flex min-h-[2rem] items-center gap-[0.22rem] rounded-[0.24rem] border px-[0.24rem] text-left text-[0.58rem] font-bold uppercase tracking-[0.02em] " +
                (selected?.id === preset.id ? "ring-1 ring-[rgba(236,230,218,0.7)]" : "")
              }
              style={{ backgroundColor: colors.backgroundColor, borderColor: colors.borderColor, color: colors.textColor }}
            >
              <span className="grid h-[1rem] w-[1rem] shrink-0 place-items-center rounded-[0.14rem] border border-white/20 bg-black/25 text-[0.46rem]">
                {preset.hotkey}
              </span>
              <span className="min-w-0 truncate">{preset.label}</span>
            </button>
          );
        })}
      </div>
      <form
        className="mt-[0.34rem] flex items-center gap-[0.22rem]"
        onSubmit={(event) => {
          event.preventDefault();
          const label = normalizeCardLabel(custom);
          if (!label) return;
          onCustom(label);
        }}
      >
        <span className="grid h-[1.6rem] w-[1.6rem] shrink-0 place-items-center rounded-[0.18rem] border border-white/20 bg-black/25 text-[0.58rem] font-bold text-white/80">
          {CUSTOM_LABEL_HOTKEY}
        </span>
        <input
          value={custom}
          maxLength={24}
          onChange={(event) => setCustom(event.target.value)}
          placeholder={t("sim.tablet.customLabel") ?? "Custom label"}
          className="min-w-0 flex-1 rounded-[0.2rem] border border-[rgba(163,157,146,0.28)] bg-[rgba(16,14,12,0.8)] px-[0.3rem] py-[0.2rem] text-[0.62rem] text-[#ece6da] outline-none focus:border-[rgba(236,230,218,0.58)]"
        />
        <button
          type="submit"
          disabled={!normalizeCardLabel(custom)}
          className="rounded-[0.2rem] border border-[rgba(200,170,110,0.4)] bg-[rgba(76,74,72,0.66)] px-[0.36rem] py-[0.22rem] text-[0.54rem] font-bold uppercase tracking-[0.04em] text-[#ece6da] disabled:opacity-40"
        >
          {t("sim.tablet.addLabel") ?? "Add label"}
        </button>
      </form>
    </div>,
    document.body,
  );
}
