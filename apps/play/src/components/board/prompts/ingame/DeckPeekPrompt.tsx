"use client";

/**
 * Deck peek — original `mx` (`0xawjzm3yjpr1.js:39176-39758`) rendered through
 * the generic `gb-card-list*` popover (`25vik2nxxo51i.js:2940-3490`).
 *
 * Cards are draggable with the original `application/x-riftbound-deck-peek-card`
 * MIME; dropping on a board zone takes the card from the deck (shift puts it on
 * top when dropping on the main deck). Per-card actions, reveal badges, the
 * title/More menus and the selection footer match the original action set.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent as ReactDragEvent } from "react";

import { createTranslator } from "@rift/i18n";
import type { CardInstance, Room } from "@rift/protocol";

import { cardImageUrl } from "@/lib/assets";

import { buildDropIntent, writeDragPayload, type DropTargetZone } from "../../drag";
import {
  deckPeekTitle,
  nextRevealAll,
  peekZone,
  type DeckPeekZone,
} from "./deck-peek-state";
import type { GameActionIntent } from "../../slot-types";
import { SafeImg } from "../../card/SafeImg";

const t = createTranslator("en");

type Tone = "play" | "hand" | "trash" | "banished" | "reveal" | "default";

interface ActionButton {
  id: string;
  label: string;
  tone: Tone;
  disabled?: boolean;
  reason?: string;
  onSelect: () => void;
}

const GRID_TONE: Record<Tone, string> = {
  play:
    "border-[rgba(176,242,208,0.9)] bg-[linear-gradient(180deg,rgb(68,170,130),rgb(18,72,51))] text-[#effff7] shadow-[inset_0_1px_0_rgba(236,255,246,0.24),0_2px_6px_rgba(2,6,18,0.45)] hover:enabled:border-[rgba(196,250,223,0.96)] hover:enabled:bg-[linear-gradient(180deg,rgb(78,184,141),rgb(22,84,60))]",
  hand:
    "border-[rgba(205,224,250,0.46)] bg-[linear-gradient(180deg,rgb(46,75,116),rgb(31,54,87))] text-[#e9f2ff] hover:enabled:border-[rgba(224,238,255,0.62)] hover:enabled:bg-[linear-gradient(180deg,rgb(55,89,133),rgb(36,63,101))]",
  trash:
    "border-[rgba(224,200,171,0.46)] bg-[linear-gradient(180deg,rgb(88,66,47),rgb(54,39,28))] text-[#f6e8d9] hover:enabled:border-[rgba(238,219,194,0.62)] hover:enabled:bg-[linear-gradient(180deg,rgb(102,77,55),rgb(63,46,33))]",
  banished:
    "border-[rgba(190,168,244,0.46)] bg-[linear-gradient(180deg,rgb(92,70,146),rgb(50,36,84))] text-[#ece5ff] hover:enabled:border-[rgba(215,201,255,0.62)] hover:enabled:bg-[linear-gradient(180deg,rgb(105,81,164),rgb(57,41,95))]",
  reveal:
    "border-[rgba(125,218,237,0.48)] bg-[linear-gradient(180deg,rgb(38,94,112),rgb(19,55,71))] text-[#e6fbff] hover:enabled:border-[rgba(160,235,248,0.66)] hover:enabled:bg-[linear-gradient(180deg,rgb(48,110,130),rgb(24,68,86))]",
  default:
    "border-[rgba(190,206,229,0.38)] bg-[linear-gradient(180deg,rgb(35,48,69),rgb(22,31,48))] text-[#dbe7ff] hover:enabled:border-[rgba(213,227,246,0.54)] hover:enabled:bg-[linear-gradient(180deg,rgb(43,59,84),rgb(27,38,58))]",
};

const SUBTLE_BUTTON =
  "inline-flex items-center justify-center rounded-[0.16rem] border border-transparent bg-transparent px-[0.76rem] py-[0.42rem] text-[#edf5ff] text-[0.72rem] font-semibold leading-none shadow-none disabled:cursor-not-allowed disabled:opacity-50 hover:enabled:border-[rgba(201,218,249,0.12)] hover:enabled:bg-[rgba(18,30,52,0.46)] hover:enabled:text-white transition-colors";

const REVEAL_BUTTON =
  "inline-flex items-center justify-center rounded-[0.16rem] border px-[0.76rem] py-[0.42rem] text-[0.72rem] font-semibold leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const REVEAL_PRESSED =
  "border-[rgba(125,218,237,0.58)] bg-[linear-gradient(180deg,rgba(38,94,112,0.94),rgba(19,55,71,0.98))] text-[#e8fbff] shadow-[inset_0_1px_0_rgba(224,250,255,0.16),0_0_0_1px_rgba(125,218,237,0.22)] hover:enabled:border-[rgba(160,235,248,0.72)] hover:enabled:bg-[linear-gradient(180deg,rgba(48,110,130,0.98),rgba(24,68,86,0.98))]";
const REVEAL_UNPRESSED =
  "border-[rgba(125,218,237,0.28)] bg-[rgba(15,34,52,0.78)] text-[#d7f6fb] shadow-[inset_0_1px_0_rgba(224,250,255,0.06)] hover:enabled:border-[rgba(160,235,248,0.5)] hover:enabled:bg-[rgba(21,48,65,0.9)]";

const ACTION_GRID =
  "pointer-events-auto grid w-full grid-cols-2 gap-[0.36rem] [&>button:first-child:nth-last-child(odd)]:col-span-2";
const ACTION_BUTTON =
  "flex min-h-10 min-w-0 items-center justify-center rounded-[0.28rem] border p-[0.35rem] text-center text-[0.72rem] font-semibold leading-[1.25] transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const SELECTION_RING =
  "pointer-events-none absolute inset-0 z-7 rounded-[inherit] border-[0.18rem] border-[#f8d880] bg-[linear-gradient(180deg,rgba(248,216,128,0.18)_0%,rgba(248,216,128,0.05)_42%,rgba(248,216,128,0)_70%)] shadow-[inset_0_0_0_1px_rgba(255,246,206,0.46),0_0_0_1px_rgba(248,216,128,0.62),0_0_22px_rgba(248,216,128,0.34)]";
const REVEALED_RING =
  "pointer-events-none absolute inset-0 z-5 rounded-[inherit] border-[0.18rem] border-[#7df4ff] bg-[linear-gradient(180deg,rgba(74,235,255,0.24)_0%,rgba(74,235,255,0.08)_24%,rgba(74,235,255,0)_48%)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_0_0_1px_rgba(125,244,255,0.72),0_0_24px_rgba(65,221,255,0.62)]";

function zoneParam(zone: DeckPeekZone): { zone?: "runeDeck" } {
  return zone === "runeDeck" ? { zone: "runeDeck" } : {};
}

function deckList(board: NonNullable<Room["players"][number]["board"]>, zone: DeckPeekZone) {
  return zone === "runeDeck" ? board.runeDeck : board.deck;
}

export function resolveZoneDropAt(x: number, y: number): {
  targetZone: DropTargetZone;
  targetOwner: "self" | "opponent";
} | null {
  if (typeof document === "undefined") return null;
  const element = document.elementFromPoint(x, y);
  if (!(element instanceof Element)) return null;
  const pile = element.closest<HTMLElement>("[data-pile-slot]");
  if (pile?.dataset.pileSlot) {
    const owner = pile.closest<HTMLElement>("[data-zone-owner]")?.dataset.zoneOwner;
    return {
      targetZone: pile.dataset.pileSlot === "runeDeck" ? "runeDeck" : "mainDeck",
      targetOwner: owner === "opponent" ? "opponent" : "self",
    };
  }
  const root = element.closest<HTMLElement>("[data-drop-zone-root]");
  if (!root?.dataset.dropZoneRoot) return null;
  const ownerElement = root.closest<HTMLElement>("[data-zone-owner]");
  return {
    targetZone: root.dataset.dropZoneRoot as DropTargetZone,
    targetOwner: ownerElement?.dataset.zoneOwner === "opponent" ? "opponent" : "self",
  };
}

export function DeckPeekPrompt({
  room,
  viewerId,
  dispatch,
}: {
  room: import("@rift/protocol").Room;
  viewerId: string;
  dispatch: (intent: GameActionIntent) => void;
}) {
  const viewer = room.players.find((player) => player.id === viewerId);
  const board = viewer?.board;
  const peek = board?.deckPeek;
  const zone = peekZone(peek);
  const cards = useMemo(() => {
    if (!peek || !board) return [];
    const list = deckList(board, zone);
    const byId = new Map(list.map((card) => [card.id, card]));
    return peek.cardIds.flatMap((id) => {
      const card = byId.get(id);
      return card ? [card] : [];
    });
  }, [board, peek, zone]);
  const [selection, setSelection] = useState<Set<string>>(() => new Set());
  const [moreOpen, setMoreOpen] = useState(false);
  const [cutout, setCutout] = useState({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 });
  const panelRef = useRef<HTMLElement | null>(null);
  const moreRef = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => {
    dispatch({ type: "dismiss_deck_peek", ...zoneParam(zone) } as GameActionIntent);
  }, [dispatch, zone]);

  const measureCutout = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    setCutout({
      top: Math.max(0, rect.top),
      left: Math.max(0, rect.left),
      right: Math.max(0, window.innerWidth - rect.right),
      bottom: Math.max(0, window.innerHeight - rect.bottom),
      width: rect.width,
      height: rect.height,
    });
  }, []);

  useEffect(() => {
    measureCutout();
    const panel = panelRef.current;
    if (!panel) return;
    const observer = new ResizeObserver(measureCutout);
    observer.observe(panel);
    window.addEventListener("resize", measureCutout);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measureCutout);
    };
  }, [measureCutout]);

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (event: Event) => {
      if (!(event.target instanceof Node)) return;
      if (moreRef.current?.contains(event.target)) return;
      setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setMoreOpen(false);
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("focusin", onPointer, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("focusin", onPointer, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [moreOpen]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !moreOpen) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, moreOpen]);

  useEffect(() => {
    setSelection((current) => {
      const valid = new Set(peek?.cardIds ?? []);
      const next = new Set([...current].filter((id) => valid.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [peek?.cardIds]);

  if (room.phase !== "in_game" || !peek || cards.length === 0 || !board) return null;

  const deck = deckList(board, zone);
  const revealed = new Set(peek.revealedCardIds);
  const allRevealed = cards.length > 0 && cards.every((card) => revealed.has(card.id));
  const allLooked = cards.length >= deck.length;
  const isRune = zone === "runeDeck";
  const title = deckPeekTitle(zone);
  const send = (intent: GameActionIntent) => dispatch(intent);
  const closeAfterCardAction = cards.length <= 1;

  const toggleReveal = (card: CardInstance) => {
    send({
      type: "set_deck_peek_card_reveal",
      cardId: card.id,
      reveal: !revealed.has(card.id),
      ...zoneParam(zone),
    } as GameActionIntent);
  };

  const titleActions: ActionButton[] = [
    {
      id: "deck-peek:look-more",
      label:
        cards.length === 0
          ? isRune
            ? "look_top_rune"
            : "look_top_card"
          : "Look at 1 More",
      tone: "default",
      disabled: allLooked,
      reason: t("sim.deckPeek.allMainDeckCardsLookedAt") ?? undefined,
      onSelect: () =>
        send({ type: "peek_deck_top", count: 1, ...zoneParam(zone) } as GameActionIntent),
    },
  ];
  if (!isRune && cards.length > 0) {
    titleActions.push({
      id: "deck-peek:recycle-all",
      label: "Recycle All",
      tone: "default",
      onSelect: () => send({ type: "clear_deck_peek" } as GameActionIntent),
    });
  }

  const moreActions: ActionButton[] = [
    {
      id: "deck-peek:look-bottom",
      label: "look_at_bottom",
      tone: "default",
      disabled: deck.length === 0 || allLooked,
      reason:
        deck.length === 0
          ? (t("sim.deckPeek.mainDeckEmpty") ?? undefined)
          : (t("sim.deckPeek.allMainDeckCardsLookedAt") ?? undefined),
      onSelect: () => send({ type: "peek_deck_bottom" } as GameActionIntent),
    },
    {
      id: "deck-peek:shuffle-unrecycled",
      label: "shuffle_unrecycled",
      tone: "default",
      disabled: deck.length < 2,
      reason: t("sim.deckPeek.fewerThanTwoUnrecycledCards") ?? undefined,
      onSelect: () =>
        send({
          type: "shuffle_deck",
          preserveRecycledBottom: true,
        } as GameActionIntent),
    },
    {
      id: "deck-peek:shuffle-deck",
      label: "Shuffle Deck",
      tone: "default",
      disabled: deck.length < 2,
      reason: t("sim.deckPeek.fewerThanTwoCards") ?? undefined,
      onSelect: () => send({ type: "shuffle_deck" } as GameActionIntent),
    },
  ];

  const selectAll = () => setSelection(new Set(cards.map((card) => card.id)));
  const clearSelection = () => setSelection(new Set());
  const toggleSelected = (cardId: string) => {
    setSelection((current) => {
      const next = new Set(current);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const moveSelected = (to: "hand" | "trash" | "banished") => {
    for (const cardId of selection) {
      send({ type: "take_card_from_deck", cardId, to } as GameActionIntent);
    }
    clearSelection();
  };
  const recycleSelected = () => {
    for (const cardId of selection) {
      send({
        type: "recycle_deck_peek_card",
        cardId,
        ...zoneParam(zone),
      } as GameActionIntent);
    }
    clearSelection();
  };

  const playFromDeck = (card: CardInstance) => {
    if (/spell/i.test(card.type ?? "")) {
      send({
        type: "chain_add",
        from: "deck",
        cardId: card.id,
        clientEntryId: `chain-${viewerId}-${card.id}-${Date.now()}`,
      } as GameActionIntent);
      return;
    }
    send({ type: "take_card_from_deck", cardId: card.id, to: "base" } as GameActionIntent);
  };

  const cardActions = (card: CardInstance): ActionButton[] => {
    if (isRune) {
      return [
        {
          id: `rune-deck:${card.id}:recycle`,
          label: "Recycle",
          tone: "default",
          onSelect: () => {
            send({
              type: "recycle_deck_peek_card",
              cardId: card.id,
              zone: "runeDeck",
            } as GameActionIntent);
            if (closeAfterCardAction) close();
          },
        },
        {
          id: `rune-deck:${card.id}:toggle-reveal`,
          label: revealed.has(card.id) ? "Hide" : "Reveal",
          tone: "reveal",
          onSelect: () => toggleReveal(card),
        },
      ];
    }
    return [
      {
        id: `deck:${card.id}:play`,
        label: "Play",
        tone: "play",
        onSelect: () => playFromDeck(card),
      },
      {
        id: `deck:${card.id}:recycle`,
        label: "Recycle",
        tone: "default",
        onSelect: () => {
          send({
            type: "recycle_deck_peek_card",
            cardId: card.id,
            zone: "deck",
          } as GameActionIntent);
          if (closeAfterCardAction) close();
        },
      },
      {
        id: `deck:${card.id}:to-hand`,
        label: "To hand",
        tone: "hand",
        onSelect: () =>
          send({ type: "take_card_from_deck", cardId: card.id, to: "hand" } as GameActionIntent),
      },
      {
        id: `deck:${card.id}:to-trash`,
        label: "To trash",
        tone: "trash",
        onSelect: () =>
          send({ type: "take_card_from_deck", cardId: card.id, to: "trash" } as GameActionIntent),
      },
      {
        id: `deck:${card.id}:on-top`,
        label: "On Top",
        tone: "default",
        onSelect: () => {
          send({
            type: "put_deck_peek_card_on_top",
            cardId: card.id,
            zone: "deck",
          } as GameActionIntent);
          if (closeAfterCardAction) close();
        },
      },
      {
        id: `deck:${card.id}:toggle-reveal`,
        label: revealed.has(card.id) ? "Hide" : "Reveal",
        tone: "reveal",
        onSelect: () => toggleReveal(card),
      },
    ];
  };

  const startCardDrag = (card: CardInstance, event: ReactDragEvent<HTMLElement>) => {
    writeDragPayload(event.dataTransfer, "deckPeekCard", { cardId: card.id, zone });
    event.dataTransfer.effectAllowed = "copyMove";
    const onDragOver = (dragEvent: DragEvent) => {
      if (!resolveZoneDropAt(dragEvent.clientX, dragEvent.clientY)) return;
      dragEvent.preventDefault();
      if (dragEvent.dataTransfer) dragEvent.dataTransfer.dropEffect = "move";
    };
    const onDrop = (dropEvent: DragEvent) => {
      const drop = resolveZoneDropAt(dropEvent.clientX, dropEvent.clientY);
      if (!drop) return;
      dropEvent.preventDefault();
      dropEvent.stopPropagation();
      if (drop.targetOwner !== "self") return;
      const intent = buildDropIntent({
        source: { kind: "deckPeekCard", payload: { cardId: card.id, zone } },
        targetZone: drop.targetZone,
        targetOwner: drop.targetOwner,
        viewerId,
        actorPlayerId: viewerId,
        shiftKey: dropEvent.shiftKey,
      });
      if (intent) send(intent);
    };
    const cleanup = () => {
      window.removeEventListener("dragover", onDragOver, true);
      window.removeEventListener("drop", onDrop, true);
      window.removeEventListener("dragend", cleanup, true);
    };
    window.addEventListener("dragover", onDragOver, true);
    window.addEventListener("drop", onDrop, true);
    window.addEventListener("dragend", cleanup, true);
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0" aria-hidden="true">
        <div className="absolute left-0 right-0 top-0 bg-[rgba(4,8,18,0.34)]" style={{ height: cutout.top }} />
        <div
          className="absolute bottom-0 left-0 bg-[rgba(4,8,18,0.34)]"
          style={{ top: cutout.top, width: cutout.left, height: cutout.height }}
        />
        <div
          className="absolute bottom-0 right-0 bg-[rgba(4,8,18,0.34)]"
          style={{ top: cutout.top, width: cutout.right, height: cutout.height }}
        />
        <div
          className="absolute left-0 right-0 bottom-0 bg-[rgba(4,8,18,0.34)]"
          style={{ top: cutout.top + cutout.height }}
        />
      </div>
      <section
        ref={panelRef}
        role="dialog"
        aria-label={title.aria}
        data-deck-peek="true"
        data-deck-peek-zone={zone}
        data-testid="deck-peek-panel"
        className="gb-deck-peek pointer-events-auto fixed z-1 top-[calc(var(--sim-visible-top,0px)+0.5rem)] left-1/2 right-auto w-[min(96rem,calc(100%-1rem))] max-h-[calc(var(--sim-visible-height,100dvh)-var(--card-height)-2.25rem)] -translate-x-1/2 overflow-visible rounded-[0.18rem] border border-[rgba(179,221,255,0.22)] bg-[rgba(8,16,34,0.94)] shadow-[0_24px_44px_rgba(2,6,18,0.58)] before:pointer-events-none before:absolute before:inset-[0.08rem] before:rounded-[inherit] before:bg-[linear-gradient(180deg,rgba(22,39,70,0.94),rgba(11,23,47,0.97))] before:content-[''] after:pointer-events-none after:absolute after:inset-[0.08rem] after:rounded-[inherit] after:opacity-[0.46] after:gb-ornament-field after:content-[''] flex flex-col"
      >
        <div className="pointer-events-none absolute inset-x-[0.9rem] top-[0.72rem] h-px bg-[linear-gradient(90deg,transparent,rgba(121,210,255,0.68)_20%,rgba(121,210,255,0.22)_52%,transparent)]" />
        <div className="gb-card-list-body relative z-1 flex min-h-0 flex-1 flex-col gap-2 p-[0.78rem] pt-[0.9rem]">
          <div className="gb-card-list-header flex justify-between items-center gap-[0.4rem] [&_h3]:m-0 [&_h3]:text-[0.86rem] [&_h3]:font-semibold [&_h3]:uppercase [&_h3]:tracking-[0.06em] [&_h3]:text-[#dff4ff]">
            <div className="gb-card-list-heading flex items-center gap-[0.42rem] min-w-0">
              <button
                type="button"
                data-collapse-to-board
                aria-label={t("current.hideToViewBoard") ?? "Hide to view board"}
                title={t("sim.hidePopover") ?? "Hide Popover"}
                className="inline-flex h-7 w-7 items-center justify-center rounded-[0.16rem] border border-transparent text-[#cfe0f4] hover:bg-[rgba(174,207,225,0.07)]"
                onClick={close}
                data-testid="deck-peek-collapse"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className="gb-card-list-heading-details flex items-center gap-[0.44rem] min-w-0">
                <h3>{title.title}</h3>
                <span className="gb-card-list-info group/info relative inline-flex shrink-0">
                  <button
                    type="button"
                    aria-label={t("current.namedInfo", { name: title.title }) ?? `About ${title.title}`}
                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[rgba(201,218,249,0.16)] bg-[rgba(17,31,58,0.52)] text-[rgba(214,228,248,0.72)] transition-colors hover:border-[rgba(205,221,248,0.32)] hover:bg-[rgba(22,38,68,0.78)] hover:text-[#edf5ff]"
                  >
                    i
                  </button>
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute left-0 top-[calc(100%+0.42rem)] z-200 w-[min(18rem,calc(100vw-2rem))] rounded-[0.18rem] border border-[rgba(203,219,248,0.22)] bg-[rgba(8,16,34,0.96)] px-[0.58rem] py-[0.46rem] text-left text-[0.66rem] font-medium leading-[1.35] tracking-normal text-[#d9e5f6] opacity-0 shadow-[0_12px_24px_rgba(2,6,18,0.48),inset_0_1px_0_rgba(255,255,255,0.06)] transition-opacity duration-120 group-hover/info:opacity-100 group-focus-within/info:opacity-100"
                  >
                    {title.info}
                  </span>
                </span>
                <div className="gb-card-list-title-actions flex items-center gap-[0.34rem] min-w-0 flex-wrap ml-[0.24rem]">
                  {titleActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      disabled={action.disabled}
                      title={action.disabled ? action.reason : undefined}
                      className={`${REVEAL_BUTTON} ${REVEAL_UNPRESSED}`}
                      onClick={action.onSelect}
                      data-deck-peek-action={action.id}
                    >
                      {action.label === "look_top_rune"
                        ? (t("sim.lookAtTopRune") ?? "Look at Top Rune")
                        : action.label === "look_top_card"
                          ? (t("sim.lookAtTopCard") ?? "Look at Top Card")
                          : action.label === "Look at 1 More"
                            ? (
                                <>
                                  <span className="gb-header-full-label">{t("sim.lookAtOneMore") ?? "Look at 1 More"}</span>
                                  <span className="gb-header-compact-label hidden">{t("sim.deckPeek.lookOneMoreCompact") ?? "Look +1"}</span>
                                </>
                              )
                            : action.label === "Recycle All"
                              ? (t("sim.recycleAll") ?? "Recycle All")
                              : action.label}
                    </button>
                  ))}
                  <span className="gb-deck-peek-secondary-actions contents">
                    <button
                      type="button"
                      className={`${REVEAL_BUTTON} ${REVEAL_UNPRESSED}`}
                      onClick={selection.size > 0 ? clearSelection : selectAll}
                      data-testid="deck-peek-select-all"
                    >
                      {selection.size > 0
                        ? (t("current.clearSelection") ?? "Clear Selection")
                        : (t("current.selectAll") ?? "Select All")}
                    </button>
                  </span>
                  <div ref={moreRef} className="relative inline-flex">
                    <button
                      type="button"
                      aria-label={t("sim.deckPeek.moreOptions") ?? "More deck options"}
                      aria-expanded={moreOpen}
                      className={SUBTLE_BUTTON}
                      onClick={() => setMoreOpen((value) => !value)}
                      data-testid="deck-peek-more"
                    >
                      <span className="inline-flex items-center gap-[0.28rem] leading-none">
                        <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
                          <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <span className="gb-deck-peek-more-label leading-none">{t("sim.more") ?? "More"}</span>
                      </span>
                    </button>
                    {moreOpen ? (
                      <div
                        role="group"
                        aria-label={t("sim.deckPeek.moreOptions") ?? "More deck options"}
                        className="gb-deck-peek-more-panel absolute right-0 top-[calc(100%+0.36rem)] z-200 flex w-48 max-w-[calc(100vw-1rem)] flex-col overflow-hidden rounded-[0.22rem] border border-[rgba(201,218,249,0.22)] bg-[rgba(8,16,34,0.98)] text-[#dbe7ff] shadow-[0_14px_28px_rgba(2,6,18,0.54),inset_0_1px_0_rgba(230,239,255,0.06)]"
                      >
                        {moreActions.map((action) => (
                          <button
                            key={action.id}
                            type="button"
                            data-deck-peek-more-action
                            aria-disabled={action.disabled}
                            title={action.disabled ? action.reason : undefined}
                            className={`min-h-10 w-full border-b border-[rgba(201,218,249,0.1)] px-[0.7rem] py-[0.48rem] text-left text-[0.72rem] font-semibold last:border-b-0 focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-[rgba(169,211,255,0.72)] focus-visible:outline-offset-[-2px] ${
                              action.disabled
                                ? "cursor-not-allowed opacity-[0.45]"
                                : "hover:bg-[rgba(27,46,77,0.9)]"
                            }`}
                            onClick={() => {
                              if (action.disabled) return;
                              setMoreOpen(false);
                              action.onSelect();
                            }}
                          >
                            {action.label === "look_at_bottom"
                              ? (t("sim.deckPeek.lookAtBottom") ?? "Look at Bottom")
                              : action.label === "shuffle_unrecycled"
                                ? (t("sim.deckPeek.shuffleUnrecycled") ?? "Shuffle Unrecycled")
                                : action.label === "Shuffle Deck"
                                  ? (t("sim.shuffleDeck") ?? "Shuffle Deck")
                                  : action.label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
            <div className="gb-card-list-tools flex items-center justify-end gap-[0.42rem] min-w-0 flex-wrap">
              <p className="gb-card-list-count inline-flex shrink-0 items-center rounded-[0.16rem] border border-[rgba(126,207,244,0.18)] bg-[rgba(16,36,64,0.72)] px-[0.56rem] py-[0.24rem] text-[0.68rem] font-medium tracking-[0.04em] text-[#8ec5df]">
                {isRune
                  ? `${cards.length} ${cards.length === 1 ? (t("sim.deckPeek.rune") ?? "rune") : (t("sim.deckPeek.runes") ?? "runes")}`
                  : `${cards.length} ${cards.length === 1 ? "card" : "cards"}`}
              </p>
              <div className="gb-card-list-header-actions flex items-center gap-[0.42rem] min-w-0 flex-wrap justify-end">
                <button
                  type="button"
                  aria-pressed={allRevealed}
                  className={`${REVEAL_BUTTON} ${allRevealed ? REVEAL_PRESSED : REVEAL_UNPRESSED}`}
                  onClick={() =>
                    send({
                      type: "set_deck_peek_cards_reveal",
                      cardIds: peek.cardIds,
                      reveal: nextRevealAll(revealed, peek.cardIds),
                      autoRevealNewCards: nextRevealAll(revealed, peek.cardIds),
                      ...zoneParam(zone),
                    } as GameActionIntent)
                  }
                  data-testid="deck-peek-reveal-all"
                >
                  {allRevealed ? (t("sim.hideAll") ?? "Hide All") : (t("sim.revealAll") ?? "Reveal All")}
                </button>
              </div>
              <button
                type="button"
                aria-label={t("sim.close") ?? "Close"}
                className="gb-card-list-close rounded-[0.16rem] border border-[rgba(201,218,249,0.18)] bg-[rgba(17,31,58,0.86)] px-[0.76rem] py-[0.42rem] text-[#dbe7ff] text-[0.72rem] font-semibold shadow-[inset_0_1px_0_rgba(230,239,255,0.06)] transition-colors hover:border-[rgba(205,221,248,0.3)] hover:bg-[rgba(22,38,68,0.96)]"
                onClick={close}
                data-testid="deck-peek-close"
              >
                <span>{t("sim.close") ?? "Close"}</span>
                <svg viewBox="0 0 24 24" fill="none" className="gb-card-list-close-icon hidden h-[18px] w-[18px]" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          </div>

          <div className="gb-card-list-grid min-h-0 max-h-[min(43rem,calc(var(--sim-visible-height,100dvh)-5rem-var(--card-list-below-reserve,0rem)))] flex-1 grid auto-rows-max grid-cols-[repeat(auto-fill,minmax(min(100%,calc(var(--card-peek-width)*0.91)),1fr))] content-start items-start justify-start gap-[0.6rem] overflow-y-auto pr-[0.22rem]">
            {cards.map((card, index) => {
              const selected = selection.has(card.id);
              const revealedCard = revealed.has(card.id);
              const actions = cardActions(card);
              return (
                <article
                  key={card.id}
                  draggable
                  onDragStart={(event) => startCardDrag(card, event)}
                  onPointerEnter={(event) => {
                    if (event.pointerType === "mouse") {
                      (event.currentTarget as HTMLElement).dataset.cardActionHoverActive = "true";
                    }
                  }}
                  onPointerLeave={(event) => {
                    delete (event.currentTarget as HTMLElement).dataset.cardActionHoverActive;
                  }}
                  className={`group/card gb-card-action-hover-scope relative max-w-(--card-peek-width) cursor-grab overflow-hidden rounded-[0.3rem] border bg-[rgba(14,26,48,0.82)] shadow-[0_12px_24px_rgba(3,10,22,0.5)] transition-[border-color,box-shadow,transform] duration-150 active:cursor-grabbing ${
                    selected
                      ? "border-[rgba(248,216,128,0.78)] shadow-[inset_0_0_0_1px_rgba(255,242,188,0.32),0_0_0_1px_rgba(248,216,128,0.28),0_14px_24px_rgba(8,16,30,0.3)]"
                      : "border-[rgba(184,166,136,0.38)] hover:border-[rgba(205,221,246,0.28)] hover:shadow-[inset_0_0_0_1px_rgba(236,244,255,0.08),0_0_0_1px_rgba(196,220,255,0.08),0_12px_20px_rgba(8,16,30,0.22)]"
                  }`}
                  data-testid="deck-peek-card"
                  data-card-id={card.id}
                  data-deck-peek-index={index}
                >
                  <span className="absolute right-[0.24rem] top-[0.24rem] z-10 text-[0.62rem] leading-none text-[#c6d9f0]">
                    {index + 1}
                  </span>
                  {selected ? (
                    <button
                      type="button"
                      aria-label={
                        t("current.deselectCard", { cardName: card.name }) ?? `Deselect ${card.name}`
                      }
                      aria-pressed
                      data-card-selection-control="true"
                      data-selection-state="selected"
                      className="pointer-events-auto absolute left-1/2 top-2 z-20 grid h-8 w-[5.5rem] -translate-x-1/2 grid-cols-[1.125rem_1fr] items-center gap-1 rounded-[0.2rem] border border-[#fff3b0] bg-[rgba(96,78,24,0.98)] px-2 text-[#fff0ad] shadow-[0_0_0_1px_rgba(255,246,203,0.72),0_8px_18px_rgba(2,6,18,0.5),0_0_10px_rgba(248,216,128,0.3),inset_0_1px_0_rgba(255,250,226,0.24)] hover:border-[#fff8d1] hover:bg-[rgba(110,89,26,0.99)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelected(card.id);
                      }}
                    >
                      <span className="flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.12rem] border-2 border-[#fff8d5] bg-[#211902] text-[#fffdf2] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.72),0_0_0_1px_rgba(255,248,213,0.36)]">
                        <svg viewBox="0 0 24 24" fill="none" className="h-[0.875rem] w-[0.875rem]" aria-hidden="true">
                          <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                      <span className="text-center text-[0.5625rem] font-black leading-none tracking-[0.06em] whitespace-nowrap uppercase">
                        {t("sim.selected") ?? "Selected"}
                      </span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      aria-label={t("current.selectCard", { cardName: card.name }) ?? `Select ${card.name}`}
                      aria-pressed={false}
                      data-card-selection-control="true"
                      data-selection-state="unselected"
                      className="pointer-events-auto absolute left-1/2 top-2 z-20 grid h-8 w-[5.5rem] -translate-x-1/2 grid-cols-[1.125rem_1fr] items-center gap-1 rounded-[0.2rem] border border-[rgba(255,235,158,0.82)] bg-[rgba(7,13,25,0.94)] px-2 text-[#fff0ad] shadow-[0_0_0_1px_rgba(45,32,7,0.72),0_8px_18px_rgba(2,6,18,0.52),inset_0_1px_0_rgba(255,250,226,0.16)] hover:border-[#fff0a8] hover:bg-[rgba(47,38,16,0.96)]"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSelected(card.id);
                      }}
                    >
                      <span className="flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded-[0.12rem] border-2 border-current bg-[rgba(255,248,214,0.08)]" />
                      <span className="text-center text-[0.5625rem] font-black leading-none tracking-[0.06em] whitespace-nowrap uppercase">
                        {t("sim.select") ?? "Select"}
                      </span>
                    </button>
                  )}
                  <div className="relative aspect-[63/88] w-full overflow-hidden bg-[#0a1422]">
                    <SafeImg
                      src={cardImageUrl(card, "preview")}
                      alt={card.name}
                      loading="eager"
                      fetchPriority="high"
                      draggable={false}
                      className="h-full w-full object-cover select-none"
                      data-rift-image-kind="card"
                    />
                    {revealedCard ? (
                      <>
                        <span className={REVEALED_RING} aria-hidden="true" />
                        <span
                          className={`pointer-events-none absolute left-1/2 z-6 -translate-x-1/2 rounded-[0.18rem] border border-[#063846] bg-[#d8fbff] px-[0.56rem] py-[0.22rem] text-[0.64rem] font-black leading-none tracking-[0.08em] text-[#063846] uppercase shadow-[0_0_0_1px_rgba(216,251,255,0.72),0_8px_16px_rgba(3,18,28,0.42),0_0_18px_rgba(79,229,255,0.7)] ${
                            selected ? "top-12" : "top-[0.42rem]"
                          }`}
                        >
                          {t("current.revealed") ?? "Revealed"}
                        </span>
                      </>
                    ) : null}
                    {selected ? <span className={SELECTION_RING} aria-hidden="true" /> : null}
                    {!isRune ? (
                      <button
                        type="button"
                        className="gb-deck-peek-to-hand"
                        onClick={() => {
                          const action = actions.find((entry) => entry.id === `deck:${card.id}:to-hand`);
                          action?.onSelect();
                        }}
                      >
                        {t("sim.toHand") ?? "To hand"}
                      </button>
                    ) : null}
                  </div>
                  <div className="relative z-3 p-[0.28rem]">
                    <p className="m-0 truncate text-[0.66rem] font-semibold text-[#edf4ff]">
                      {card.name}
                    </p>
                  </div>
                  <div className="pointer-events-none absolute inset-x-[0.7rem] bottom-[0.7rem] z-4 opacity-0 transition-opacity duration-150 group-hover/card:opacity-100 group-focus-within/card:opacity-100">
                    <div className={ACTION_GRID}>
                      {actions.map((action) => (
                        <button
                          key={action.id}
                          type="button"
                          className={`${ACTION_BUTTON} ${GRID_TONE[action.tone]} pointer-events-auto`}
                          onClick={action.onSelect}
                          data-deck-peek-card-action={action.id}
                        >
                          {action.label === "To hand"
                            ? (t("sim.toHand") ?? "To hand")
                            : action.label === "To trash"
                              ? (t("sim.toTrash") ?? "To trash")
                              : action.label === "On Top"
                                ? (t("sim.onTop") ?? "On Top")
                                : action.label === "Recycle"
                                  ? (t("sim.recycle") ?? "Recycle")
                                  : action.label === "Play"
                                    ? (t("sim.play") ?? "Play")
                                    : action.label === "Hide"
                                      ? (t("sim.hide") ?? "Hide")
                                      : action.label === "Reveal"
                                        ? (t("sim.reveal") ?? "Reveal")
                                        : action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {revealedCard ? (
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 z-2 h-8 bg-[linear-gradient(0deg,rgba(8,18,32,0.62),transparent)]" />
                  ) : null}
                </article>
              );
            })}
          </div>

          {selection.size > 0 ? (
            <div className="gb-card-list-footer pointer-events-none absolute inset-x-[0.78rem] top-[calc(100%+0.56rem)] z-30 flex justify-center">
              <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-[0.42rem] rounded-[0.22rem] border border-[rgba(230,219,166,0.26)] bg-[rgba(8,14,28,0.9)] px-[0.62rem] py-2 shadow-[0_16px_30px_rgba(2,6,18,0.46),inset_0_1px_0_rgba(255,248,214,0.08)] backdrop-blur-sm">
                <div className="flex min-w-0 flex-col items-center gap-1">
                  <span className="inline-flex items-center px-[0.36rem] py-[0.24rem] text-[0.68rem] font-semibold uppercase tracking-wider text-[rgba(230,219,166,0.78)]">
                    {`${selection.size} selected`}
                  </span>
                  <div className="flex flex-wrap items-center justify-center gap-1">
                    <button
                      type="button"
                      className={`${ACTION_BUTTON} ${GRID_TONE.hand} min-h-8 px-[0.6rem] py-[0.3rem]`}
                      onClick={() => moveSelected("hand")}
                    >
                      {t("sim.toHand") ?? "To hand"}
                    </button>
                    <button
                      type="button"
                      className={`${ACTION_BUTTON} ${GRID_TONE.banished} min-h-8 px-[0.6rem] py-[0.3rem]`}
                      onClick={() => moveSelected("banished")}
                    >
                      {t("sim.banish") ?? "Banish"}
                    </button>
                    <button
                      type="button"
                      className={`${ACTION_BUTTON} ${GRID_TONE.trash} min-h-8 px-[0.6rem] py-[0.3rem]`}
                      onClick={() => moveSelected("trash")}
                    >
                      {t("sim.toTrash") ?? "To trash"}
                    </button>
                    <button
                      type="button"
                      className={`${ACTION_BUTTON} ${GRID_TONE.default} min-h-8 px-[0.6rem] py-[0.3rem]`}
                      onClick={recycleSelected}
                    >
                      {t("sim.recycle") ?? "Recycle"}
                    </button>
                    <button
                      type="button"
                      className={SUBTLE_BUTTON}
                      onClick={clearSelection}
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="mr-1 h-3 w-3 shrink-0" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                      </svg>
                      {t("current.clearSelection") ?? "Clear Selection"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
