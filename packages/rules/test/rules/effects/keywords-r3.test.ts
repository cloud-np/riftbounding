/**
 * R3-engine: Show Off (832) and Flow (829).
 *
 * The scripts below are registered by this suite only (the set folders belong to the card
 * agents); each reproduces the printed text of the cited card.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import { explainIllegal, legalIntents } from "../../../src";
import { SHOWED_OFF, aUnit, showOff, WHEN_PLAYED } from "../../../src/cards/sdk";
import { scenario } from "../../scenarios/dsl";
import { boardOf, fund, place, run, zoneOf } from "./helpers";
import { registerTestCardScripts } from "../../../src/testing";

type S = ReturnType<typeof scenario>;

function withCards(p1: string[], p2: string[] = []): S {
  const s = scenario({ extraCards: { p1, p2 } });
  for (const [player, names] of [["p1", p1], ["p2", p2]] as const) {
    const wanted: Record<string, number> = {};
    for (const name of names) wanted[name] = (wanted[name] ?? 0) + 1;
    for (const [name, count] of Object.entries(wanted)) {
      const inHand = boardOf(s, player).hand.filter((card) => card.name === name).length;
      for (let index = inHand; index < count; index += 1) s.moveDeckCardToHand(player, name);
    }
  }
  return s;
}

/** Pass with whoever holds Priority until the chain is empty. */
function resolveChain(s: S): void {
  for (let guard = 0; guard < 10 && s.room.rules!.chain.length > 0; guard += 1) {
    const holder = s.room.rules!.priority;
    if (!holder) break;
    s.as(holder).pass().expectOk();
  }
}

/** Move a hand card to its owner's trash (setup only). */
function toTrash(s: S, player: string, name: string): string {
  const board = boardOf(s, player);
  const index = board.hand.findIndex((card) => card.name === name);
  const [card] = board.hand.splice(index, 1);
  board.trash.push(card!);
  return card!.id;
}

const PRIMORDIAL_ROAR: CardScript = {
  name: "Primordial Roar",
  text: "[Show Off] a unit.\nIf you showed off a unit, deal damage equal to that unit's Might to a unit.",
  status: "implemented",
  abilities: [
    showOff({ cardType: "unit" }),
    {
      kind: "spell",
      effect: { op: "if", condition: SHOWED_OFF, then: { op: "deal", amount: { kind: "shown-off", property: "might" }, target: aUnit() } },
    },
  ],
};

const GUTTER_GUARDIAN: CardScript = {
  name: "Gutter Guardian",
  text: "[Hidden]\n[Show Off] a card with [Hidden].\nWhen you play me, if you showed off, [Add] [Rune].",
  status: "partial",
  abilities: [
    showOff({ keyword: "Hidden" }),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: SHOWED_OFF,
      effect: { op: "add", resources: { power: { any: 1 } } },
    },
  ],
};

const DREDGE_UP: CardScript = {
  name: "Dredge Up",
  text: "Draw 1.\n[Flow][2]",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "draw", amount: 1 } }],
};

const BRITTLE_STEEL: CardScript = {
  name: "Brittle Steel",
  text: "Kill a gear.\n[Flow][4][Fury]",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "kill", target: { chosen: true, cardType: "gear" } } }],
};

beforeAll(() => registerTestCardScripts([PRIMORDIAL_ROAR, GUTTER_GUARDIAN, DREDGE_UP, BRITTLE_STEEL]));

