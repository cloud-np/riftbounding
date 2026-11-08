/**
 * Drop → wire-intent mapping, ported from the original zone drop handlers
 * (`0xawjzm3yjpr1.js:36400-36660`, 37800-38100, 61200-61400).
 *
 * Pure: no React, no DOM. The interaction provider merely resolves the target
 * zone/owner/index and calls this function.
 */
import type { CardInstance, Zone } from "@rift/protocol";
import type { GameActionIntent } from "../slot-types";
import type { DragKind, DragPayload } from "./drag-types";

export type DropTargetZone = Zone | "mainDeck" | "runeDeck" | "chain";

export interface DropSource {
  kind: DragKind;
  payload: DragPayload;
  card?: CardInstance | null;
}

export interface DropIntentInput {
  source: DropSource;
  targetZone: DropTargetZone;
  targetOwner: "self" | "opponent";
  viewerId: string;
  /** Source player id (self = viewer, opponent = other seat). */
  actorPlayerId: string;
  toIndex?: number;
  shiftKey?: boolean;
  /** Armed "play hidden" chooser. */
  asHidden?: boolean;
  /** Card under the pointer (used for gear attachment drops). */
  targetCard?: CardInstance | null;
}

const BATTLEFIELD_ZONES: ReadonlySet<string> = new Set([
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
]);

const REVEALABLE_ZONES: ReadonlySet<string> = new Set([
  "hand",
  "base",
  "trash",
  "battlefieldA",
  "battlefieldB",
  "battlefieldC",
  "battlefieldToken",
  "banished",
  "champion",
]);

function isZone(value: string): value is Zone {
  return REVEALABLE_ZONES.has(value) || value === "legend" || value === "runeArea" || value === "deck" || value === "runeDeck";
}

export function isBattlefieldDropZone(zone: string): boolean {
  return BATTLEFIELD_ZONES.has(zone);
}

function isSpell(card: CardInstance | null | undefined): boolean {
  return !!card?.type && /spell/i.test(card.type);
}

function isUnit(card: CardInstance | null | undefined): boolean {
  return !!card?.type && /unit/i.test(card.type);
}

function isGear(card: CardInstance | null | undefined): boolean {
  return !!card?.type && /gear/i.test(card.type);
}

/** `858709 b` — client chain entry id, verbatim shape. */
export function clientChainEntryId(playerId: string, cardId: string): string {
  const uuid =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `chain-${playerId}-${cardId}-${uuid}`;
}

/** `o` — default chain destination (flow-enabled spells go to banished). */
export function defaultChainDestination(entry: { flowEnabled?: boolean; card: CardInstance }): "banished" | "trash" {
  return entry.flowEnabled && isSpell(entry.card) ? "banished" : "trash";
}

/** Original `de(zone, card)` — can this card be added to the chain? */
export function isChainAddable(zone: string, card: CardInstance): boolean {
  if (zone === "trash" || zone === "banished" || zone === "runeArea") return false;
  if (zone === "runeDeck" || zone === "deck") return false;
  return true;
}

/** `dN.j` — zones that play the `card_play` sound when dropped onto. */
export function isPlayZone(zone: string): boolean {
  return zone === "base" || BATTLEFIELD_ZONES.has(zone);
}

function move(from: Zone, to: Zone, cardId: string, toIndex?: number, asHidden?: boolean): GameActionIntent {
  return {
    type: "move_card",
    from,
    to,
    cardId,
    ...(typeof toIndex === "number" ? { toIndex } : {}),
    ...(asHidden ? { asHidden: true } : {}),
  } as GameActionIntent;
}

function chainAdd(from: Zone | "battlefieldMarker", cardId: string, actorPlayerId: string, battlefieldZone?: Zone): GameActionIntent {
  return {
    type: "chain_add",
    from,
    cardId,
    clientEntryId: clientChainEntryId(actorPlayerId, cardId),
    ...(battlefieldZone ? { battlefieldZone } : {}),
  } as GameActionIntent;
}

/**
 * Build the exact wire intent for one drop. Returns null when the drop has no
 * legal mapping (the caller then leaves the origin in place).
 */
