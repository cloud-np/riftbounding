/**
 * Edge cases: Delayed Abilities and trigger timing (390–393, 359.3.e.16, 359.3.f.3.a, 355.5.b) —
 * docs/rules/edge-cases-audit.md, "Delayed effects & trigger timing audit".
 */
import { describe, expect, it } from "vitest";
import type { CardInstance, GameEvent, Prompt } from "@rift/protocol";
import { effectiveMight, runCleanup } from "../../src";
import { scenario } from "../scenarios/dsl";
import { boardOf, drive, duel, placeUnit, setControl, toHand, type S } from "./helpers";

const empoweredOf = (s: S, id: string): number => (s.room.rules!.objects[id]?.empowered as number | undefined) ?? 0;
const typesOf = (events: readonly GameEvent[]): string[] => events.map((event) => event.type);
const where = (s: S, id: string) => s.host.findCard(s.room, id);
const fund = (s: S, playerId: string): void => {
  s.room.rules!.pools[playerId] = { energy: 6, power: { any: 6 } };
};

/** p2 plays En Garde on its own unit so p1 has a response window during p2's turn. */
function openP2Window(s: S, p2Unit: CardInstance): void {
  toHand(s, "p2", "En Garde");
  fund(s, "p2");
  s.as("p2").play("En Garde", { choices: { "target:0": [p2Unit.id] } }).expectOk();
}

describe("delayed 'at end of turn' created on the opponent's turn [R391.2][C:Sanction]", () => {
  it("[R391.2][R317.1][C:Sanction] a Reaction played on the OPPONENT's turn still fires its end-of-turn delayed trigger", () => {
    const s = duel({ p1: ["Sanction"], p2: ["Stellacorn Herder"] });
    const mine = placeUnit(s, "p1", "Treasure Hunter", "base", "mine");
    const theirs = placeUnit(s, "p2", "Stellacorn Herder", "base", "theirs");
    s.as("p1").endTurn().expectOk();
    drive(s);
    expect(s.room.rules!.turn.player).toBe("p2");
    openP2Window(s, theirs);
    toHand(s, "p1", "Sanction");
    fund(s, "p1");
    s.as("p1").play("Sanction", { choices: { mode: "empower", "target:0": [mine.id] } }).expectOk();
    drive(s);
    expect(empoweredOf(s, mine.id)).toBe(1);
    s.as("p2").endTurn().expectOk();
    drive(s);
    expect(empoweredOf(s, mine.id)).toBe(0);
  });

  it("[R359.3.f.3.a][R391.2][C:Sanction] the delayed trigger outlives its spell: target gone at end of turn means nothing happens", () => {
    const s = duel({ p1: ["Sanction"] });
    const mine = placeUnit(s, "p1", "Treasure Hunter", "base", "mine");
    toHand(s, "p1", "Sanction");
    fund(s, "p1");
    s.as("p1").play("Sanction", { choices: { mode: "empower", "target:0": [mine.id] } }).expectOk();
    drive(s);
    expect(boardOf(s, "p1").trash.some((card) => card.name === "Sanction")).toBe(true);
    s.host.moveCardToOwnerZone(s.room, mine.id, "trash");
    s.as("p1").endTurn().expectOk();
    drive(s);
    expect(s.room.rules!.turn.player).toBe("p2");
    expect(s.room.gameOutcome).toBeFalsy();
  });
});

