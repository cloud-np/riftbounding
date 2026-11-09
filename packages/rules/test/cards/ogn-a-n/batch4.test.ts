/**
 * Origins A–N, batch 4: activated abilities (incl. Add abilities) and hold/play/phase triggers.
 */
import { describe, expect, it } from "vitest";
import {
  effectiveKeywords,
  effectiveMight,
  getCardScript,
  listActivatedAbilities,
} from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import { setControl } from "../../rules/combat/helpers";
import {
  answer,
  cardIn,
  drain,
  handOnly,
  passBoth,
  pick,
  promptOptions,
  settle,
  withCards,
  type S,
} from "./helpers";

function activate(
  s: S,
  player: string,
  objectId: string,
  name: string,
  extra: Record<string, unknown> = {},
): S {
  const ref = listActivatedAbilities(name)[0]!.ref;
  return s.as(player).apply({ type: "rules_activate", objectId, ability: ref, ...extra } as never);
}

describe("Origins A–N — activated abilities", () => {
  it("[C:Arena Bar][R427.1][R702.3] [Tap]: buff an exhausted friendly unit", () => {
    const s = withCards(["Arena Bar"]);
    const bar = place(s, "p1", "Arena Bar", "base");
    const tired = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    place(s, "p1", "Stellacorn Herder", "base"); // ready: not a legal choice
    activate(s, "p1", bar.id, "Arena Bar").expectOk();
    // The only exhausted friendly unit is bound automatically.
    drain(s);
    expect(s.room.rules!.objects[tired.id]?.buffs).toBe(1);
    expect(s.host.isExhausted(s.room, bar.id)).toBe(true);
  });

  it("[C:Lee Sin, Blind Monk][R377.1] [1], [Tap]: buff a friendly unit", () => {
    const s = withCards(["Lee Sin, Blind Monk"]);
    const lee = place(s, "p1", "Lee Sin, Blind Monk", "legend");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    for (const rune of boardOf(s, "p1").runeArea) rune.exhausted = true;
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    activate(s, "p1", lee.id, "Lee Sin, Blind Monk").expectOk();
    drain(s);
    expect(s.room.rules!.objects[unit.id]?.buffs).toBe(1);
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
  });

  it("[C:Lee Sin, Ascetic][R702.3] [Tap]: buff me (the any-number-of-buffs clause is not automated)", () => {
    const s = withCards(["Lee Sin, Ascetic"]);
    const lee = place(s, "p1", "Lee Sin, Ascetic", "base");
    activate(s, "p1", lee.id, "Lee Sin, Ascetic").expectOk();
    drain(s);
    expect(effectiveMight(s.room, lee.id, s.host)).toBe(6);
    expect(effectiveKeywords(s.room, lee.id, s.host)).toContain("Shield");
    expect(getCardScript("Lee Sin, Ascetic")?.status).toBe("partial");
  });

  it("[C:Miss Fortune, Bounty Hunter][R801.3.a][R810.1] [Tap]: give a unit Ganking this turn", () => {
    const s = withCards(["Miss Fortune, Bounty Hunter"]);
    const mf = place(s, "p1", "Miss Fortune, Bounty Hunter", "legend");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(effectiveKeywords(s.room, mf.id, s.host)).not.toContain("Ganking");
    activate(s, "p1", mf.id, "Miss Fortune, Bounty Hunter", {
      choices: { "target:0": unit.id },
    }).expectOk();
    drain(s);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Ganking");
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldB").expectOk();
  });

  it("[C:Energy Conduit][R430.2][R430.5] [Tap]: [Reaction] - [Add] [1] resolves immediately", () => {
    const s = withCards(["Energy Conduit"]);
    const conduit = place(s, "p1", "Energy Conduit", "base");
    activate(s, "p1", conduit.id, "Energy Conduit").expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(1);
    expect(s.room.rules!.chain).toHaveLength(0);
  });

  it("[C:Darius, Hand of Noxus][R812.1.c][R430.2] [Tap] [Legion] - [Add] [1] only after you played a card this turn", () => {
    const s = withCards(["Darius, Hand of Noxus", "Stellacorn Herder"]);
    const darius = place(s, "p1", "Darius, Hand of Noxus", "legend");
    activate(s, "p1", darius.id, "Darius, Hand of Noxus").expectError("illegal_action");
    fund(s, "p1", "Stellacorn Herder");
    s.as("p1").play("Stellacorn Herder").expectOk();
    activate(s, "p1", darius.id, "Darius, Hand of Noxus").expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(1);
  });

  it("[C:Malzahar, Fanatic][R357.2][R430.2] kill a friendly unit or gear, [Tap]: [Action] - [Add] two Power", () => {
    const s = withCards(["Malzahar, Fanatic"]);
    const malzahar = place(s, "p1", "Malzahar, Fanatic", "base");
    const gear = place(s, "p1", "Blade of the Exile", "base");
    activate(s, "p1", malzahar.id, "Malzahar, Fanatic", { plan: { kill: [gear.id] } }).expectOk();
    expect(zoneOf(s, gear.id)).toBe("trash");
    expect(s.host.isExhausted(s.room, malzahar.id)).toBe(true);
    expect(s.room.rules!.pools.p1!.power).toEqual({ any: 2 });
  });

  it("[C:Iron Ballista][R377.1] [Tap]: deal 2 to a unit at a battlefield (enters exhausted is not automated)", () => {
    const s = withCards(["Iron Ballista"]);
    const ballista = place(s, "p1", "Iron Ballista", "base");
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    place(s, "p2", "Stellacorn Herder", "base"); // at a base: not a legal choice
    activate(s, "p1", ballista.id, "Iron Ballista").expectOk();
    drain(s);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(2);
    expect(getCardScript("Iron Ballista")?.status).toBe("partial");
  });

  it("[C:Forge of the Future][R440.2.c][R417.1.c] when played, a Recruit at your base; kill this: recycle up to 4 cards from trashes", () => {
    const s = withCards(["Forge of the Future"]);
    fund(s, "p1", "Forge of the Future");
    s.as("p1").play("Forge of the Future").expectOk();
    passBoth(s);
    expect(cardIn(s, "p1", "base", "Recruit")).toBeTruthy();
    const mine = boardOf(s, "p1").deck.slice(0, 2);
    const theirs = boardOf(s, "p2").deck.slice(0, 2);
    boardOf(s, "p1").deck.splice(0, 2);
    boardOf(s, "p2").deck.splice(0, 2);
    boardOf(s, "p1").trash.push(...mine);
    boardOf(s, "p2").trash.push(...theirs);
    const forge = cardIn(s, "p1", "base", "Forge of the Future")!;
    const ids = [...mine, ...theirs].map((card) => card.id);
    activate(s, "p1", forge.id, "Forge of the Future", { choices: { "target:0": ids } }).expectOk();
    expect(zoneOf(s, forge.id)).toBe("trash");
    drain(s);
    // 417.1: the bottom of each owner's Main Deck.
    for (const card of mine)
      expect(
        boardOf(s, "p1")
          .deck.slice(0, 2)
          .map((c) => c.id),
      ).toContain(card.id);
    for (const card of theirs)
      expect(
        boardOf(s, "p2")
          .deck.slice(0, 2)
          .map((c) => c.id),
      ).toContain(card.id);
  });
});

