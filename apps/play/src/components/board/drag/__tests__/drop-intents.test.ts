import { describe, expect, it } from "vitest";

import type { CardInstance } from "@rift/protocol";

import {
  buildDropIntent,
  clientChainEntryId,
  defaultChainDestination,
  isChainAddable,
} from "../drop-intents";
import type { DragKind, DragPayload } from "../drag-types";

function card(overrides: Partial<CardInstance> = {}): CardInstance {
  return {
    id: "card_1",
    name: "Rebuke",
    source: "mainDeck",
    exhausted: false,
    createdAt: 0,
    type: "Spell",
    ...overrides,
  };
}

function source(kind: DragKind, payload: DragPayload, cardValue: CardInstance | null = null) {
  return { kind, payload, card: cardValue };
}

const base = {
  viewerId: "p1",
  actorPlayerId: "p1",
  targetOwner: "self" as const,
};

describe("drop intent mapping", () => {
  it("plays a hand card to base", () => {
    const intent = buildDropIntent({
      ...base,
      source: source("boardCard", { zone: "hand", cardId: "card_1", exhausted: false, hidden: false }, card({ type: "Unit" })),
      targetZone: "base",
    });
    expect(intent).toEqual({ type: "move_card", from: "hand", to: "base", cardId: "card_1" });
  });

  it("plays a hand card to a battlefield", () => {
    const intent = buildDropIntent({
      ...base,
      source: source("boardCard", { zone: "hand", cardId: "card_1", exhausted: false, hidden: false }, card({ type: "Unit" })),
      targetZone: "battlefieldA",
    });
    expect(intent).toEqual({ type: "move_card", from: "hand", to: "battlefieldA", cardId: "card_1" });
  });

  it("gear dropped on a unit becomes equip_card", () => {
    const gear = card({ id: "gear_1", name: "Blade", type: "Unit Gear" });
    const unit = card({ id: "unit_1", name: "Recruit", type: "Unit" });
    const intent = buildDropIntent({
      ...base,
      source: source("boardCard", { zone: "hand", cardId: "gear_1", exhausted: false, hidden: false }, gear),
      targetZone: "base",
      targetCard: unit,
    });
    expect(intent).toEqual({
      type: "equip_card",
      equipmentCardId: "gear_1",
      unitCardId: "unit_1",
      asAttachment: true,
    });
  });

  it("drops spells onto the chain instead of the board", () => {
    const intent = buildDropIntent({
      ...base,
      source: source("boardCard", { zone: "hand", cardId: "card_1", exhausted: false, hidden: false }, card()),
      targetZone: "base",
    });
    expect(intent?.type).toBe("chain_add");
  });

  it("reorders within hand with toIndex", () => {
    const intent = buildDropIntent({
      ...base,
      source: source("boardCard", { zone: "hand", cardId: "card_1", exhausted: false, hidden: false }, card()),
      targetZone: "hand",
      toIndex: 3,
    });
    expect(intent).toEqual({ type: "move_card", from: "hand", to: "hand", cardId: "card_1", toIndex: 3 });
  });

  it("trash drop uses banished with shift", () => {
    const sourceCard = source("boardCard", { zone: "battlefieldA", cardId: "card_1", exhausted: false, hidden: false }, card({ type: "Unit" }));
    expect(buildDropIntent({ ...base, source: sourceCard, targetZone: "trash" })).toEqual({
      type: "move_card",
      from: "battlefieldA",
      to: "trash",
      cardId: "card_1",
    });
    expect(buildDropIntent({ ...base, source: sourceCard, targetZone: "trash", shiftKey: true })).toEqual({
      type: "move_card",
      from: "battlefieldA",
      to: "banished",
      cardId: "card_1",
    });
  });

  it("deck drop defaults to bottom and shift puts it on top", () => {
    const sourceCard = source("boardCard", { zone: "hand", cardId: "card_1", exhausted: false, hidden: false }, card());
    expect(buildDropIntent({ ...base, source: sourceCard, targetZone: "mainDeck" })).toEqual({
      type: "send_to_deck",
      from: "hand",
      cardId: "card_1",
      position: "bottom",
    });
    expect(buildDropIntent({ ...base, source: sourceCard, targetZone: "mainDeck", shiftKey: true })).toEqual({
      type: "send_to_deck",
      from: "hand",
      cardId: "card_1",
      position: "top",
    });
  });

  it("drops onto the chain produce chain_add with a client entry id", () => {
    const intent = buildDropIntent({
      ...base,
      source: source("boardCard", { zone: "hand", cardId: "card_1", exhausted: false, hidden: false }, card()),
      targetZone: "chain",
    });
    expect(intent?.type).toBe("chain_add");
    if (intent?.type === "chain_add") {
      expect(intent.from).toBe("hand");
      expect(intent.cardId).toBe("card_1");
      expect(intent.clientEntryId).toMatch(/^chain-p1-card_1-/);
    }
  });

  it("battlefield markers add the battlefield itself to the chain", () => {
    const intent = buildDropIntent({
      ...base,
      source: source("battlefieldMarker", { zone: "battlefieldA", cardId: "battlefield-marker:battlefieldA" }),
      targetZone: "chain",
    });
    expect(intent).toMatchObject({
      type: "chain_add",
      from: "battlefieldMarker",
      battlefieldZone: "battlefieldA",
    });
  });

  it("main-deck cards take_card_from_deck to a board zone", () => {
    const intent = buildDropIntent({
      ...base,
      source: source("mainDeckCard", { cardId: "card_9" }),
      targetZone: "base",
    });
    expect(intent).toEqual({ type: "take_card_from_deck", cardId: "card_9", to: "base" });
  });

  it("chain entries resolve to the dropped destination", () => {
    const intent = buildDropIntent({
      ...base,
      source: source("chainEntry", { entryId: "chain_1" }),
      targetZone: "hand",
    });
    expect(intent).toEqual({ type: "chain_resolve", entryId: "chain_1", to: "hand" });
  });

  it("does not move rune cards out of the rune area", () => {
    const rune = card({ id: "rune_1", source: "rune", type: "Rune" });
    const intent = buildDropIntent({
      ...base,
      source: source("boardCard", { zone: "runeArea", cardId: "rune_1", exhausted: false, hidden: false }, rune),
      targetZone: "hand",
    });
    expect(intent).toBeNull();
  });

  it("creates the verbatim chain entry id shape", () => {
    expect(clientChainEntryId("p1", "card_1")).toMatch(/^chain-p1-card_1-[0-9a-z-]+$/i);
  });

  it("flow-enabled spells go to banished", () => {
    const entry = { card: card(), flowEnabled: true };
    expect(defaultChainDestination(entry)).toBe("banished");
    expect(defaultChainDestination({ card: card(), flowEnabled: false })).toBe("trash");
  });

  it("chain addability excludes trash/banished/runeArea/deck", () => {
    expect(isChainAddable("hand", card())).toBe(true);
    expect(isChainAddable("base", card())).toBe(true);
    expect(isChainAddable("trash", card())).toBe(false);
    expect(isChainAddable("banished", card())).toBe(false);
    expect(isChainAddable("runeArea", card())).toBe(false);
    expect(isChainAddable("deck", card())).toBe(false);
  });
});
