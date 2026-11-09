/**
 * Soft-lock audit: prompts whose options the strict board cannot click — docs/rules/edge-cases-audit.md
 * ("Soft-lock risks").
 *
 * The strict UI (apps/play) answers object prompts (`choose-target`, `choose-card`,
 * `choose-battlefield`, `choose-player`) by clicking the board, and hides the dialog whenever
 * one option is a card it can find in the (per-viewer) room. The prompted player's own Main Deck
 * and Trash are visible to them, so prompts whose options all live there are routed to board-click
 * mode although no deck/trash card is clickable. In multiplayer rooms clicks on the opponent's
 * cards are also dropped before the prompt branch. These tests pin the ENGINE side of each case
 * (the prompt shape a real card produces, and that a plain `rules_choose` answer works), so the UI
 * fix described in the audit can be checked against real prompts.
 */
import { describe, expect, it } from "vitest";
import type { Prompt } from "@rift/protocol";
import { withCards, addPool } from "../cards/helpers";
import { scenario } from "../scenarios/dsl";
import { boardOf, CLICKABLE_ZONES, optionLocations, placeUnit, setControl, type S } from "./helpers";

const ALL_POWER = { Fury: 2, Calm: 2, Mind: 2, Body: 2, Chaos: 2, Order: 2 } as const;

/** Play `name` from p1's hand and pass Priority until a prompt for p1 opens. */
function playUntilPrompt(s: S, name: string): Prompt {
  addPool(s, "p1", 12, { ...ALL_POWER });
  const card = s.handCard("p1", name)!;
  s.as("p1").apply({ type: "rules_play", cardId: card.id, optionalCosts: [] } as never).expectOk();
  for (let step = 0; step < 10 && !s.room.rules?.prompt; step += 1) {
    const holder = s.room.rules?.priority;
    if (!holder) break;
    s.as(holder).pass().expectOk();
  }
  const prompt = s.room.rules?.prompt;
  if (!prompt) throw new Error(`${name}: no prompt opened`);
  return prompt;
}

/** Move up to `count` cards of `names` from p1's hand/deck into p1's trash. */
function stockTrash(s: S, names: string[]): void {
  const board = boardOf(s, "p1");
  for (const name of names) {
    const index = board.deck.findIndex((card) => card.name === name);
    if (index >= 0) board.trash.push(...board.deck.splice(index, 1));
  }
}

describe("prompts whose every option is in the player's own Main Deck [R411.2][R355.18]", () => {
  it("[R411.2][R355.18][C:Stacked Deck] SOFT-LOCK INPUT: a min-1 pick among the looked-at cards offers only Main Deck cards; rules_choose answers it", () => {
    const s = withCards(["Stacked Deck"]);
    const prompt = playUntilPrompt(s, "Stacked Deck");
    expect(prompt).toMatchObject({ kind: "choose-card", playerId: "p1", min: 1, max: 1 });
    const locations = optionLocations(s, prompt);
    expect(locations).toHaveLength(3);
    expect(locations.every((entry) => entry.owner === "p1" && entry.zone === "deck")).toBe(true);
    expect(locations.some((entry) => CLICKABLE_ZONES.has(entry.zone ?? ""))).toBe(false);
    // The engine side is fine: answering with the option id keeps that card.
    const kept = prompt.options![1]!;
    s.as("p1").choose({ optionIds: [kept.id] }).expectOk();
    expect(boardOf(s, "p1").hand.some((card) => card.id === (kept.cardId ?? kept.id))).toBe(true);
  });

  it("[R411.2][C:Called Shot] SOFT-LOCK INPUT: Called Shot's pick is also a min-1 choice among Main Deck cards only", () => {
    const s = withCards(["Called Shot"]);
    const prompt = playUntilPrompt(s, "Called Shot");
    expect(prompt.kind).toBe("choose-card");
    expect(prompt.min).toBe(1);
    expect(optionLocations(s, prompt).every((entry) => entry.zone === "deck")).toBe(true);
  });

  it("[R437.1][R817.1.b] Predict/Vision prompts offer only Main Deck cards (min 0): Skip works, recycling has no click target", () => {
    const s = withCards(["Lightning Rush"]);
    const prompt = playUntilPrompt(s, "Lightning Rush");
    expect(prompt.kind).toBe("choose-card");
    expect(prompt.min).toBe(0);
    expect(optionLocations(s, prompt).every((entry) => entry.zone === "deck")).toBe(true);
  });
});

describe("prompts whose every option is in the player's own Trash [R411.2][R355.7]", () => {
  it("[R411.2][R355.7][C:Morbid Return] SOFT-LOCK INPUT: \"Return a unit from your trash\" targets only Trash cards (min 1); rules_choose answers it", () => {
    const s = withCards(["Morbid Return"]);
    stockTrash(s, ["Treasure Hunter", "Clockwork Keeper"]);
    const prompt = playUntilPrompt(s, "Morbid Return");
    expect(prompt).toMatchObject({ kind: "choose-target", min: 1, max: 1 });
    const locations = optionLocations(s, prompt);
    expect(locations.length).toBeGreaterThanOrEqual(2);
    expect(locations.every((entry) => entry.owner === "p1" && entry.zone === "trash")).toBe(true);
    const chosen = prompt.options![0]!;
    s.as("p1").choose({ optionIds: [chosen.id] }).expectOk();
    for (let step = 0; step < 4 && s.room.rules!.chain.length > 0; step += 1) {
      s.as(s.room.rules!.priority!).pass().expectOk();
    }
    expect(boardOf(s, "p1").hand.some((card) => card.id === (chosen.cardId ?? chosen.id))).toBe(true);
  });

  it("[R411.2][C:Cemetery Attendant] SOFT-LOCK INPUT: the play trigger's target is a Trash card (min 1)", () => {
    const s = withCards(["Cemetery Attendant"]);
    stockTrash(s, ["Treasure Hunter", "Clockwork Keeper"]);
    const prompt = playUntilPrompt(s, "Cemetery Attendant");
    expect(prompt.min).toBe(1);
    expect(optionLocations(s, prompt).every((entry) => entry.zone === "trash")).toBe(true);
  });
});

describe("prompts whose options are the opponent's units [R411.2][R355.7]", () => {
  it("[R411.2][R355.7][C:Gust] a targeted Reaction played without a bound target asks for a unit; every option is an enemy unit", () => {
    const s = scenario({ p1: { hand: ["Gust"], energy: 1 } });
    placeUnit(s, "p2", "Treasure Hunter", "battlefieldA", "enemy-1");
    placeUnit(s, "p2", "Caitlyn, Patrolling", "battlefieldA", "enemy-2");
    setControl(s.room, "battlefieldA", "p2");
    s.as("p1").play("Gust").expectOk();
    const prompt = s.room.rules!.prompt!;
    expect(prompt).toMatchObject({ kind: "choose-target", playerId: "p1", min: 1, max: 1 });
    const owners = optionLocations(s, prompt).map((entry) => entry.owner);
    expect(owners.every((owner) => owner === "p2")).toBe(true);
    s.as("p1").choose({ optionIds: ["enemy-1"] }).expectOk();
    expect(s.room.rules!.prompt).toBe(null);
  });
});
