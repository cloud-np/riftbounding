/**
 * Pure context-menu descriptors — the item order/groups mirror the original
 * builders at `0xawjzm3yjpr1.js:19690-19900` (board cards), `28330-28440`
 * (hand) and `24180-24700` (piles).
 */
import type { CardInstance } from "@rift/protocol";

import { isChainAddable } from "../drag/drop-intents";

export type CardMenuId =
  | "ping"
  | "recycle"
  | "tap"
  | "play-hidden"
  | "chain"
  | "give-control"
  | "trash"
  | "banish"
  | "target"
  | "clear-targets"
  | "equip"
  | "animate-gear"
  | "choose-neeko-legend"
  | "empower"
  | "disempower"
  | "reveal"
  | "remove-buff";

export interface ContextMenuEntry<TId extends string = string> {
  id: TId;
  /** i18n key resolved by the renderer. */
  labelKey: string;
  /** Items with the same group are contiguous; groups are separated by a rule. */
  group: number;
  disabled?: boolean;
  /** Optional gesture/hint chip text (already localized or symbolic). */
  hint?: string;
  tone?: "default" | "danger" | "positive";
}

const FIELD_ZONES = new Set(["base", "battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken"]);
const TRASHABLE_ZONES = new Set(["hand", "base", "battlefieldA", "battlefieldB", "battlefieldC", "battlefieldToken", "champion"]);

export interface CardMenuInput {
  zone: string;
  card: CardInstance;
  isSelf: boolean;
  canAct: boolean;
  /** target-mode can be started from this card */
  targetingAvailable: boolean;
  hasTargetArrows: boolean;
  /** a unit is available for equip */
  equipTargetAvailable: boolean;
  empowerable: boolean;
  revealAllowed: boolean;
  isNeeko: boolean;
  isOrianna: boolean;
}

function hasHiddenKeyword(card: CardInstance): boolean {
  return (card.keywords ?? []).some((keyword) => keyword.toLowerCase() === "hidden");
}

export function buildCardMenu(input: CardMenuInput): ContextMenuEntry<CardMenuId>[] {
  const { zone, card, isSelf, canAct } = input;
  const entries: ContextMenuEntry<CardMenuId>[] = [];
  const push = (
    id: CardMenuId,
    labelKey: string,
    group: number,
    extra: Partial<Pick<ContextMenuEntry<CardMenuId>, "disabled" | "tone" | "hint">> = {},
  ) => {
    entries.push({ id, labelKey, group, disabled: extra.disabled ?? false, ...extra });
  };

  push("ping", "sim.compactPing", 0, { disabled: !canAct });

  if (zone === "runeArea") {
    push("recycle", "sim.tablet.recycle", 1, { disabled: !isSelf });
    return entries;
  }

  if (isSelf && (zone === "champion" || zone === "legend" || zone === "hand")) {
    push("tap", "sim.tablet.play", 1, { disabled: !canAct });
  }

  if (isSelf && zone === "champion" && hasHiddenKeyword(card)) {
    push("play-hidden", "sim.tablet.hidden", 1, { disabled: !canAct });
  }

  if (isSelf && isChainAddable(zone, card) && !card.hidden) {
    push("chain", "sim.tablet.addToChain", 1, { disabled: !canAct });
  }

  if (isSelf && FIELD_ZONES.has(zone) && !card.hidden) {
    push("give-control", "sim.tablet.giveControl", 1, { disabled: !canAct });
  }

  if (isSelf && TRASHABLE_ZONES.has(zone)) {
    push("trash", "sim.tablet.trash", 2, { disabled: !canAct, tone: "danger" });
    if (zone !== "champion") {
      push("banish", "sim.tablet.banish", 2, { disabled: !canAct, tone: "danger" });
    }
  }

  if (isSelf && input.targetingAvailable) {
    push("target", "sim.tablet.target", 3, { disabled: !canAct });
  }
  if (isSelf && input.hasTargetArrows) {
    push("clear-targets", "sim.tablet.removeTargets", 3, { disabled: !canAct });
  }
  if (isSelf && input.equipTargetAvailable && !card.hidden) {
    push("equip", "sim.tablet.equip", 3, { disabled: !canAct });
  }
  if (isSelf && input.isOrianna) {
    push("animate-gear", "sim.oriannaAnimateGear", 3, { disabled: !canAct });
  }
  if (isSelf && input.isNeeko) {
    push("choose-neeko-legend", "sim.neekoChooseLegendAction", 3, { disabled: !canAct });
  }
  if (isSelf && input.empowerable) {
    push("empower", "sim.tablet.empower", 3, { disabled: !canAct });
  }
  if (isSelf && input.revealAllowed) {
    push("reveal", "sim.tablet.reveal", 3, { disabled: !canAct });
  }
  if (isSelf && (card.temporaryMightBuff ?? 0) > 0) {
    push("remove-buff", "sim.removeBuff", 3, { disabled: !canAct });
  }

  return entries;
}

export type HandMenuId = "play" | "play-hidden" | "chain" | "trash" | "banish" | "reveal" | "auto-pay";

export interface HandMenuInput {
  card: CardInstance;
  canAct: boolean;
  autoPayAvailable: boolean;
  revealAllowed: boolean;
}

