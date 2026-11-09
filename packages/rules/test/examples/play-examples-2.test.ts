/**
 * More official play examples (355.17, 357.3, 358.3) — mandatory location requirements and
 * permissions of Limited plays (420.3), costs that would make the card's own choices illegal,
 * and the three-player battlefield limit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Room } from "@rift/protocol";
import { initializeStrictRules } from "../../src";
import { clearCardScripts, overrideAdditionalCosts, registerTestCardScript } from "../../src/testing";
import type { RulesContext, RulesHost } from "../../src/host";
import { planCardPlay } from "../../src/play/process";
import { createInitialGameState } from "../../../engine/src/index";
import { createEngineRulesHost } from "../../../engine/src/strict/host";
import { deterministicContext } from "../scenarios/dsl";
import { loadFixtureDecks } from "../fixtures/decks";
import * as fake from "../rules/play/fake-effects";
import { bareScenario, place, toHand } from "../rules/play/helpers";

vi.mock("../../src/effects/choices", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/effects/choices")>();
  const f = await import("../rules/play/fake-effects");
  return { ...actual, requiredChoices: f.requiredChoices, validateChoices: f.validateChoices };
});

beforeEach(() => fake.resetFakes());
afterEach(() => clearCardScripts());

const BARE = { choices: {}, optionalCosts: [] };

describe("mandatory requirements and permissions [R355.17][R355.2.b][R420.3]", () => {
  it("[EX:355.17] Here to Help: a unit played “to a battlefield you control” must go there", () => {
    const s = bareScenario();
    place(s, "p1", "Stellacorn Herder", "battlefieldA");
    const unit = toHand(s, "p1", "Treasure Hunter");
    const limited = { permission: { id: "effect", rule: "420.3", ignoreAll: true }, requiredLocations: ["battlefieldA", "battlefieldB"] };
    // Only battlefieldA is a controlled battlefield, so it is the one valid location.
    expect(planCardPlay(s.room, "p1", unit.id, BARE, s.host, limited)).toMatchObject({ ok: true, location: "battlefieldA" });
    expect(planCardPlay(s.room, "p1", unit.id, { ...BARE, location: "base" }, s.host, limited)).toMatchObject({
      ok: false,
      code: "invalid_location",
    });
  });

  it("[EX:355.17] Rek'Sai: “you may play it here” adds a location without requiring it (355.2.b)", () => {
    const s = bareScenario();
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    const unit = toHand(s, "p1", "Treasure Hunter");
    const limited = { permission: { id: "effect", rule: "420.3", ignoreAll: true }, extraLocations: ["battlefieldB"] };
    expect(planCardPlay(s.room, "p1", unit.id, { ...BARE, location: "battlefieldB" }, s.host, limited)).toMatchObject({ ok: true });
    expect(planCardPlay(s.room, "p1", unit.id, BARE, s.host, limited)).toMatchObject({ ok: true, location: "base" });
    // Without the permission battlefieldB is not a valid location.
    expect(planCardPlay(s.room, "p1", unit.id, { ...BARE, location: "battlefieldB" }, s.host, { permission: limited.permission })).toMatchObject({
      ok: false,
      code: "invalid_location",
    });
  });
});

describe("paying costs [R357.3]", () => {
  function setupEnGarde(units: number) {
    const s = bareScenario({ p1: { energy: 1 } });
    const friendly = Array.from({ length: units }, (_, index) => place(s, "p1", index === 0 ? "Treasure Hunter" : "Stellacorn Herder", "base"));
    registerTestCardScript({ name: "En Garde", text: "test", status: "implemented", abilities: [fake.fakeAbility("En Garde")] });
    // "Give a friendly unit +2 Might" (a target) with "you may kill a friendly unit as an additional cost".
    fake.setSpecs("En Garde", (room, host) => [fake.anyUnitSpec(room, host)]);
    const off = overrideAdditionalCosts("En Garde", [
      { id: "optional:0", optional: true, cost: { kill: { cardType: "unit", controller: "self" } }, rule: "356.2.b.1" },
    ]);
    const card = toHand(s, "p1", "En Garde");
    return { s, friendly, card, off };
  }

  it("[EX:357.3] a kill cost must spare the chosen target when another unit can pay", () => {
    const { s, friendly, card, off } = setupEnGarde(2);
    try {
      const [target, other] = friendly as [typeof friendly[0], typeof friendly[0]];
      expect(
        s.as("p1").apply({ type: "rules_play", cardId: card.id, targets: [target.id], optionalCosts: ["optional:0"], plan: { kill: [target.id] } }).lastError(),
      ).toEqual({ code: "invalid_payment", rule: "357.3" });
      s.as("p1").apply({ type: "rules_play", cardId: card.id, targets: [target.id], optionalCosts: ["optional:0"], hold: true }).expectOk();
      expect(s.host.findCard(s.room, other.id)?.zone).toBe("trash");
      expect(s.host.findCard(s.room, target.id)?.zone).toBe("base");
    } finally {
      off();
    }
  });

  it("[R357.3] with no other choice the targeted unit may pay the cost", () => {
    const { s, friendly, card, off } = setupEnGarde(1);
    try {
      s.as("p1").apply({ type: "rules_play", cardId: card.id, targets: [friendly[0]!.id], optionalCosts: ["optional:0"], hold: true }).expectOk();
      expect(s.host.findCard(s.room, friendly[0]!.id)?.zone).toBe("trash");
    } finally {
      off();
    }
  });
});

function threePlayerRoom(): { room: Room; ctx: RulesContext; host: RulesHost } {
  const decks = loadFixtureDecks();
  const ctx = deterministicContext(737373);
  const room = createInitialGameState({
    roomCode: "RULES-PLAY-3P",
    createdAt: ctx.now,
    phase: "in_game",
    gameVariant: "free_for_all_3",
    roomMode: "multiplayer",
    shuffleDecks: false,
    players: ["p1", "p2", "p3"].map((id, index) => ({
      id,
      name: `Player ${index + 1}`,
      submittedDeck: { sections: index === 0 ? decks.deckA.sections : decks.deckB.sections, raw: index === 0 ? decks.deckA.raw : decks.deckB.raw },
    })),
  });
  room.rulesMode = "strict";
  room.firstPlayerId = "p1";
  room.turnNumber = 1;
  room.activeTurnPlayerId = "p1";
  const host = createEngineRulesHost(ctx);
  return { room: initializeStrictRules(room, ctx, host), ctx, host };
}

describe("illegal states [R358.3][R451.2]", () => {
  it("[EX:358.3][R451.2] a Unit cannot be played to a battlefield with Units of two other players", () => {
    const { room, host } = threePlayerRoom();
    const board = (id: string) => room.players.find((player) => player.id === id)!.board!;
    const zone = host.battlefieldZones(room)[0]!;
    for (const id of ["p2", "p3"]) {
      const unit = board(id).deck.find((card) => card.name === "Stellacorn Herder")!;
      board(id).deck = board(id).deck.filter((card) => card.id !== unit.id);
      (board(id) as unknown as Record<string, unknown[]>)[zone]!.push({ ...unit, exhausted: false });
    }
    const mine = board("p1").deck.find((card) => card.name === "Treasure Hunter")!;
    board("p1").deck = board("p1").deck.filter((card) => card.id !== mine.id);
    board("p1").hand.push(mine);
    const limited = { permission: { id: "effect", rule: "420.3", ignoreAll: true }, extraLocations: [zone] };
    expect(planCardPlay(room, "p1", mine.id, { ...BARE, location: zone }, host, limited)).toMatchObject({
      ok: false,
      code: "invalid_location",
      rule: "451.2",
    });
  });

  it("[EX:358.3] a permanent is played to its controller's own Base", () => {
    const s = bareScenario({ p1: { energy: 2 } });
    const unit = toHand(s, "p1", "Treasure Hunter");
    s.as("p1").apply({ type: "rules_play", cardId: unit.id, location: "base" }).expectOk();
    expect(s.host.findCard(s.room, unit.id)).toMatchObject({ playerId: "p1", zone: "base" });
  });
});
