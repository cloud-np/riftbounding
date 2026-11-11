"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { createTranslator } from "@rift/i18n";
import type { CardInstance } from "@rift/protocol";

import { cardArtUrl } from "@/lib/assets";
import { SafeImg } from "../card/SafeImg";
import { useBoardInteractionOptional } from "../interaction/context";

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

/** Strict (non-manual) rooms: pile browsing is read-only, no manual move buttons. */
export function isPileViewerReadOnly(
  interaction: { strictView: unknown; strictManual: boolean } | null | undefined,
): boolean {
  return !!interaction?.strictView && !interaction?.strictManual;
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
  const interaction = useBoardInteractionOptional();
  // Strict play: browsing a pile is read-only (manual moves are only available in strict manual
  // mode / sandbox rooms). Rules-driven "choose a card from your trash" goes through the strict
  // prompt, so in strict mode this viewer must never sit on top of that prompt.
  const strictLocked = isPileViewerReadOnly(interaction);
  const editable = canModify && !strictLocked;
  const showPreview = interaction?.showCardPreview;
  const hidePreview = interaction?.hideCardPreview;
  useEffect(() => {
    if (!open) return;
    return () => hidePreview?.();
  }, [open, hidePreview]);
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
    <div
      data-pile-viewer={slot}
      data-pile-viewer-readonly={strictLocked ? "true" : undefined}
      className={
        strictLocked
          ? // Non-blocking side sheet below the strict prompt layer (z-153): the prompt stays clickable.
            "pointer-events-none fixed inset-0 z-[150] flex items-center justify-start p-3"
          : "fixed inset-0 z-[2147483300] flex items-center justify-center bg-[rgba(0,0,0,0.78)] p-3 backdrop-blur-[3px]"
      }
      onClick={strictLocked ? undefined : onClose}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`${title} · ${owner === "self" ? "you" : "opponent"}`}
        className={"pointer-events-auto flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-[0.6rem] border border-[color:var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[linear-gradient(160deg,var(--rb-surface-2,#15171b),var(--rb-bg,#060607)_78%)] text-[color:var(--rb-text,#ece6da)] shadow-[0_28px_70px_rgba(0,0,0,0.75),inset_0_1px_0_rgba(255,255,255,0.06)] " + (strictLocked ? "w-[min(46rem,calc(100vw-1.5rem))]" : "w-[min(78rem,calc(100vw-1.5rem))]")}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-[color:var(--rb-border,rgba(255,255,255,0.08))] px-3 py-2">
          <div>
            <h3 className="m-0 text-[0.82rem] font-bold uppercase tracking-[0.1em] text-[color:var(--rb-gold-bright,#f0d48a)]">{title}</h3>
            <p className="mt-[0.1rem] text-[0.58rem] text-[color:var(--rb-text-dim,#a39d92)]">
              {cards.length} {cards.length === 1 ? "card" : "cards"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {editable && onRecycleAll && slot === "trash" && owner === "self" ? (
              <button
                type="button"
                className="rounded-[0.24rem] border border-[color:var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface-2,#15171b)] px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.05em] text-[color:var(--rb-gold-bright,#f0d48a)] hover:bg-[#1d1f24]"
                onClick={onRecycleAll}
              >
                {t("sim.recycleAll") ?? "Recycle All"}
              </button>
            ) : null}
            <button
              type="button"
              aria-label="Close"
              className="grid h-8 w-8 place-items-center rounded-[0.24rem] border border-[color:var(--rb-border,rgba(255,255,255,0.08))] text-[color:var(--rb-text,#ece6da)] hover:bg-white/10"
              onClick={onClose}
            >
              ×
            </button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {cards.length === 0 ? (
            <p className="py-10 text-center text-[0.7rem] text-[color:var(--rb-text-dim,#a39d92)]">No cards.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(clamp(9.5rem,17vw,13rem),1fr))] gap-[0.8rem]">
              {cards.map((card) => (
                <article
                  key={card.id}
                  className="flex min-w-0 flex-col overflow-hidden rounded-[0.34rem] border border-[color:var(--rb-border,rgba(255,255,255,0.08))] bg-[var(--rb-surface,#0e0f12)]"
                >
                  <div
                    className="relative aspect-[63/88] w-full cursor-zoom-in overflow-hidden bg-[var(--rb-bg,#060607)]"
                    data-hover-preview-anchor="true"
                    data-card-id={card.id}
                    onPointerEnter={(event) => {
                      if (event.pointerType === "mouse" || !event.pointerType) showPreview?.(card, event.currentTarget);
                    }}
                    onPointerLeave={() => hidePreview?.()}
                  >
                    <SafeImg
                      src={cardArtUrl(card, "preview")}
                      alt={card.name}
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0 px-[0.32rem] py-[0.24rem]">
                    <p className="m-0 truncate text-[0.78rem] font-bold text-[color:var(--rb-text,#ece6da)]" title={card.name}>
                      {card.name}
                    </p>
                    <p className="mt-[0.06rem] text-[0.6rem] uppercase tracking-[0.05em] text-[color:var(--rb-text-dim,#a39d92)]">
                      {card.type ?? "Card"}
                      {card.energyCost !== undefined ? ` · ${card.energyCost}` : ""}
                    </p>
                  </div>
                  {editable ? (
                    <div className="mt-auto grid grid-cols-2 gap-[0.2rem] p-[0.26rem]">
                      {onPlay ? (
                        <button
                          type="button"
                          className="rounded-[0.18rem] border border-[color:var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface-2,#15171b)] px-1 py-[0.24rem] text-[0.52rem] font-semibold text-[color:var(--rb-gold-bright,#f0d48a)] hover:bg-[#1d1f24]"
                          onClick={() => onPlay(card)}
                        >
                          {t("sim.play") ?? "Play"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="rounded-[0.18rem] border border-[color:var(--rb-border,rgba(255,255,255,0.08))] bg-[var(--rb-surface-2,#15171b)] px-1 py-[0.24rem] text-[0.52rem] font-semibold text-[color:var(--rb-text,#ece6da)] hover:bg-[#1d1f24]"
                        onClick={() => onToHand(card)}
                      >
                        {t("sim.toHand") ?? "To hand"}
                      </button>
                      <button
                        type="button"
                        className="rounded-[0.18rem] border border-[color:var(--rb-border,rgba(255,255,255,0.08))] bg-[var(--rb-surface-2,#15171b)] px-1 py-[0.24rem] text-[0.52rem] font-semibold text-[color:var(--rb-text,#ece6da)] hover:bg-[#1d1f24]"
                        onClick={() => onRecycle(card)}
                      >
                        {t("sim.recycle") ?? "Recycle"}
                      </button>
                      <button
                        type="button"
                        className="rounded-[0.18rem] border border-[color:var(--rb-border,rgba(255,255,255,0.08))] bg-[var(--rb-surface-2,#15171b)] px-1 py-[0.24rem] text-[0.52rem] font-semibold text-[color:var(--rb-text,#ece6da)] hover:bg-[#1d1f24]"
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