describe("359.3.e.16 a delayed trigger whose window already ended is not generated", () => {
  it("[R359.3.e.16][C:Sanction][C:Sona, Harmonious] Sanction played in response to an end-of-turn trigger empowers but never disempowers", () => {
    const s = duel({ p1: ["Sanction", "Sona, Harmonious"] });
    placeUnit(s, "p1", "Sona, Harmonious", "battlefieldA", "sona");
    const mine = placeUnit(s, "p1", "Treasure Hunter", "base", "mine");
    toHand(s, "p1", "Sanction");
    fund(s, "p1");
    s.as("p1").endTurn().expectOk();
    s.as("p1").choose({ optionIds: [] }).expectOk(); // Sona: ready up to 4 runes (none chosen)
    expect(s.room.rules!.turn.phase).toBe("ending");
    expect(s.room.rules!.chain.length).toBeGreaterThan(0);
    s.as("p1").play("Sanction", { choices: { mode: "empower", "target:0": [mine.id] } }).expectOk();
    drive(s);
    expect(s.room.rules!.turn.player).toBe("p2");
    expect(empoweredOf(s, mine.id)).toBe(1);
  });
});

describe("Targon's Peak [R355.5.b][R359.3.f.3.a][C:Targon's Peak]", () => {
  function peak(): S {
    return scenario({ battlefields: { p1: "Targon's Peak", p2: "Bandle Tree" } });
  }

  it("[R355.5.b][R391.2][C:Targon's Peak] conquering creates the delayed trigger; the up-to-2 rune choice is made at end of turn, not at conquer", () => {
    const s = peak();
    placeUnit(s, "p1", "Stellacorn Herder", "base", "u");
    const runes = boardOf(s, "p1").runeArea;
    for (const rune of runes) rune.exhausted = true;
    const kinds: string[] = [];
    s.as("p1").move("Stellacorn Herder", "battlefieldA").expectOk();
    drive(s, { answer: (prompt: Prompt) => (kinds.push(prompt.kind), null) });
    expect(controllerOf(s)).toBe("p1");
    expect(kinds).toEqual([]); // no rune choice during the conquer
    expect(s.room.rules!.effects.some((e) => e.modifier.kind === "custom" && e.modifier.id === "delayed-trigger")).toBe(true);
    expect(boardOf(s, "p1").runeArea.every((rune) => rune.exhausted)).toBe(true);
    s.as("p1").endTurn().expectOk();
    // The trigger is on the chain / asks for its choice now.
    drive(s, {
      answer: (prompt) => {
        kinds.push(prompt.kind);
        return (prompt.options ?? []).slice(0, 2).map((o) => o.id);
      },
    });
    expect(kinds.length).toBeGreaterThan(0);
    const readied = boardOf(s, "p1").runeArea.filter((rune) => !rune.exhausted).length;
    expect(readied).toBeLessThanOrEqual(2);
    expect(readied).toBeGreaterThan(0);
  });
});

function controllerOf(s: S): string | null | undefined {
  return s.room.rules?.objects.battlefieldA?.controller;
}

describe("Hostile Takeover [R359.3.e.16][C:Hostile Takeover]", () => {
  it("[R391.2][C:Hostile Takeover] the stolen unit dies before end of turn: the delayed trigger finds nothing and the game continues", () => {
    const s = duel({ p1: ["Hostile Takeover"] });
    const victim = placeUnit(s, "p2", "Stellacorn Herder", "battlefieldB", "victim");
    toHand(s, "p1", "Hostile Takeover");
    fund(s, "p1");
    s.as("p1").play("Hostile Takeover", { choices: { "target:0": [victim.id] } }).expectOk();
    drive(s);
    expect(where(s, victim.id)?.playerId).toBe("p1");
    s.host.moveCardToOwnerZone(s.room, victim.id, "trash");
    s.as("p1").endTurn().expectOk();
    drive(s);
    expect(where(s, victim.id)?.zone).toBe("trash");
    expect(s.room.rules!.turn.player).toBe("p2");
  });

  it("[R391.2][C:Hostile Takeover] recalled to base at end of turn: control reverts and the unit is in its owner's base", () => {
    const s = duel({ p1: ["Hostile Takeover"] });
    const victim = placeUnit(s, "p2", "Stellacorn Herder", "battlefieldB", "victim");
    toHand(s, "p1", "Hostile Takeover");
    fund(s, "p1");
    s.as("p1").play("Hostile Takeover", { choices: { "target:0": [victim.id] } }).expectOk();
    drive(s);
    s.as("p1").endTurn().expectOk();
    drive(s);
    expect(where(s, victim.id)).toMatchObject({ playerId: "p2", zone: "base" });
    // Interpretation (460.1: a Recall does not affect the permanent's state): it stays Ready.
    expect(where(s, victim.id)?.card.exhausted ?? false).toBe(false);
  });
});