describe("Origins A–N — hold, play and phase triggers", () => {
  it("[C:Ahri, Alluring][R383.4.d][R470.2] when I hold, you score 1 point", () => {
    const s = withCards([], ["Ahri, Alluring"]);
    place(s, "p2", "Ahri, Alluring", "battlefieldB");
    setControl(s.room, "battlefieldB", "p2");
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules!.chain.some((item) => item.cardName === "Ahri, Alluring")).toBe(true);
    const before = boardOf(s, "p2").score;
    drain(s);
    expect(boardOf(s, "p2").score).toBe(before + 1);
  });

  it("[C:Blitzcrank, Impassive][R383.2.a.1][R403.1] played to a battlefield: you may move an enemy unit to here", () => {
    const s = withCards(["Blitzcrank, Impassive"]);
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    const enemy = place(s, "p2", "Astral Heron", "base");
    fund(s, "p1", "Blitzcrank, Impassive");
    s.as("p1").play("Blitzcrank, Impassive", { location: "battlefieldA" }).expectOk();
    s.expectPrompt(undefined, "p1");
    answer(s, { optionIds: ["yes"] });
    drain(s);
    expect(zoneOf(s, enemy.id)).toBe("battlefieldA");

    // Played to the base: the condition is false, nothing triggers.
    const t = withCards(["Blitzcrank, Impassive"]);
    place(t, "p2", "Astral Heron", "base");
    fund(t, "p1", "Blitzcrank, Impassive");
    t.as("p1").play("Blitzcrank, Impassive").expectOk();
    expect(t.room.rules!.chain).toHaveLength(0);
    expect(t.room.rules!.prompt).toBeFalsy();
  });

  it("[C:Blitzcrank, Impassive][R383.4.d] when I hold, return me to my owner's hand", () => {
    const s = withCards([], ["Blitzcrank, Impassive"]);
    const blitz = place(s, "p2", "Blitzcrank, Impassive", "battlefieldB");
    setControl(s.room, "battlefieldB", "p2");
    s.as("p1").endTurn().expectOk();
    expect(s.room.rules!.chain.some((item) => item.cardName === "Blitzcrank, Impassive")).toBe(
      true,
    );
    drain(s);
    expect(zoneOf(s, blitz.id)).toBe("hand");
  });

  it("[C:Cithria of Cloudfield][R420.4.a] when you play another unit, buff me", () => {
    const s = withCards(["Cithria of Cloudfield", "Stellacorn Herder"]);
    fund(s, "p1", "Cithria of Cloudfield");
    s.as("p1").play("Cithria of Cloudfield").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    fund(s, "p1", "Stellacorn Herder");
    s.as("p1").play("Stellacorn Herder").expectOk();
    passBoth(s);
    const cithria = cardIn(s, "p1", "base", "Cithria of Cloudfield")!;
    expect(effectiveMight(s.room, cithria.id, s.host)).toBe(2);
  });

  it("[C:Darius, Trifarian][R420.4.a] when you play your second card in a turn, +2 Might this turn and ready me", () => {
    const s = withCards([
      "Stellacorn Herder",
      "Treasure Hunter",
      "Clockwork Keeper",
      "Darius, Trifarian",
    ]);
    const darius = place(s, "p1", "Darius, Trifarian", "base", { exhausted: true });
    fund(s, "p1", "Stellacorn Herder");
    s.as("p1").play("Stellacorn Herder").expectOk();
    expect(s.room.rules!.chain).toHaveLength(0);
    fund(s, "p1", "Treasure Hunter");
    s.as("p1").play("Treasure Hunter").expectOk();
    expect(s.room.rules!.chain[0]?.cardName).toBe("Darius, Trifarian");
    passBoth(s);
    expect(effectiveMight(s.room, darius.id, s.host)).toBe(7);
    expect(s.host.isExhausted(s.room, darius.id)).toBe(false);
    // The third card does not trigger it again.
    fund(s, "p1", "Clockwork Keeper");
    s.as("p1").play("Clockwork Keeper").expectOk();
    expect(s.room.rules!.chain.some((item) => item.cardName === "Darius, Trifarian")).toBe(false);
  });

  it("[C:Jinx, Loose Cannon][R315.2.a.1][R359.3.f.2] start of your Beginning Phase: draw 1 if you have 1 or fewer cards in hand", () => {
    const s = withCards([], [], {});
    place(s, "p1", "Treasure Hunter", "base");
    boardOf(s, "p1").legend.push({
      ...boardOf(s, "p1").legend[0]!,
      id: "jinx-legend",
      name: "Jinx, Loose Cannon",
    });
    handOnly(s, "p1", []);
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    expect(s.room.rules!.chain.some((item) => item.cardName === "Jinx, Loose Cannon")).toBe(true);
    drain(s);
    settle(s);
    // Jinx's draw, then the Draw Phase draw.
    expect(boardOf(s, "p1").hand.length).toBe(2);
  });

  it("[C:Jinx, Demolitionist][R423.1.a] when you play me, discard 2 (Assault 2 is printed)", () => {
    const s = withCards(["Jinx, Demolitionist", "Rebuke", "Defy", "Gust"]);
    fund(s, "p1", "Jinx, Demolitionist");
    s.as("p1").play("Jinx, Demolitionist").expectOk();
    passBoth(s);
    s.expectPrompt("choose-card", "p1");
    const chosen = promptOptions(s).slice(0, 2);
    pick(s, ...chosen);
    for (const id of chosen) expect(zoneOf(s, id)).toBe("trash");
    const jinx = cardIn(s, "p1", "base", "Jinx, Demolitionist")!;
    expect(effectiveKeywords(s.room, jinx.id, s.host)).toEqual(
      expect.arrayContaining(["Accelerate", "Assault"]),
    );
  });
});
