"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { createTranslator } from "@rift/i18n";

import type { CardInstance } from "@rift/protocol";

import { CUSTOM_LABEL_HOTKEY, LABEL_PRESETS, labelColors, normalizeCardLabel } from "./label-presets";

const t = createTranslator("en");

export interface LabelEditorProps {
  card: CardInstance;
  open: boolean;
  initialSlot?: 0 | 1 | 2;
  onApply: (label: string, slot: 0 | 1 | 2) => void;
  onRemove: (slot: 0 | 1 | 2) => void;
  onClose: () => void;
}

const SLOTS: Array<0 | 1 | 2> = [0, 1, 2];

export function LabelEditor({ card, open, initialSlot, onApply, onRemove, onClose }: LabelEditorProps) {
  const [slot, setSlot] = useState<0 | 1 | 2>(initialSlot ?? 0);
  const [custom, setCustom] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);
  const labels = (card.customLabels ?? []).slice(0, 3);

  useEffect(() => {
    if (!open) return;
    setSlot(initialSlot ?? 0);
    setCustom("");
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && panelRef.current?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open, initialSlot, onClose]);

  if (!open || typeof document === "undefined") return null;

  const apply = (label: string) => {
    const normalized = normalizeCardLabel(label);
    if (!normalized) return;
    onApply(normalized, slot);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[2147483400] flex items-center justify-center bg-[rgba(3,8,18,0.62)] p-3 backdrop-blur-[3px]">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("sim.hotkeySelectLabel") ?? "Choose a tag"}
        className="card-tag-picker max-h-[calc(100dvh-1.5rem)] w-[min(23rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[0.5rem] border border-[rgba(141,176,232,0.24)] bg-[linear-gradient(155deg,#172b43,#0b1626_75%)] p-[0.9rem] text-[#e6f2ff] shadow-[0_24px_60px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.08)]"
      >
        <header className="mb-[0.55rem] flex items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-[0.78rem] font-bold uppercase tracking-[0.09em] text-[#edf5ff]">
              {t("sim.hotkeySelectLabel") ?? "Choose a tag"}
            </h3>
            <p className="mt-[0.16rem] text-[0.6rem] text-[#9db5d4]">{card.name}</p>
          </div>
          <button
            type="button"
            aria-label={t("common.close") ?? "Close"}
            className="grid h-[1.9rem] w-[1.9rem] place-items-center rounded-[0.2rem] border border-[rgba(192,209,236,0.24)] text-[#dce8fb] hover:bg-white/10"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <div className="mb-[0.6rem] grid grid-cols-3 gap-[0.36rem]">
          {SLOTS.map((index) => {
            const label = labels[index];
            const colors = label ? labelColors(label) : null;
            return (
              <button
                key={index}
                type="button"
                onClick={() => setSlot(index)}
                aria-pressed={slot === index}
                className={
                  "relative min-h-[2.4rem] rounded-[0.3rem] border px-[0.3rem] py-[0.24rem] text-[0.62rem] font-semibold uppercase tracking-[0.04em] transition-colors " +
                  (slot === index
                    ? "border-[rgba(201,226,255,0.6)] bg-[rgba(53,85,118,0.42)] text-white"
                    : "border-[rgba(144,172,197,0.2)] bg-[rgba(8,19,32,0.34)] text-[#c8d9e8] hover:border-[rgba(180,215,238,0.5)]")
                }
                style={colors ? { borderColor: colors.borderColor } : undefined}
              >
                <span className="block truncate">{label || `Slot ${index + 1}`}</span>
                {label ? (
                  <span
                    className="mt-[0.14rem] block text-[0.5rem] font-bold uppercase tracking-[0.08em]"
                    style={{ color: colors?.accentColor }}
                  >
                    {t("sim.replaceLabel") ?? "Replace a tag"}
                  </span>
                ) : null}
                {label ? (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={t("sim.tablet.removeLabel", { slot: index + 1 }) ?? "Remove label"}
                    className="absolute right-[0.08rem] top-[0.04rem] grid h-[1rem] w-[1rem] place-items-center rounded-full text-[0.62rem] text-[#ffd9d4] hover:bg-black/30"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRemove(index);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        onRemove(index);
                      }
                    }}
                  >
                    ×
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mb-[0.35rem] flex items-center justify-between text-[0.56rem] font-semibold uppercase tracking-[0.09em] text-[#7f96bb]">
          <span>{t("sim.tablet.addLabel") ?? "Add label"}</span>
          <span>{`${labels.length} / 3`}</span>
        </div>
        <div className="grid grid-cols-2 gap-[0.3rem]">
          {LABEL_PRESETS.map((preset) => {
            const colors = labelColors(preset.label);
            return (
              <button
                key={preset.id}
                type="button"
                className="card-tag-picker-option group flex min-h-[2.2rem] items-center gap-[0.34rem] rounded-[0.26rem] border px-[0.34rem] text-left text-[0.66rem] font-bold uppercase tracking-[0.03em]"
                style={{
                  borderColor: colors.borderColor,
                  background: colors.backgroundColor,
                  color: colors.textColor,
                }}
                onClick={() => apply(preset.label)}
              >
                <span className="grid h-[1.18rem] w-[1.18rem] shrink-0 place-items-center rounded-[0.16rem] border border-white/20 bg-black/25 text-[0.52rem] text-white/80">
                  {preset.hotkey}
                </span>
                <span className="min-w-0 flex-1 truncate">{preset.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className="card-tag-picker-option flex min-h-[2.2rem] items-center gap-[0.34rem] rounded-[0.26rem] border border-[rgba(125,216,255,0.3)] bg-[rgba(28,58,78,0.6)] px-[0.34rem] text-left text-[0.66rem] font-bold uppercase tracking-[0.03em] text-[#e5f8ff]"
            onClick={() => setCustom("")}
          >
            <span className="grid h-[1.18rem] w-[1.18rem] shrink-0 place-items-center rounded-[0.16rem] border border-white/20 bg-black/25 text-[0.52rem] text-white/80">
              {CUSTOM_LABEL_HOTKEY}
            </span>
            <span>{t("sim.tablet.customLabel") ?? "Custom label"}</span>
          </button>
        </div>

        <form
          className="mt-[0.55rem] flex items-center gap-[0.3rem]"
          onSubmit={(event) => {
            event.preventDefault();
            apply(custom);
          }}
        >
          <input
            value={custom}
            maxLength={24}
            autoFocus
            placeholder={t("sim.tablet.customLabel") ?? "Custom label"}
            onChange={(event) => setCustom(event.target.value)}
            className="min-w-0 flex-1 rounded-[0.24rem] border border-[rgba(144,172,197,0.3)] bg-[rgba(8,19,32,0.72)] px-[0.4rem] py-[0.34rem] text-[0.72rem] text-[#eef6ff] outline-none focus:border-[rgba(190,225,255,0.6)]"
          />
          <button
            type="submit"
            disabled={!normalizeCardLabel(custom)}
            className="rounded-[0.24rem] border border-[rgba(125,216,255,0.45)] bg-[rgba(40,91,118,0.7)] px-[0.55rem] py-[0.34rem] text-[0.62rem] font-bold uppercase tracking-[0.06em] text-[#e7fbff] disabled:opacity-40"
          >
            {t("common.save") ?? "Save"}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}

export { t as labelTranslator };