describe("granted durations do not follow a unit to a new object [R317.2.c][R186][C:Deadly Flourish][C:En Garde]", () => {
  it("[R317.2.c][R186.1][C:En Garde] a 'this turn' Might buff is gone when the unit is recalled to hand and replayed the same turn", () => {
    const s = duel();
    const unit = placeUnit(s, "p1", "Stellacorn Herder", "base", "u");
    toHand(s, "p1", "En Garde");
    fund(s, "p1");
    s.as("p1").play("En Garde", { choices: { "target:0": [unit.id] } }).expectOk();
    drive(s);
    const buffed = effectiveMight(s.room, unit.id, s.host);
    expect(buffed).toBeGreaterThan(3);
    s.host.moveCardToOwnerZone(s.room, unit.id, "hand");
    delete s.room.rules!.objects[unit.id]; // what `forgetObject` does for every board-leaving effect
    s.as("p1").play("Stellacorn Herder", { location: "base" }).expectOk();
    drive(s);
    const again = boardOf(s, "p1").base.find((card) => card.name === "Stellacorn Herder");
    expect(again).toBeTruthy();
    expect(effectiveMight(s.room, again!.id, s.host)).toBe(3);
  });

  it("[R186.1][R359.3.f][C:Deadly Flourish] 'when it dies this turn' does not fire for the same card coming back as a new object", () => {
    const s = duel({ p1: ["Deadly Flourish"], p2: ["Playful Phantom"] });
    const enemy = placeUnit(s, "p2", "Playful Phantom", "battlefieldB", "enemy");
    toHand(s, "p1", "Deadly Flourish");
    fund(s, "p1");
    s.as("p1").play("Deadly Flourish", { choices: { "target:0": [enemy.id] } }).expectOk();
    drive(s);
    expect(where(s, enemy.id)?.zone).toBe("battlefieldB"); // survived 3 damage
    // It leaves the board (returned to hand) and is played again: a new object.
    s.host.moveCardToOwnerZone(s.room, enemy.id, "hand");
    delete s.room.rules!.objects[enemy.id];
    const again = placeUnit(s, "p2", "Playful Phantom", "battlefieldB", enemy.id);
    s.host.moveCardToOwnerZone(s.room, again.id, "trash");
    delete s.room.rules!.objects[again.id];
    drive(s);
    expect(boardOf(s, "p1").base.some((card) => card.name === "Gold")).toBe(false);
  });
});


