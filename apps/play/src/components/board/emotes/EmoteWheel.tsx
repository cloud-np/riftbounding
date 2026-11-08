"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useBoardTranslator } from "../sidebar/i18n";
import { EMOTE_BY_ID, emoteWheelPosition, resolveEmoteWheel, type Emote } from "./emote-catalog";

export interface EmoteWheelAnchor {
  x: number;
  y: number;
}

export interface EmoteWheelProps {
  open: boolean;
  onClose: () => void;
  onSelect: (emote: Emote) => void;
  wheel?: readonly string[] | null;
  anchor?: EmoteWheelAnchor | null;
  locale?: string;
}

export function EmoteWheel({ open, onClose, onSelect, wheel, anchor, locale }: EmoteWheelProps) {
  const t = useBoardTranslator(locale);
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const entries = useMemo(
    () =>
      resolveEmoteWheel(wheel)
        .map((id) => EMOTE_BY_ID.get(id))
        .filter((emote): emote is Emote => !!emote),
    [wheel],
  );

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const select = useCallback(
    (emote: Emote) => {
      onSelect(emote);
      onClose();
    },
    [onClose, onSelect],
  );

  if (!open || !mounted) return null;

  const size = 164;
  const left = Math.max(
    8,
    Math.min((anchor?.x ?? window.innerWidth - 200) - size / 2, window.innerWidth - size - 8),
  );
  const top = Math.max(
    8,
    Math.min((anchor?.y ?? window.innerHeight - 220) - size / 2, window.innerHeight - size - 8),
  );

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[179]"
        aria-hidden="true"
        onPointerDown={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div
        data-emote-wheel="true"
        role="dialog"
        aria-label={t("sim.emoteWheel") ?? "Emote wheel"}
        className="pointer-events-none fixed z-180"
        style={{ left, top, width: size, height: size }}
      >
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(26,40,65,0.42)_0%,rgba(10,16,28,0.24)_52%,rgba(6,10,18,0)_78%)]" />
        <div className="absolute inset-[0.52rem] rounded-full border border-[rgba(214,226,247,0.08)]" />
        <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_12px_28px_rgba(2,6,18,0.22)]" />
        <div className="absolute left-1/2 top-1/2 h-[1.65rem] w-[1.65rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[rgba(208,222,248,0.12)] bg-[rgba(13,20,34,0.26)] shadow-[0_0_18px_rgba(7,14,28,0.16)]" />
        <div className="absolute left-1/2 top-1/2 h-[0.3rem] w-[0.3rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(224,235,252,0.5)]" />

        {entries.map((emote, index) => {
          const position = emoteWheelPosition(index);
          const active = hovered === emote.id;
          return (
            <button
              key={emote.id}
              type="button"
              data-emote-id={emote.id}
              aria-label={t(`sim.${emote.labelKey}`) ?? emote.label}
              title={t(`sim.${emote.labelKey}`) ?? emote.label}
              className="group absolute pointer-events-auto"
              style={{
                left: position.left,
                top: position.top,
                width: 46,
                height: 46,
                transform: "translate(-50%, -50%)",
              }}
              onPointerEnter={() => setHovered(emote.id)}
              onPointerLeave={() =>
                setHovered((current) => (current === emote.id ? null : current))
              }
              onFocus={() => setHovered(emote.id)}
              onBlur={() => setHovered((current) => (current === emote.id ? null : current))}
              onClick={() => select(emote)}
            >
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center rounded-full border backdrop-blur-[2px] motion-reduce:transition-none"
                style={{
                  transform: active ? "scale(1.08)" : "scale(1)",
                  borderColor: active ? "rgba(248,252,255,0.52)" : "rgba(190,208,239,0)",
                  background: active
                    ? "linear-gradient(180deg,rgba(31,44,66,0.88),rgba(18,27,42,0.9))"
                    : "linear-gradient(180deg,rgba(31,44,66,0),rgba(18,27,42,0))",
                  boxShadow: active
                    ? `0 0 20px ${emote.accentColor}52,0 10px 20px rgba(3,8,20,0.24)`
                    : "0 0 0 rgba(0,0,0,0)",
                  transition:
                    "transform 140ms ease-out, border-color 140ms ease-out, background 140ms ease-out, box-shadow 140ms ease-out",
                }}
              />
              <span
                aria-hidden="true"
                className="relative flex h-full w-full items-center justify-center"
                style={{ fontSize: 28, lineHeight: 1 }}
              >
                {emote.glyph}
              </span>
            </button>
          );
        })}
      </div>
    </>,
    document.body,
  );
}
