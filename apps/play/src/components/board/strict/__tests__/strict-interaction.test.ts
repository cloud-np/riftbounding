import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { applyGameAction, createInitialGameState, strictLegalIntents } from "@rift/engine";
import type { CardInstance, DeckSections, Prompt, Room } from "@rift/protocol";

import { buildDropIntent } from "../../drag/drop-intents";
import { engineCanDrop } from "../../drag/drop-legality";
import {
  canConfirmPromptSelection,
  gestureObjectIds,
  parseAmbiguousDetail,
  promptChooseIntent,
  promptHasBoardTargets,
  promptNeedsAccumulation,
  promptOptionForAction,
  promptOptionMatchIds,
  strictUseGesture,
  togglePromptSelection,
  withGestureAbility,
} from "../strict-interaction";

const DECKS = path.resolve(
  __dirname,
  "../../../../../../../packages/rules/test/fixtures/decks.json",
);
const decks = JSON.parse(fs.readFileSync(DECKS, "utf8")) as Record<
  "deckA" | "deckB",
  { raw: string; sections: DeckSections }
>;

let seed = 99;
const ctx = () => ({
  now: 1_760_000_000_000,
  rng: () => {
    seed = (1664525 * seed + 0x3c6ef35f) >>> 0;
    return seed / 0x100000000;
  },
  mode: "multiplayer" as const,
});

function inGame(rulesMode: "strict" | "sandbox" = "strict"): Room {
  let room = createInitialGameState({
    roomCode: "GESTURES",
    createdAt: 1,
    phase: "mulligan",
    shuffleDecks: false,
    hostPlayerId: "p1",
    players: [
      { id: "p1", name: "Alice", submittedDeck: decks.deckA, decklistRaw: decks.deckA.raw },
      { id: "p2", name: "Bob", submittedDeck: decks.deckB, decklistRaw: decks.deckB.raw },
    ],
  });
  room.firstPlayerId = "p1";
  if (rulesMode === "strict") room.rulesMode = "strict";
  for (const player of room.players) player.selectedBattlefield = "Bandle Tree";
  for (const actor of ["p1", "p2"]) {
    const result = applyGameAction(room, actor, { type: "submit_mulligan", cardIds: [] }, ctx());
    if (!result.ok) throw new Error(result.error);
    room = result.state;
  }
  return room;
}

function handCard(room: Room): CardInstance {
  return room.players[0]!.board!.hand[0]!;
}

function handDrop(
  room: Room,
  overrides: {
    to?: string;
    targetCard?: CardInstance | null;
    includeTarget?: boolean;
    asHidden?: boolean;
    cardIds?: string[];
    ability?: string;
    shiftKey?: boolean;
  } = {},
): ReturnType<typeof buildDropIntent> {
  const card = handCard(room);
  return buildDropIntent({
    source: {
      kind: "boardCard",
      payload: { zone: "hand", cardId: card.id, exhausted: false, hidden: false },
      card,
    },
    targetZone: (overrides.to ?? "base") as Parameters<typeof buildDropIntent>[0]["targetZone"],
    targetOwner: "self",
    viewerId: "p1",
    actorPlayerId: "p1",
    includeTarget: overrides.includeTarget ?? true,
    ...(overrides.targetCard !== undefined ? { targetCard: overrides.targetCard } : {}),
    ...(overrides.asHidden ? { asHidden: true } : {}),
    ...(overrides.cardIds ? { cardIds: overrides.cardIds } : {}),
    ...(overrides.ability ? { ability: overrides.ability } : {}),
    ...(overrides.shiftKey ? { shiftKey: true } : {}),
  });
}