describe("delayed trigger whose source left the board [R391.5][R359.3.f.3.a][C:Iascylla]", () => {
  function holdIascylla(): S {
    const s = duel({ p1: ["Iascylla"], p2: ["Stellacorn Herder"] });
    placeUnit(s, "p1", "Iascylla", "battlefieldA", "ias");
    setControl(s.room, "battlefieldA", "p1");
    placeUnit(s, "p2", "Stellacorn Herder", "base", "enemy");
    s.as("p1").endTurn().expectOk();
    drive(s);
    s.as("p2").endTurn().expectOk();
    return s;
  }
  const hasDelayed = (s: S) => s.room.rules!.effects.some((e) => e.modifier.kind === "custom" && e.modifier.id === "delayed-trigger");
  const yes = (prompt: Prompt): string[] =>
    prompt.kind === "yes-no" ? ["yes"] : (prompt.options ?? []).slice(0, 1).map((o) => o.id);

  it("[R359.3.f.3.b][C:Iascylla] normal case: held at scoring, at the start of the same turn's Main Phase an enemy unit may be moved to the held battlefield", () => {
    const s = holdIascylla();
    drive(s, { guard: 30, answer: yes });
    expect(s.room.rules!.turn.player).toBe("p1");
    // The enemy was moved to the held battlefield (and lost the resulting combat).
    expect(where(s, "enemy")?.zone).not.toBe("base");
    expect(hasDelayed(s)).toBe(false);
  });

  it("[R359.3.f.3.b][R391.5.a][C:Iascylla] Iascylla leaves while the delayed trigger is on the chain: \"this battlefield\" is the battlefield she held", () => {
    const s = holdIascylla();
    // The delayed trigger is generated at the start of Main Phase and sits on the chain; Iascylla
    // leaves the board in response (before the delayed trigger resolves).
    drive(s, { guard: 30, until: () => s.room.rules!.turn.phase === "main" });
    expect(s.room.rules!.turn.player).toBe("p1");
    expect(s.room.rules!.chain.some((item) => item.cardName === "Iascylla")).toBe(true);
    s.host.moveCardToOwnerZone(s.room, "ias", "trash");
    delete s.room.rules!.objects.ias;
    drive(s, { guard: 30, answer: yes });
    expect(where(s, "enemy")?.zone).not.toBe("base");
  });
});

describe("several delayed triggers at the same end of turn [R383.3.d][R303.2.a]", () => {
  it("[R303.2.a][C:Sanction] an opponent's delayed end-of-turn trigger created on my turn still fires at my end of turn", () => {
    const s = duel({ p1: ["En Garde"], p2: ["Sanction"] });
    placeUnit(s, "p1", "Treasure Hunter", "base", "mine");
    const theirs = placeUnit(s, "p2", "Stellacorn Herder", "base", "theirs");
    toHand(s, "p2", "Sanction");
    fund(s, "p1");
    fund(s, "p2");
    toHand(s, "p1", "En Garde");
    s.as("p1").play("En Garde", { choices: { "target:0": ["mine"] } }).expectOk();
    s.as("p2").play("Sanction", { choices: { mode: "empower", "target:0": [theirs.id] } }).expectOk();
    drive(s);
    expect(empoweredOf(s, theirs.id)).toBe(1);
    s.as("p1").endTurn().expectOk();
    drive(s);
    expect(empoweredOf(s, theirs.id)).toBe(0);
  });
});

describe("'the next time … would die this turn' replacements [R391.3][R392][R370.2][C:Tactical Retreat]", () => {
  function protectedUnit(): S {
    const s = duel({ p1: ["Tactical Retreat"] });
    placeUnit(s, "p1", "Stellacorn Herder", "battlefieldA", "u");
    toHand(s, "p1", "Tactical Retreat");
    fund(s, "p1");
    s.as("p1").play("Tactical Retreat", { choices: { "target:0": ["u"] } }).expectOk();
    drive(s);
    return s;
  }
  const kill = (s: S, id: string): void => {
    s.room.rules!.objects[id] = { ...(s.room.rules!.objects[id] ?? {}), damage: 99 };
    runCleanup(s.room, { ctx: s.ctx, host: s.host, events: [] });
    drive(s);
  };

  it("[R391.3][R392][C:Tactical Retreat] the first death is replaced (heal, exhaust, recall); the second death the same turn is not", () => {
    const s = protectedUnit();
    kill(s, "u");
    expect(where(s, "u")?.zone).toBe("base");
    expect(s.room.rules!.objects.u?.damage ?? 0).toBe(0);
    // Move it back out and kill it again: the one-shot replacement is used up.
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", "u");
    kill(s, "u");
    expect(where(s, "u")?.zone).toBe("trash");
  });

  it("[R391.3][R317.2.c][C:Tactical Retreat] unused, the replacement expires with the turn and does not protect the unit later", () => {
    const s = protectedUnit();
    s.as("p1").endTurn().expectOk();
    drive(s);
    kill(s, "u");
    expect(where(s, "u")?.zone).toBe("trash");
  });
});