describe("Show Off [R832]", () => {
  it("[R832.1.c][R832.1.c.2][C:Primordial Roar] showing off is a play-time choice among hand cards and friendly board objects", () => {
    const s = withCards(["Primordial Roar", "Whiteflame Protector"]);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base");
    const enemy = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    fund(s, "p1", "Primordial Roar");
    s.as("p1").play("Primordial Roar", { choices: { "target:0": enemy.id } }).expectOk();
    const prompt = s.expectPrompt("choose-card", "p1").room.rules!.prompt!;
    expect(prompt).toMatchObject({ rule: "832.1.c", min: 0 });
    const offered = prompt.options!.map((option) => option.id);
    const inHand = boardOf(s, "p1").hand.find((card) => card.name === "Whiteflame Protector")!;
    expect(offered).toContain(friend.id);
    expect(offered).toContain(inHand.id);
    expect(offered).not.toContain(enemy.id);
    // 832.1.c / 425: showing off a card from hand reveals it.
    s.as("p1").choose({ optionIds: [inHand.id] }).expectOk();
    expect(s.events().some((event) => event.type === "reveal" && event.cardId === inHand.id)).toBe(true);
    s.as("p2").pass().expectOk();
    // Whiteflame Protector has 8 [M]: the enemy takes 8.
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[R832.1.d][R832.1.d.1][EX:832.1.d.1][C:Primordial Roar][C:Frigid Touch] the shown-off unit's Might is noted when shown off", () => {
    const s = withCards(["Primordial Roar"]);
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.objects[friend.id] = { ...(s.room.rules!.objects[friend.id] ?? {}), temporaryMight: 1 };
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Primordial Roar");
    s.as("p1").play("Primordial Roar", { choices: { showOff: [friend.id], "target:0": enemy.id } }).expectOk();
    expect(s.room.rules!.chain.at(-1)?.choices.$showOff).toMatchObject({ ids: [friend.id], might: 4 });
    // In reaction the friendly unit gets -2 [M] this turn (Frigid Touch): it still deals 4.
    s.room.rules!.objects[friend.id]!.temporaryMight = -1;
    s.as("p2").pass().expectOk();
    expect(s.events().find((event) => event.type === "damage")?.amount).toBe(4);
    expect(zoneOf(s, enemy.id)).toBe("trash");
  });

  it("[R832.1.c.1] without showing off, the linked instruction does nothing", () => {
    const s = withCards(["Primordial Roar"]);
    place(s, "p1", "Caitlyn, Patrolling", "base");
    const enemy = place(s, "p2", "Stellacorn Herder", "battlefieldA");
    fund(s, "p1", "Primordial Roar");
    s.as("p1").play("Primordial Roar", { choices: { showOff: [], "target:0": enemy.id } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");
    expect(s.room.rules!.objects[enemy.id]?.damage).toBeUndefined();
  });

  it("[R832.1.b.1][R832.1.c.1][C:Gutter Guardian][C:Zhonya's Hourglass] a permanent remembers that it showed off for its play effect", () => {
    const s = withCards(["Gutter Guardian", "Zhonya's Hourglass"]);
    fund(s, "p1", "Gutter Guardian");
    const zhonya = boardOf(s, "p1").hand.find((card) => card.name === "Zhonya's Hourglass")!;
    const ok = explainIllegal(
      s.room,
      "p1",
      { type: "rules_play", cardId: boardOf(s, "p1").hand.find((card) => card.name === "Gutter Guardian")!.id, choices: { showOff: ["nope"] } },
      s.host,
    );
    expect(ok).toMatchObject({ ok: false, code: "invalid_choice" });
    s.as("p1").play("Gutter Guardian", { choices: { showOff: [zhonya.id] } }).expectOk();
    const guardian = s.findBoardCard("Gutter Guardian")!;
    expect(s.room.rules!.objects[guardian.id]?.showOff).toMatchObject({ ids: [zhonya.id] });
    // The play trigger resolves: [Add] [Rune].
    resolveChain(s);
    expect(s.room.rules!.pools.p1!.power.any ?? 0).toBe(1);
  });
});

describe("Flow [R829]", () => {
  it("[R829.1.b][R829.1.c.1][C:Brittle Steel] a Flow spell may be played from its owner's trash for its Flow cost, then it is banished", () => {
    const s = withCards(["Brittle Steel"]);
    const steel = toTrash(s, "p1", "Brittle Steel");
    run(s, { op: "create", token: { name: "Gold" } }, { controller: "p2" });
    const gold = boardOf(s, "p2").base.find((card) => card.name.startsWith("Gold"))!;
    // The Flow cost [4][Fury] replaces the base cost [2][Fury] (829.1.c.1).
    s.room.rules!.pools.p1 = { energy: 4, power: { Fury: 1 } };
    const detail = legalIntents(s.room, "p1", s.host).playable?.find((entry) => entry.cardId === steel);
    expect(detail?.cost).toEqual({ energy: 4, power: 1 });
    s.as("p1").apply({ type: "rules_play", cardId: steel, choices: { "target:0": gold.id } }).expectOk();
    expect(s.room.rules!.pools.p1).toMatchObject({ energy: 0 });
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, gold.id)).toBeNull();
    // 829.1.b.1: banished instead of going to the trash.
    expect(zoneOf(s, steel)).toBe("banished");
  });

  it("[R829.1.b.2][C:Dredge Up] playing for the Flow cost does not change the spell's timing", () => {
    const s = withCards([], ["Dredge Up"]);
    const dredge = toTrash(s, "p2", "Dredge Up");
    s.room.rules!.pools.p2 = { energy: 2, power: {} };
    expect(explainIllegal(s.room, "p2", { type: "rules_play", cardId: dredge }, s.host).ok).toBe(false);
    expect(legalIntents(s.room, "p2", s.host).playableCardIds).not.toContain(dredge);
  });

  it("[R829.1.b.1][R426.1.a][C:Dredge Up] a countered Flow spell is banished; a hand-played one goes to the trash", () => {
    const s = withCards(["Dredge Up", "Dredge Up"]);
    const fromTrash = toTrash(s, "p1", "Dredge Up");
    s.room.rules!.pools.p1 = { energy: 4, power: { Mind: 1 } };
    s.as("p1").apply({ type: "rules_play", cardId: fromTrash, hold: true }).expectOk();
    const item = s.room.rules!.chain.at(-1)!;
    expect(item.leaveChainTo).toBe("banished");
    run(s, { op: "counter", target: { targetRef: `obj:${item.id}` } }, { controller: "p2" });
    expect(zoneOf(s, fromTrash)).toBe("banished");
    const inHand = boardOf(s, "p1").hand.find((card) => card.name === "Dredge Up")!;
    s.as("p1").play("Dredge Up").expectOk();
    s.as("p2").pass().expectOk();
    expect(zoneOf(s, inHand.id)).toBe("trash");
  });

  it("[R829.2][C:Kennen, Storm of Shuriken] a spell given [Flow] in the trash may be played for its cost this turn", () => {
    const s = withCards(["Primordial Roar"]);
    place(s, "p2", "Stellacorn Herder", "battlefieldA");
    fund(s, "p1", "Primordial Roar");
    const roar = toTrash(s, "p1", "Primordial Roar");
    expect(legalIntents(s.room, "p1", s.host).playableCardIds).not.toContain(roar);
    run(s, { op: "grant_keyword", keyword: "Flow", target: { targetRef: `obj:${roar}` }, duration: "this-turn" });
    expect(legalIntents(s.room, "p1", s.host).playableCardIds).toContain(roar);
  });
});