export function buildDropIntent(input: DropIntentInput): GameActionIntent | null {
  const { source, targetZone, targetOwner, actorPlayerId, shiftKey = false } = input;

  if (targetZone === "chain") {
    if (source.kind === "boardCard") {
      const payload = source.payload as { zone: Zone; cardId: string; hidden?: boolean };
      const card = source.card ?? null;
      if (card && (!isChainAddable(payload.zone, card) || payload.hidden)) return null;
      return chainAdd(payload.zone, payload.cardId, actorPlayerId);
    }
    if (source.kind === "battlefieldMarker") {
      const payload = source.payload as { zone: Zone; cardId: string };
      return chainAdd("battlefieldMarker", payload.cardId, actorPlayerId, payload.zone);
    }
    if (source.kind === "mainDeckCard" || source.kind === "deckPeekCard") {
      const payload = source.payload as { cardId: string };
      return chainAdd("deck", payload.cardId, actorPlayerId);
    }
    if (source.kind === "chainEntry") return null;
  }

  if (source.kind === "chainEntry") {
    const payload = source.payload as { entryId: string };
    if (targetZone === "mainDeck" || targetZone === "runeDeck" || targetZone === "chain" || targetZone === "legend") {
      return null;
    }
    const to =
      targetZone === "trash"
        ? shiftKey
          ? "banished"
          : "trash"
        : targetZone === "banished"
          ? "banished"
          : targetZone === "hand"
            ? "hand"
            : targetZone;
    return { type: "chain_resolve", entryId: payload.entryId, to } as GameActionIntent;
  }

  if (source.kind === "battlefieldMarker") {
    return null;
  }

  if (source.kind === "mainDeckCard" || source.kind === "deckPeekCard") {
    const payload = source.payload as { cardId: string };
    const position = targetZone === "mainDeck" ? (shiftKey ? "top" : "bottom") : null;
    if (position) {
      return { type: "send_to_deck", from: "deck", cardId: payload.cardId, position } as GameActionIntent;
    }
    if (targetZone === "runeDeck") return null;
    if (targetZone === "runeArea") {
      return { type: "draw_rune", exhausted: false } as GameActionIntent;
    }
    if (targetZone === "trash") {
      if (source.kind === "mainDeckCard") {
        return { type: "take_top_from_deck", to: shiftKey ? "banished" : "trash" } as GameActionIntent;
      }
      return { type: "take_card_from_deck", cardId: payload.cardId, to: shiftKey ? "banished" : "trash" } as GameActionIntent;
    }
    if (targetZone === "banished") {
      return { type: "take_card_from_deck", cardId: payload.cardId, to: "banished" } as GameActionIntent;
    }
    if (isZone(targetZone)) {
      if (targetZone === "champion") return null;
      return {
        type: "take_card_from_deck",
        cardId: payload.cardId,
        to: targetZone,
        ...(typeof input.toIndex === "number" ? { toIndex: input.toIndex } : {}),
      } as GameActionIntent;
    }
    return null;
  }

  if (source.kind !== "boardCard") return null;

  const payload = source.payload as { zone: Zone; cardId: string; hidden?: boolean };
  const card = source.card ?? null;
  const from = payload.zone;
  const cardId = payload.cardId;
  const target = targetZone as string;
  if (!isZone(target) && target !== "mainDeck" && target !== "runeDeck") {
    return null;
  }
  if (from === "runeArea" && target !== "runeArea" && target !== "runeDeck") return null;

  if (target === "mainDeck") {
    return { type: "send_to_deck", from, cardId, position: shiftKey ? "top" : "bottom" } as GameActionIntent;
  }

  if (target === "runeDeck") {
    if (from === "runeArea") {
      return { type: "send_to_rune_deck", from: "runeArea", cardId, position: "bottom" } as GameActionIntent;
    }
    return null;
  }

  if (target === "trash") {
    return move(from, shiftKey ? "banished" : "trash", cardId);
  }
  if (target === "banished") {
    return move(from, "banished", cardId);
  }
  if (target === "runeArea") {
    return from === "runeArea" ? move(from, "runeArea", cardId, input.toIndex) : null;
  }
  if (target === "legend") return null;

  const targetCard = input.targetCard ?? null;
  if (
    card &&
    isGear(card) &&
    targetCard &&
    targetCard.id !== cardId &&
    isUnit(targetCard) &&
    (target === "base" || isBattlefieldDropZone(target))
  ) {
    return {
      type: "equip_card",
      equipmentCardId: cardId,
      unitCardId: targetCard.id,
      ...(from === "hand" ? { asAttachment: true } : {}),
    } as GameActionIntent;
  }

  // Spells dragged out of the hand (or another playable zone) go onto the chain
  // rather than onto the board (`dN.a` / `tc` in the original drop handler).
  if (card && isSpell(card) && !card.hidden && target !== "hand") {
    return chainAdd(from, cardId, actorPlayerId);
  }

  return move(from, target as Zone, cardId, input.toIndex, input.asHidden);
}
