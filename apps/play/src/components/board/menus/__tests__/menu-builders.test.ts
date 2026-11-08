import { describe, expect, it } from "vitest";

import type { CardInstance } from "@rift/protocol";

import { buildCardMenu, buildHandMenu, buildPileMenu, buildZoneMenu } from "../menu-builders";

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

const base = {
  isSelf: true,
  canAct: true,
  targetingAvailable: false,
  hasTargetArrows: false,
  equipTargetAvailable: false,
  empowerable: false,
  revealAllowed: true,
  isNeeko: false,
  isOrianna: false,
};

describe("card context menu", () => {
  it("keeps the original board-card order and groups", () => {
    const entries = buildCardMenu({ ...base, zone: "base", card: card({ type: "Unit" }) });
    expect(entries.map((entry) => entry.id)).toEqual(["ping", "chain", "give-control", "trash", "banish", "reveal"]);
    expect(entries.map((entry) => entry.group)).toEqual([0, 1, 1, 2, 2, 3]);
  });

  it("omits banish for champion and adds play-hidden only for hidden champions", () => {
    const plain = buildCardMenu({ ...base, zone: "champion", card: card() });
    expect(plain.map((entry) => entry.id)).not.toContain("banish");
    expect(plain.map((entry) => entry.id)).not.toContain("play-hidden");
    const hidden = buildCardMenu({
      ...base,
      zone: "champion",
      card: card({ keywords: ["Hidden"] }),
    });
    expect(hidden.map((entry) => entry.id)).toContain("play-hidden");
  });

  it("rune cards only get ping + recycle", () => {
    const entries = buildCardMenu({ ...base, zone: "runeArea", card: card({ type: "Rune" }) });
    expect(entries.map((entry) => entry.id)).toEqual(["ping", "recycle"]);
  });

  it("adds target/clear/equip/empower/reveal/remove-buff rows", () => {
    const entries = buildCardMenu({
      ...base,
      zone: "battlefieldA",
      card: card({ type: "Unit", temporaryMightBuff: 2 }),
      targetingAvailable: true,
      hasTargetArrows: true,
      equipTargetAvailable: true,
      empowerable: true,
    });
    expect(entries.map((entry) => entry.id)).toEqual([
      "ping",
      "chain",
      "give-control",
      "trash",
      "banish",
      "target",
      "clear-targets",
      "equip",
      "empower",
      "reveal",
      "remove-buff",
    ]);
  });

  it("hand menu order is play → chain → trash/banish → reveal/auto-pay", () => {
    const entries = buildHandMenu({
      card: card({ revealedToOpponent: true }),
      canAct: true,
      autoPayAvailable: true,
      revealAllowed: true,
    });
    expect(entries.map((entry) => entry.id)).toEqual(["play", "chain", "trash", "banish", "reveal", "auto-pay"]);
    expect(entries.find((entry) => entry.id === "reveal")?.labelKey).toBe("sim.hideFromOpponent");
  });

  it("pile menu exposes draw / look / burn in the original order", () => {
    const entries = buildPileMenu({ slot: "mainDeck", owner: "self", count: 20, canAct: true });
    expect(entries.map((entry) => entry.id)).toEqual([
      "press",
      "look",
      "burn",
      "draw_main_deck",
      "look_main_deck",
      "look_bottom",
      "search_deck",
      "shuffle_deck",
      "shuffle_unrecycled",
      "context_burn_main_deck",
    ]);
    expect(entries.find((entry) => entry.id === "press")?.labelKey).toBe("sim.drawShortcut");
  });

  it("runes and hand zone menus use the original labels", () => {
    const runes = buildZoneMenu("runeArea", { owner: "self", canAct: true, hasRune: true });
    expect(runes.map((entry) => entry.id)).toEqual(["recycle_rune", "channel_rune_deck"]);
    const hand = buildZoneMenu("hand", { owner: "self", canAct: true, handRevealed: false });
    expect(hand.map((entry) => entry.id)).toEqual(["hand_reveal", "hand_draw"]);
  });
});