describe("strict board gesture payloads (R4-gestures client)", () => {
  it("[R355.2] hand → Base sends move_card in both rooms; the engine plays it in strict", () => {
    const strict = inGame("strict");
    const sandbox = inGame("sandbox");
    const strictIntent = handDrop(strict);
    const sandboxIntent = handDrop(sandbox);
    expect(strictIntent).toEqual({
      type: "move_card",
      from: "hand",
      to: "base",
      cardId: handCard(strict).id,
    });
    expect(sandboxIntent).toEqual(strictIntent);
    const result = applyGameAction(strict, "p1", strictIntent!, ctx());
    expect(result.ok).toBe(true);
    expect(engineCanDrop(strict, "p1", strictIntent!)).toBe(true);
  });

  it("[R355.2] hand → battlefield sends the destination zone verbatim", () => {
    const room = inGame();
    const intent = handDrop(room, { to: "battlefieldA" });
    expect(intent).toMatchObject({
      type: "move_card",
      from: "hand",
      to: "battlefieldA",
      cardId: handCard(room).id,
    });
  });

  it("[R355.9] dropping a hand card on a board card adds targetCardId only in strict rooms", () => {
    const room = inGame();
    const unit = {
      id: "unit_target",
      name: "Recruit",
      source: "mainDeck" as const,
      exhausted: false,
      createdAt: 1,
      type: "Unit",
    };
    room.players[0]!.board!.base.push(unit);
    const strictTargeted = handDrop(room, { to: "base", targetCard: unit });
    expect(strictTargeted).toMatchObject({
      type: "move_card",
      from: "hand",
      to: "base",
      cardId: handCard(room).id,
      targetCardId: unit.id,
    });
    const sandboxTargeted = handDrop(room, {
      to: "base",
      targetCard: unit,
      includeTarget: false,
    });
    expect(sandboxTargeted).not.toHaveProperty("targetCardId");
  });

  it("[R355.9] a spell dropped on a card stays chain_add + targetCardId", () => {
    const room = inGame();
    const spell = room.players[0]!.board!.hand.find((card) => /spell/i.test(card.type ?? ""));
    if (!spell) return; // fixture hand varies with the deterministic shuffle
    const source = { zone: "hand" as const, cardId: spell.id, exhausted: false, hidden: false };
    const target = room.players[0]!.board!.base[0] ?? room.players[0]!.board!.hand[1]!;
    const intent = buildDropIntent({
      source: { kind: "boardCard", payload: source, card: spell },
      targetZone: "base",
      targetOwner: "self",
      viewerId: "p1",
      actorPlayerId: "p1",
      targetCard: target,
      includeTarget: true,
    });
    expect(intent).toMatchObject({ type: "chain_add", from: "hand", cardId: spell.id, targetCardId: target.id });
  });

  it("[R449] unit drag Base → battlefield sends move_card and the engine applies it", () => {
    const room = inGame();
    const p1 = room.players[0]!;
    const unit = p1.board!.hand.find((card) => /unit/i.test(card.type ?? ""))!;
    p1.board!.hand = p1.board!.hand.filter((card) => card.id !== unit.id);
    p1.board!.base.push({ ...unit, exhausted: false });
    const intent = buildDropIntent({
      source: {
        kind: "boardCard",
        payload: { zone: "base", cardId: unit.id, exhausted: false, hidden: false },
        card: unit,
      },
      targetZone: "battlefieldA",
      targetOwner: "self",
      viewerId: "p1",
      actorPlayerId: "p1",
    });
    expect(intent).toEqual({
      type: "move_card",
      from: "base",
      to: "battlefieldA",
      cardId: unit.id,
    });
    expect(applyGameAction(room, "p1", intent!, ctx()).ok).toBe(true);
  });

  it("[R144.3] a multi-Unit drag adds cardIds", () => {
    const room = inGame();
    const p1 = room.players[0]!;
    const units = p1.board!.hand.filter((card) => /unit/i.test(card.type ?? "")).slice(0, 2);
    if (units.length < 2) return;
    p1.board!.hand = p1.board!.hand.filter((card) => !units.some((unit) => unit.id === card.id));
    for (const unit of units) p1.board!.base.push({ ...unit, exhausted: false });
    const intent = buildDropIntent({
      source: {
        kind: "boardCard",
        payload: { zone: "base", cardId: units[0]!.id, exhausted: false, hidden: false },
        card: units[0]!,
      },
      targetZone: "battlefieldA",
      targetOwner: "self",
      viewerId: "p1",
      actorPlayerId: "p1",
      cardIds: units.map((unit) => unit.id),
    });
    expect(intent).toMatchObject({
      type: "move_card",
      from: "base",
      to: "battlefieldA",
      cardId: units[0]!.id,
      cardIds: units.map((unit) => unit.id),
    });
  });

  it("[R818.1.c.2] gear → Unit sends equip_card (ability only when disambiguated)", () => {
    const gear: CardInstance = {
      id: "gear_1",
      name: "Doran's Blade",
      source: "mainDeck",
      exhausted: false,
      createdAt: 1,
      type: "Unit Gear",
    };
    const unit: CardInstance = {
      id: "unit_1",
      name: "Recruit",
      source: "mainDeck",
      exhausted: false,
      createdAt: 1,
      type: "Unit",
    };
    const base = {
      source: {
        kind: "boardCard" as const,
        payload: { zone: "base" as const, cardId: gear.id, exhausted: false, hidden: false },
        card: gear,
      },
      targetZone: "base" as const,
      targetOwner: "self" as const,
      viewerId: "p1",
      actorPlayerId: "p1",
      targetCard: unit,
      includeTarget: true,
    };
    expect(buildDropIntent(base)).toEqual({
      type: "equip_card",
      equipmentCardId: gear.id,
      unitCardId: unit.id,
    });
    expect(buildDropIntent({ ...base, ability: "equip:1" })).toMatchObject({
      type: "equip_card",
      equipmentCardId: gear.id,
      unitCardId: unit.id,
      ability: "equip:1",
    });
  });

  it("[R811.1.b] Hide sends move_card with asHidden:true", () => {
    const room = inGame();
    const intent = handDrop(room, { to: "battlefieldA", asHidden: true });
    expect(intent).toMatchObject({
      type: "move_card",
      from: "hand",
      to: "battlefieldA",
      asHidden: true,
    });
  });

  it("[R376][R449] Use gestures are toggle_exhausted with expectedExhausted:false", () => {
    expect(strictUseGesture("legend", "legend_1")).toEqual({
      type: "toggle_exhausted",
      zone: "legend",
      cardId: "legend_1",
      expectedExhausted: false,
    });
    expect(strictUseGesture("runeArea", "rune_1", { ability: "rune:exhaust" })).toEqual({
      type: "toggle_exhausted",
      zone: "runeArea",
      cardId: "rune_1",
      expectedExhausted: false,
      ability: "rune:exhaust",
    });
    expect(strictUseGesture("base", "unit_1", { targetCardId: "unit_2" })).toMatchObject({
      type: "toggle_exhausted",
      zone: "base",
      cardId: "unit_1",
      targetCardId: "unit_2",
    });
  });

  it("[R403.3] parses the ambiguous_gesture detail into ability or mode choices", () => {
    expect(parseAmbiguousDetail("abilities: rune:exhaust, rune:recycle")).toEqual({
      kind: "ability",
      values: ["rune:exhaust", "rune:recycle"],
    });
    expect(parseAmbiguousDetail("mode: mode-a, mode-b")).toEqual({
      kind: "mode",
      values: ["mode-a", "mode-b"],
    });
    expect(parseAmbiguousDetail("something else")).toBeNull();
  });

  it("[R411.2] object-prompt helpers match board clicks, accumulate multi-selection and answer", () => {
    const room = inGame();
    const card = handCard(room);
    const prompt: Prompt = {
      id: "prompt-1",
      kind: "choose-card",
      playerId: "p1",
      options: [
        { id: card.id, cardId: card.id },
        { id: "battlefieldA", zone: "battlefieldA" },
      ],
      min: 1,
      max: 2,
    };
    expect(promptHasBoardTargets(room, prompt)).toBe(true);
    expect([...promptOptionMatchIds(prompt)]).toEqual(
      expect.arrayContaining([card.id, "battlefieldA"]),
    );
    expect(
      promptOptionForAction(prompt, { type: "toggle_exhausted", zone: "hand", cardId: card.id }),
    )?.toMatchObject({ id: card.id });
    expect(
      promptOptionForAction(prompt, { type: "move_card", from: "hand", to: "battlefieldA", cardId: "x" }),
    )?.toMatchObject({ id: "battlefieldA" });
    expect(promptNeedsAccumulation(prompt)).toBe(true);
    let selected = togglePromptSelection(prompt, [], card.id);
    selected = togglePromptSelection(prompt, selected, "battlefieldA");
    expect(selected).toEqual([card.id, "battlefieldA"]);
    expect(canConfirmPromptSelection(prompt, selected)).toBe(true);
    expect(togglePromptSelection(prompt, selected, card.id)).toEqual(["battlefieldA"]);
    expect(promptChooseIntent(prompt, selected)).toEqual({
      type: "rules_choose",
      promptId: "prompt-1",
      answer: { optionIds: [card.id, "battlefieldA"] },
    });
    expect(gestureObjectIds({ type: "move_card", cardId: card.id, to: "battlefieldA" })).toEqual([
      card.id,
      "battlefieldA",
    ]);
  });

  it("[R403.3] the ambiguity chooser resends the same gesture with the chosen ability", () => {
    const gesture = strictUseGesture("runeArea", "rune_1");
    expect(withGestureAbility(gesture, "rune:recycle")).toEqual({
      type: "toggle_exhausted",
      zone: "runeArea",
      cardId: "rune_1",
      expectedExhausted: false,
      ability: "rune:recycle",
    });
    expect(
      withGestureAbility(
        {
          type: "move_card",
          from: "base",
          to: "battlefieldA",
          cardId: "gear_1",
          targetCardId: "unit_1",
        } as never,
        "equip:0",
      ),
    ).toEqual({
      type: "toggle_exhausted",
      zone: "base",
      cardId: "gear_1",
      expectedExhausted: false,
      targetCardId: "unit_1",
      ability: "equip:0",
    });
  });

  it("[R411.2] a single-selection object prompt is answered by one click, not accumulation", () => {
    const room = inGame();
    const card = handCard(room);
    const prompt: Prompt = {
      id: "single",
      kind: "choose-target",
      playerId: "p1",
      options: [{ id: card.id, objectId: card.id }],
      min: 1,
      max: 1,
    };
    expect(promptNeedsAccumulation(prompt)).toBe(false);
    expect(togglePromptSelection(prompt, [], card.id)).toEqual([card.id]);
    expect(togglePromptSelection(prompt, [card.id], card.id)).toEqual([]);
    expect(canConfirmPromptSelection(prompt, [card.id])).toBe(true);
    expect(promptHasBoardTargets(room, prompt)).toBe(true);
  });

  it("[R411.2] prompts without visible board options stay in the dialog", () => {
    const room = inGame();
    const prompt: Prompt = {
      id: "hidden",
      kind: "choose-card",
      playerId: "p1",
      options: [{ id: "__hidden_zone__:p2:hand:0", cardId: "__hidden_zone__:p2:hand:0" }],
      min: 1,
      max: 1,
    };
    expect(promptHasBoardTargets(room, prompt)).toBe(false);
    expect(promptOptionForAction(prompt, { type: "toggle_exhausted", zone: "base", cardId: "x" })).toBeNull();
  });

  it("[contract:§4] an illegal strict gesture is refused by the dry-run highlight", () => {
    const room = inGame();
    const card = handCard(room);
    const intent = {
      type: "move_card",
      from: "hand",
      to: "trash",
      cardId: card.id,
    } as const;
    expect(engineCanDrop(room, "p1", intent as never)).toBe(false);
  });

  it("multi-select fields are strict-only (sandbox keeps the old single-card payload)", () => {
    const room = inGame("sandbox");
    const intent = handDrop(room, {
      to: "battlefieldA",
      cardIds: ["a", "b"],
      includeTarget: false,
    });
    expect(intent).not.toHaveProperty("cardIds");
    expect(intent).not.toHaveProperty("targetCardId");
  });

  it("a board Unit dropped on a card at a battlefield keeps the target id", () => {
    const room = inGame();
    const p1 = room.players[0]!;
    const unit = p1.board!.hand.find((card) => /unit/i.test(card.type ?? ""))!;
    p1.board!.hand = p1.board!.hand.filter((card) => card.id !== unit.id);
    p1.board!.base.push({ ...unit, exhausted: false });
    const target = {
      id: "unit_target",
      name: "Recruit",
      source: "mainDeck" as const,
      exhausted: false,
      createdAt: 1,
      type: "Unit",
    };
    p1.board!.battlefieldA.push(target);
    const intent = buildDropIntent({
      source: {
        kind: "boardCard",
        payload: { zone: "base", cardId: unit.id, exhausted: false, hidden: false },
        card: unit,
      },
      targetZone: "battlefieldA",
      targetOwner: "self",
      viewerId: "p1",
      actorPlayerId: "p1",
      targetCard: target,
      includeTarget: true,
    });
    expect(intent).toMatchObject({
      type: "move_card",
      from: "base",
      to: "battlefieldA",
      cardId: unit.id,
      targetCardId: target.id,
    });
  });

  it("[R312] End turn stays the natural end_turn gesture (the engine maps it in strict rooms)", () => {
    const room = inGame();
    const legal = strictLegalIntents(room, "p1")!;
    expect(legal.canEndTurn).toBe(true);
    expect(applyGameAction(room, "p1", { type: "end_turn" }, ctx()).ok).toBe(true);
  });
});