export function buildHandMenu(input: HandMenuInput): ContextMenuEntry<HandMenuId>[] {
  const { card, canAct } = input;
  const entries: ContextMenuEntry<HandMenuId>[] = [
    { id: "play", labelKey: "sim.tablet.play", group: 0, disabled: !canAct },
  ];
  if (hasHiddenKeyword(card)) {
    entries.push({ id: "play-hidden", labelKey: "sim.tablet.hidden", group: 0, disabled: !canAct });
  }
  entries.push(
    { id: "chain", labelKey: "sim.tablet.addToChain", group: 0, disabled: !canAct },
    { id: "trash", labelKey: "sim.tablet.trash", group: 1, disabled: !canAct, tone: "danger" },
    { id: "banish", labelKey: "sim.tablet.banish", group: 1, disabled: !canAct, tone: "danger" },
  );
  if (input.revealAllowed) {
    entries.push({
      id: "reveal",
      labelKey: card.revealedToOpponent ? "sim.hideFromOpponent" : "sim.revealToOpponent",
      group: 2,
      disabled: !canAct,
    });
  }
  if (input.autoPayAvailable) {
    entries.push({ id: "auto-pay", labelKey: "current.autoPayCardCost", group: 2, disabled: !canAct });
  }
  return entries;
}

export type PileSlot = "mainDeck" | "runeDeck" | "trash" | "banished";

export type PileMenuId =
  | "press"
  | "look"
  | "burn"
  | "draw_main_deck"
  | "look_main_deck"
  | "context_burn_main_deck"
  | "channel_rune_deck"
  | "context_channel_rune_deck"
  | "context_rune_deck_look"
  | "ready"
  | "look_bottom"
  | "search_deck"
  | "shuffle_deck"
  | "shuffle_unrecycled"
  | "show_trash"
  | "show_banished"
  | "recycle_all"
  | "hand_reveal"
  | "hand_draw"
  | "recycle_rune";

export interface PileMenuInput {
  slot: PileSlot;
  owner: "self" | "opponent";
  count: number;
  recycledBottomCount?: number;
  canAct: boolean;
  handRevealed?: boolean;
  ctrlKey?: boolean;
  /** A rune is selected (runeArea menu). */
  hasRune?: boolean;
}

export function buildPileMenu(input: PileMenuInput): ContextMenuEntry<PileMenuId>[] {
  const { slot, owner, count, canAct } = input;
  const isSelf = owner === "self";
  const disabled = !canAct || count <= 0 || !isSelf;
  const entries: ContextMenuEntry<PileMenuId>[] = [];
  switch (slot) {
    case "mainDeck":
      entries.push(
        { id: "press", labelKey: "sim.drawShortcut", group: 0, disabled },
        { id: "look", labelKey: "sim.look", group: 1, disabled },
        { id: "burn", labelKey: "sim.toTrash", group: 1, disabled, tone: "danger" },
        { id: "draw_main_deck", labelKey: "sim.drawShortcut", group: 1, disabled },
        { id: "look_main_deck", labelKey: "sim.helpTour.lookAtTop", group: 1, disabled },
        { id: "look_bottom", labelKey: "sim.deckPeek.lookAtBottom", group: 2, disabled },
        { id: "search_deck", labelKey: "sim.deckPeek.lookAtDeck", group: 2, disabled },
        { id: "shuffle_deck", labelKey: "sim.shuffleDeck", group: 2, disabled: !canAct || count < 2 || !isSelf },
        {
          id: "shuffle_unrecycled",
          labelKey: "sim.deckPeek.shuffleUnrecycled",
          group: 2,
          disabled:
            !canAct ||
            !isSelf ||
            (input.recycledBottomCount ?? 0) < 1 ||
            count - (input.recycledBottomCount ?? 0) < 2,
        },
        { id: "context_burn_main_deck", labelKey: "sim.burn", group: 3, disabled, tone: "danger" },
      );
      return entries;
    case "runeDeck":
      entries.push(
        { id: "channel_rune_deck", labelKey: "sim.board.channelExhausted", group: 0, disabled },
        { id: "context_channel_rune_deck", labelKey: "sim.board.channelExhausted", group: 1, disabled },
        { id: "context_rune_deck_look", labelKey: "sim.lookAtTopRune", group: 1, disabled },
        { id: "ready", labelKey: "sim.channelReady", group: 1, disabled },
      );
      return entries;
    case "trash":
      entries.push(
        { id: "show_trash", labelKey: "sim.showTrash", group: 0, disabled: !canAct || !isSelf },
        { id: "recycle_all", labelKey: "sim.recycleAll", group: 1, disabled },
        { id: "show_banished", labelKey: "sim.showBanished", group: 1, disabled: !canAct || !isSelf },
      );
      return entries;
    case "banished":
      entries.push(
        { id: "show_banished", labelKey: "sim.showBanished", group: 0, disabled: !canAct || !isSelf },
        { id: "show_trash", labelKey: "sim.showTrash", group: 1, disabled: !canAct || !isSelf },
      );
      return entries;
  }
}

export function buildZoneMenu(
  zone: "hand" | "runeArea",
  input: { owner: "self" | "opponent"; canAct: boolean; handRevealed?: boolean; hasRune?: boolean },
): ContextMenuEntry<PileMenuId>[] {
  const isSelf = input.owner === "self";
  if (zone === "hand") {
    return [
      {
        id: "hand_reveal",
        labelKey: input.handRevealed ? "sim.hideHandFromOpponent" : "sim.revealHand",
        group: 0,
        disabled: !input.canAct || !isSelf,
      },
      { id: "hand_draw", labelKey: "sim.drawShortcut", group: 0, disabled: !input.canAct || !isSelf },
    ];
  }
  return [
    {
      id: "recycle_rune",
      labelKey: "sim.helpTour.runeRecycle",
      group: 0,
      disabled: !input.canAct || !isSelf || !input.hasRune,
    },
    { id: "channel_rune_deck", labelKey: "sim.board.channelExhausted", group: 0, disabled: !input.canAct || !isSelf },
  ];
}
