"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { createTranslator } from "@rift/i18n";
import type { CardInstance } from "@rift/protocol";

import { cardArtUrl } from "@/lib/assets";
import { SafeImg } from "../card/SafeImg";

const t = createTranslator("en");

export interface PileViewerProps {
  open: boolean;
  slot: "trash" | "banished";
  owner: "self" | "opponent";
  cards: CardInstance[];
  /** Another seat's public pile is inspect-only. */
  canModify?: boolean;
  onPlay?: (card: CardInstance) => void;
  onToHand: (card: CardInstance) => void;
  onRecycle: (card: CardInstance) => void;
  onSwap: (card: CardInstance) => void;
  onRecycleAll?: () => void;
  onClose: () => void;
}

export function PileViewer({
  open,
  slot,
  owner,
  cards,
  canModify = true,
  onPlay,
  onToHand,
  onRecycle,
  onSwap,
  onRecycleAll,
  onClose,
}: PileViewerProps) {
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
  const title = slot === "trash" ? (t("sim.trash") ?? "Trash") : (t("sim.tablet.banishedCaption") ?? "Banished");
  const swapLabel = slot === "trash" ? (t("sim.banish") ?? "Banish") : (t("sim.trash") ?? "To trash");

  return createPortal(
    <div className="fixed inset-0 z-[2147483300] flex items-center justify-center bg-[rgba(3,8,18,0.72)] p-3 backdrop-blur-[3px]" onClick={onClose}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} · ${owner === "self" ? "you" : "opponent"}`}
        className="flex max-h-[calc(100dvh-1.5rem)] w-[min(56rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-[0.6rem] border border-[rgba(141,176,232,0.26)] bg-[linear-gradient(160deg,#122238,#081321_78%)] text-[#e6f2ff] shadow-[0_28px_70px_rgba(0,0,0,0.66),inset_0_1px_0_rgba(255,255,255,0.08)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[rgba(158,181,214,0.18)] px-3 py-2">
          <div>
            <h3 className="m-0 text-[0.82rem] font-bold uppercase tracking-[0.1em] text-[#edf5ff]">{title}</h3>
            <p className="mt-[0.1rem] text-[0.58rem] text-[#9db5d4]">
              {cards.length} {cards.length === 1 ? "card" : "cards"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {canModify && onRecycleAll && slot === "trash" && owner === "self" ? (
              <button
                type="button"
                className="rounded-[0.24rem] border border-[rgba(125,218,237,0.3)] bg-[rgba(15,34,52,0.78)] px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.05em] text-[#d7f6fb] hover:bg-[rgba(21,48,65,0.9)]"
                onClick={onRecycleAll}
              >
                {t("sim.recycleAll") ?? "Recycle All"}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-[0.24rem] border border-[rgba(192,209,236,0.2)] text-[#dce8fb] hover:bg-white/10"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {cards.length === 0 ? (
            <p className="py-10 text-center text-[0.7rem] text-[#8ea9c9]">No cards.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(7.4rem,1fr))] gap-[0.55rem]">
              {cards.map((card) => (
                <article
                  key={card.id}
                  className="flex min-w-0 flex-col overflow-hidden rounded-[0.34rem] border border-[rgba(165,184,207,0.24)] bg-[rgba(8,18,32,0.66)]"
                >
                  <div className="relative aspect-[63/88] w-full overflow-hidden bg-[#0a1422]">
                    <SafeImg
                      src={cardArtUrl(card, "thumb")}
                      alt={card.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 px-[0.32rem] py-[0.24rem]">
                    <p className="m-0 truncate text-[0.62rem] font-bold text-[#eaf3ff]" title={card.name}>
                      {card.name}
                    </p>
                    <p className="mt-[0.06rem] text-[0.5rem] uppercase tracking-[0.05em] text-[#93b0ce]">
                      {card.type ?? "Card"}
                      {card.energyCost !== undefined ? ` · ${card.energyCost}` : ""}
                    </p>
                  </div>
                  {canModify ? (
                    <div className="mt-auto grid grid-cols-2 gap-[0.2rem] p-[0.26rem]">
                      {onPlay ? (
                        <button
                          type="button"
                          className="rounded-[0.18rem] border border-[rgba(125,218,237,0.28)] bg-[rgba(15,34,52,0.78)] px-1 py-[0.24rem] text-[0.52rem] font-semibold text-[#d7f6fb] hover:bg-[rgba(21,48,65,0.9)]"
                          onClick={() => onPlay(card)}
                        >
                          {t("sim.play") ?? "Play"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-[0.18rem] border border-[rgba(201,218,249,0.16)] bg-[rgba(15,28,52,0.74)] px-1 py-[0.24rem] text-[0.52rem] font-semibold text-[#dbe7ff] hover:bg-[rgba(21,37,65,0.88)]"
                        onClick={() => onToHand(card)}
                      >
                        {t("sim.toHand") ?? "To hand"}
                      </button>
                      <button
                        type="button"
                        className="rounded-[0.18rem] border border-[rgba(192,176,244,0.24)] bg-[rgba(35,28,58,0.84)] px-1 py-[0.24rem] text-[0.52rem] font-semibold text-[#e4dcff] hover:bg-[rgba(43,34,69,0.9)]"
                        onClick={() => onRecycle(card)}
                      >
                        {t("sim.recycle") ?? "Recycle"}
                      </button>
                      <button
                        type="button"
                        className="rounded-[0.18rem] border border-[rgba(224,200,171,0.26)] bg-[rgba(46,34,26,0.84)] px-1 py-[0.24rem] text-[0.52rem] font-semibold text-[#f3e4d8] hover:bg-[rgba(58,42,31,0.9)]"
                        onClick={() => onSwap(card)}
                      >
                        {swapLabel}
                      </button>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
