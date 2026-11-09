"use client";

import { useEffect, useRef, useState } from "react";

import { createTranslator } from "@rift/i18n";
import type { CardInstance } from "@rift/protocol";

import { GameCard } from "../card/GameCard";
import type { CardSide } from "../card/types";
import { computeHandFan } from "../layout/board-metrics";
import { CARD_ASPECT } from "../layout/board-metrics";
import { useLocalGameSettings } from "../settings/settings-values";
import { useBoardInteractionOptional } from "./context";
import type { GameActionIntent, BoardSlotProps } from "../slot-types";
import { playBoardSound } from "./sfx";
import { HAND_FAN_SLOT_CLASS } from "../zones/HandFan";

const t = createTranslator("en");

export interface HandSlotProps extends BoardSlotProps {
  /** Which hand this rail renders; the slot contract itself is self-only. */
  owner?: CardSide;
}

function rootRem(): number {
  if (typeof document === "undefined") return 16;
  return Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
}

/**
 * Interactive hand fan (`sX` / HandRail): exact `793143 l` geometry plus the
 * local hover raise, drag gap preview, per-card reveal privacy eye and the
 * hand-wide `HAND REVEALED` toggle.
 */
export function HandSlot({ state, viewerId, dispatch, owner = "self" }: HandSlotProps) {
  const interaction = useBoardInteractionOptional();
  const railRef = useRef<HTMLDivElement | null>(null);
  const [railWidthRem, setRailWidthRem] = useState<number | null>(null);
  const [layoutCardWidthRem, setLayoutCardWidthRem] = useState(5.2);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);
  const { cardSizePercent } = useLocalGameSettings();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const board = document.querySelector<HTMLElement>(".gb-board");
    if (!board) return;
    const rem = rootRem();
    const style = getComputedStyle(board);
    const raw = style.getPropertyValue("--card-width").trim();
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed > 0) {
      const baseRem = raw.endsWith("rem") ? parsed : parsed / rem;
      // Original `793143 Q`: touch hand rails scale the card and add the
      // fixed 0.65/1.392857rem exhaust allowance.
      const touch = board.dataset.tabletLayout === "true";
      const handScale = touch
        ? Number.parseFloat(style.getPropertyValue("--tablet-hand-card-scale")) || 1
        : 1;
      setLayoutCardWidthRem(touch ? baseRem * handScale + 0.65 / CARD_ASPECT : baseRem);
    }
  }, [railWidthRem, cardSizePercent]);

  const player = state.players.find((candidate) => candidate.id === viewerId);
  const opponent = state.players.find(
    (candidate) => candidate.id !== viewerId && !candidate.leftAt,
  );
  const handOwner = owner === "self" ? player : opponent;
  const hand = handOwner?.board?.hand ?? [];
  const allCardsRevealed =
    hand.length > 0 &&
    hand.every(
      (card) =>
        !!card.revealedToOpponent ||
        (owner === "opponent" && !!card.revealedToPlayerIds?.includes(viewerId)),
    );
  const viewerRevealed =
    owner === "opponent" &&
    (!!opponent?.board?.handRevealToOpponent ||
      !!opponent?.board?.handRevealedToPlayerIds?.includes(viewerId));
  const handRevealed =
    (owner === "self" ? !!player?.board?.handRevealToOpponent : viewerRevealed) || allCardsRevealed;
  const strictLocked = !!interaction?.strictView && !interaction?.strictManual;
  const revealDisabled =
    owner === "opponent" || !interaction?.canAct || state.phase !== "in_game" || strictLocked;

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const measure = () => {
      const width = rail.getBoundingClientRect().width;
      if (width > 0) setRailWidthRem(width / rootRem());
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [hand.length]);

  const drag = interaction?.drag;
  const handDragActive = !!drag?.active;
  const isSourceHand = handDragActive && drag?.sourceZone === "hand" && drag?.sourceOwner === owner;
  const previewGapIndex =
    handDragActive &&
    drag?.overZone === "hand" &&
    drag?.overOwner === owner &&
    drag?.toIndex !== null
      ? drag.toIndex
      : undefined;
  const fan = computeHandFan({
    cards: hand,
    layoutCardWidthRem,
    railWidthRem: railWidthRem ?? undefined,
    maxRailWidthRem: railWidthRem ?? undefined,
    previewGapIndex,
    layoutHoldingCardId: isSourceHand ? (drag?.sourceCardId ?? undefined) : undefined,
    hiddenSourceCardId: isSourceHand ? (drag?.sourceCardId ?? undefined) : undefined,
    remoteHoveredCardId: handDragActive ? null : hoveredCardId,
  });

  const dropHandlers = interaction?.getDropZoneHandlers("hand", owner);
  const revealedForCard = (card: CardInstance): boolean => {
    if (owner === "self") return handRevealed || !!card.revealedToOpponent;
    return (
      handRevealed || !!card.revealedToOpponent || !!card.revealedToPlayerIds?.includes(viewerId)
    );
  };

  return (
    <section
      data-drop-zone-root="hand"
      data-ordered-drop-preview-index={previewGapIndex ?? -1}
      data-zone-owner={owner}
      className="w-full min-h-0 border-none bg-transparent p-0 flex items-end justify-center shadow-none pointer-events-auto"
      {...dropHandlers}
    >
      <div
        ref={railRef}
        className="handRail min-h-0 min-w-0 relative block w-full h-(--card-height) overflow-visible p-0 rounded-none"
        data-hand-drag-active={handDragActive ? "true" : "false"}
        data-zone-owner={owner}
        data-hand-fan-presentation="standard"
        data-hand-presentation-rail-width-rem={railWidthRem ?? undefined}
        style={fan.railStyle}
        onContextMenu={(event) => {
          if (event.shiftKey) return;
          event.preventDefault();
          interaction?.handleZoneContextMenu("hand", owner, event);
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-40 overflow-visible">
          {fan.slots.map((slot) => {
            const card = slot.card as CardInstance;
            const faceDown = owner === "opponent" && !revealedForCard(card);
            return (
              <div
                key={card.id}
                className={
                  HAND_FAN_SLOT_CLASS +
                  (slot.isHiddenSourceCard ? " invisible" : "") +
                  (handDragActive ? " pointer-events-none" : "")
                }
                style={{
                  ...slot.style,
                  ["--fan-hover-raise" as string]:
                    !handDragActive && hoveredCardId === card.id
                      ? "-12px"
                      : slot.style["--fan-hover-raise"],
                }}
                data-card-id={card.id}
                onPointerEnter={(event) => {
                  if (event.pointerType !== "mouse" && event.pointerType) return;
                  setHoveredCardId(card.id);
                  if (hand.length > 0) playBoardSound("card_hover");
                }}
                onPointerLeave={(event) => {
                  if (event.pointerType !== "mouse" && event.pointerType) return;
                  setHoveredCardId(null);
                }}
              >
                <div
                  className="relative w-full h-full"
                  data-hover-preview-anchor="true"
                  data-preview-landscape="false"
                  data-preview-rotation="0"
                  data-card-id={card.id}
                  data-drop-zone="hand"
                >
                  <GameCard
                    card={card}
                    zone="hand"
                    owner={owner}
                    profile="hand"
                    faceDown={faceDown}
                    backSlot="landscape"
                    exhausted={false}
                    labels={card.customLabels}
                    readOnly={!interaction}
                    onCardEvent={interaction?.handleCardEvent}
                    draggable={!!interaction?.canAct && owner === "self"}
                    selected={interaction?.selectedCardIds.has(card.id)}
                    targetable={interaction?.targetableCardIds.has(card.id)}
                    playable={!!interaction?.strictView?.playableCardIds.has(card.id)}
                  />
                </div>
              </div>
            );
          })}
          {fan.gapStyle ? (
            <div
              className="handFanSlot pointer-events-none absolute left-1/2 top-0 flex items-start w-(--card-width) h-(--card-height) origin-[center_bottom] transform-[translate(calc(-50%+var(--fan-offset-x,0rem)),calc(var(--fan-translate-y,0px)+var(--fan-hover-raise,0px)))_rotate(var(--fan-rotate,0deg))] transition-transform duration-220 ease-[cubic-bezier(0.2,0.7,0.2,1)] motion-reduce:transition-none"
              style={fan.gapStyle}
              aria-hidden="true"
            >
              <div className="w-(--card-width) h-(--card-height) rounded-(--card-radius-tight) border border-dashed border-[rgba(120,221,183,0.4)] bg-[rgba(120,221,183,0.06)] opacity-60" />
            </div>
          ) : null}
        </div>

        {owner === "self" ? (
          <button
            type="button"
            disabled={revealDisabled}
            aria-pressed={handRevealed}
            aria-label={
              handRevealed
                ? (t("sim.hideHandFromOpponent") ?? "Hide hand from opponent")
                : (t("sim.revealHand") ?? "Reveal Hand")
            }
            title={
              handRevealed
                ? (t("sim.hideHandFromOpponent") ?? "Hide hand from opponent")
                : (t("sim.revealHand") ?? "Reveal Hand")
            }
            data-hand-reveal-toggle="true"
            className={
              "handRevealButton group/action absolute right-[-1.85rem] top-1/2 z-60 inline-flex h-[1.65rem] w-[1.65rem] -translate-y-1/2 items-center justify-center rounded-full border shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_5px_12px_rgba(3,8,18,0.24)] backdrop-blur-md transition-colors " +
              (handRevealed
                ? "border-[rgba(125,218,237,0.58)] bg-[rgba(38,94,112,0.9)] text-[#e8fbff]"
                : "border-[rgba(181,205,234,0.28)] bg-[rgba(18,31,51,0.8)] text-[#cfe2f7] hover:border-[rgba(204,226,249,0.42)] hover:bg-[rgba(29,47,72,0.84)]")
            }
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              playBoardSound("ui_click");
              (interaction?.sendIntent ?? dispatch)({
                type: "set_hand_reveal",
                reveal: !handRevealed,
              } as GameActionIntent);
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
              <path
                d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </button>
        ) : null}
      </div>
    </section>
  );
}
