/** Origins O–Z: champion units and the remaining units. */
import { describe, expect, it } from "vitest";
import {
  combatKeywordProfile,
  costAdjustments,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
  listActivatedAbilities,
} from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import {
  boardCard,
  driveAll,
  passBoth,
  resolveAll,
  setMight,
  stackRune,
  withCards,
} from "./helpers";

describe("Origins O–Z champions and remaining units", () => {
  it("[C:Raging Firebrand][R420.5][R356.4] when played, the next spell you play this turn costs [5] less", () => {
    const s = withCards(["Raging Firebrand", "Progress Day"]);
    const spell = s.handCard("p1", "Progress Day")!;
    fund(s, "p1", "Raging Firebrand");
    s.as("p1").play("Raging Firebrand").expectOk();
    passBoth(s);
    const total = costAdjustments(s.room, s.host, { playerId: "p1", cardId: spell.id }).reduce(
      (sum, entry) => sum + (entry.energy ?? 0),
      0,
    );
    expect(total).toBe(-5);
    // Progress Day costs [6][Mind]: [1][Mind] is enough now.
    s.room.rules!.pools.p1 = { energy: 1, power: { Mind: 1 } };
    s.as("p1").play("Progress Day").expectOk();
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: spell.id })).toEqual([]);
    expect(getCardScript("Raging Firebrand")?.status).toBe("partial");
  });

  it("[C:Sett, Brawler][R383.4.a][R383.4.c.2.a] buffs himself when played and when he conquers; 'Spend my buff' is unpayable", () => {
    const s = withCards(["Sett, Brawler"]);
    fund(s, "p1", "Sett, Brawler");
    s.as("p1").play("Sett, Brawler").expectOk();
    passBoth(s);
    const sett = boardCard(s, "p1", "Sett, Brawler")!;
    expect(s.room.rules!.objects[sett.id]?.buffs).toBe(1);
    const [entry] = listActivatedAbilities("Sett, Brawler");
    expect(entry?.ability.cost.additional).toEqual({ "unsupported:Spend my buff": true });
    s.as("p1")
      .apply({ type: "rules_activate", objectId: sett.id, ability: entry!.ref })
      .expectError("insufficient_resources");
    expect(getCardScript("Sett, Brawler")?.status).toBe("partial");
  });

  it("[C:Sett, Brawler][R383.4.c.2.a] when he conquers, he is buffed (a spent buff comes back)", () => {
    const s = withCards(["Sett, Brawler"]);
    const sett = place(s, "p1", "Sett, Brawler", "base");
    s.as("p1").move("Sett, Brawler", "battlefieldB").expectOk();
    resolveAll(s);
    expect(s.room.rules!.objects[sett.id]?.buffs).toBe(1);
  });

  it("[C:Showstopper][R427][R421] buffs a friendly unit in your base, then moves it to a battlefield", () => {
    const s = withCards(["Showstopper"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Showstopper");
    s.as("p1")
      .play("Showstopper", { choices: { "target:0": unit.id, destination: "battlefieldB" } })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[unit.id]?.buffs).toBe(1);
    expect(zoneOf(s, unit.id)).toBe("battlefieldB");
  });

  it("[C:Teemo, Strategist][R383.4.f][R425][R418.8] when he defends: 1 damage per revealed [Hidden] card, then recycle them", () => {
    const s = withCards([], ["Teemo, Strategist", "Pakaa Cub", "Stand United"]);
    place(s, "p2", "Teemo, Strategist", "battlefieldA");
    // Put the two [Hidden] cards on top of P2's deck (the end of the array is the top).
    const deck = boardOf(s, "p2").deck;
    for (const name of ["Pakaa Cub", "Stand United"]) {
      const hand = boardOf(s, "p2").hand;
      deck.push(
        ...hand.splice(
          hand.findIndex((card) => card.name === name),
          1,
        ),
      );
    }
    const top5 = s.host.lookAtTop(s.room, "p2", "deck", 5).map((card) => card.id);
    const hidden = top5.filter((id) =>
      (s.host.cardInfo(s.room, id)?.keywords ?? []).includes("Hidden"),
    );
    expect(hidden).toHaveLength(2);
    const attacker = place(s, "p1", "Whiteflame Protector", "base");
    setMight(s, attacker.id, 9);
    s.as("p1").move("Whiteflame Protector", "battlefieldA").expectOk();
    // Resolve Teemo's defend trigger (before combat damage; the only enemy unit is chosen).
    for (let guard = 0; guard < 12; guard += 1) {
      if (s.room.rules!.prompt) {
        s.as(s.room.rules!.prompt.playerId)
          .choose({ optionIds: [attacker.id] })
          .expectOk();
        continue;
      }
      if (s.room.rules!.objects[attacker.id]?.damage) break;
      if (!s.room.rules!.chain.some((item) => item.cardName === "Teemo, Strategist")) break;
      s.as(s.room.rules!.priority!).pass().expectOk();
    }
    expect(s.room.rules!.objects[attacker.id]?.damage).toBe(2);
    const nowTop = s.host.lookAtTop(s.room, "p2", "deck", 5).map((card) => card.id);
    for (const id of top5) expect(nowTop).not.toContain(id);
  });

  it("[C:Tideturner][R403.1][R421] when played, may swap locations with a unit you control at another location", () => {
    const s = withCards(["Tideturner"]);
    const other = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Tideturner");
    s.as("p1").play("Tideturner").expectOk();
    s.expectPrompt(undefined, "p1");
    s.as("p1")
      .choose({ optionIds: ["yes"] })
      .expectOk();
    resolveAll(s);
    const tide = boardCard(s, "p1", "Tideturner")!;
    expect(zoneOf(s, tide.id)).toBe("battlefieldA");
    expect(zoneOf(s, other.id)).toBe("base");
  });

  for (const [domain, code] of [
    ["Mind", "OGN-089"],
    ["Order", "OGN-214"],
    ["Fury", "OGN-007"],
    ["Calm", "OGN-042"],
  ] as const) {
    it(`[C:Twisted Fate, Gambler][R383.4.e][R425][R417.1.b] attacking with a ${domain} rune on top`, () => {
      const s = withCards(["Twisted Fate, Gambler"]);
      place(s, "p1", "Twisted Fate, Gambler", "base");
      const a = place(s, "p2", "Whiteflame Protector", "battlefieldA");
      const b = place(s, "p2", "Stellacorn Herder", "battlefieldA");
      setMight(s, a.id, 9);
      setMight(s, b.id, 9);
      const rune = stackRune(s, "p1", domain, code);
      const hand = boardOf(s, "p1").hand.length;
      s.as("p1").move("Twisted Fate, Gambler", "battlefieldA").expectOk();
      // Resolve Twisted Fate's trigger only (before combat damage), choosing `a` when asked.
      for (let guard = 0; guard < 12; guard += 1) {
        const prompt = s.room.rules!.prompt;
        if (prompt) {
          s.as(prompt.playerId)
            .choose({ optionIds: [a.id] })
            .expectOk();
          continue;
        }
        if (!s.room.rules!.chain.some((item) => item.cardName === "Twisted Fate, Gambler")) break;
        s.as(s.room.rules!.priority!).pass().expectOk();
      }
      expect(boardOf(s, "p1").runeDeck[0]!.id).toBe(rune.id);
      const damage = (id: string) => s.room.rules!.objects[id]?.damage ?? 0;
      if (domain === "Fury") {
        expect([damage(a.id), damage(b.id)]).toEqual([2, 1]);
      } else if (domain === "Mind") {
        expect(boardOf(s, "p1").hand.length).toBe(hand + 1);
      } else if (domain === "Order") {
        expect(s.room.rules!.objects[a.id]?.stunned).toBe(true);
      } else {
        expect([damage(a.id), damage(b.id)]).toEqual([0, 0]);
        expect(boardOf(s, "p1").hand.length).toBe(hand);
      }
    });
  }

  it("[C:Udyr, Wildman][C:Vi, Destructive] their activated costs are unpayable (spend my buff / recycle from trash)", () => {
    const s = withCards(["Udyr, Wildman", "Vi, Destructive"]);
    const udyr = place(s, "p1", "Udyr, Wildman", "base");
    s.room.rules!.objects[udyr.id] = { buffs: 1 };
    const vi = place(s, "p1", "Vi, Destructive", "base");
    boardOf(s, "p1").trash.push(boardOf(s, "p1").deck.pop()!);
    for (const [unit, name] of [
      [udyr, "Udyr, Wildman"],
      [vi, "Vi, Destructive"],
    ] as const) {
      const [entry] = listActivatedAbilities(name);
      s.as("p1")
        .apply({ type: "rules_activate", objectId: unit.id, ability: entry!.ref })
        .expectError("insufficient_resources");
      expect(getCardScript(name)?.status).toBe("partial");
      expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Ganking");
    }
  });

  it("[C:Vayne, Hunter][R369.3][R364.3.a] enters ready only if an opponent controls a battlefield", () => {
    const s = withCards(["Vayne, Hunter", "Vayne, Hunter"]);
    fund(s, "p1", "Vayne, Hunter");
    s.as("p1").play("Vayne, Hunter").expectOk();
    expect(boardCard(s, "p1", "Vayne, Hunter")!.exhausted).toBe(true);
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Vayne, Hunter");
    s.as("p1").play("Vayne, Hunter").expectOk();
    const second = boardCard(s, "p1", "Vayne, Hunter", 1)!;
    expect(second.exhausted).toBe(false);
    expect(combatKeywordProfile(s.room, second.id, s.host).assault).toBe(3);
  });

  it("[C:Vayne, Hunter][R740.4.a][R056] when she conquers, you may pay [1] to return her to her owner's hand", () => {
    const s = withCards(["Vayne, Hunter"]);
    const vayne = place(s, "p1", "Vayne, Hunter", "base");
    s.as("p1").move("Vayne, Hunter", "battlefieldB").expectOk();
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    driveAll(s, (prompt) =>
      prompt.options?.some((option) => option.id === "yes") ? ["yes"] : [prompt.options![0]!.id],
    );
    expect(zoneOf(s, vayne.id)).toBe("hand");
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
  });

  it("[C:Volibear, Furious][C:Yasuo, Windrider][C:Sai Scout] keyword parts are automated; the remaining lines are handled per card", () => {
    const s = withCards(["Volibear, Furious", "Yasuo, Windrider", "Sai Scout"]);
    const voli = place(s, "p1", "Volibear, Furious", "base");
    const yasuo = place(s, "p1", "Yasuo, Windrider", "base");
    expect(effectiveKeywords(s.room, voli.id, s.host)).toContain("Deflect");
    expect(effectiveKeywords(s.room, yasuo.id, s.host)).toContain("Ganking");
    fund(s, "p1", "Sai Scout");
    s.as("p1").play("Sai Scout").expectOk();
    // [Vision]: look at the top card when played (817).
    expect(s.room.rules!.chain.some((item) => item.abilityRef?.startsWith("keyword:vision"))).toBe(
      true,
    );
    expect(getCardScript("Volibear, Furious")?.status).toBe("implemented");
    for (const name of ["Yasuo, Windrider", "Sai Scout"]) {
      expect(getCardScript(name)?.status).toBe("partial");
    }
  });

  it("[C:Raging Soul][C:Sneaky Deckhand][C:Tryndamere, Barbarian] are manual with gap notes; Symbol of the Solari is now implemented", () => {
    for (const name of ["Raging Soul", "Sneaky Deckhand", "Tryndamere, Barbarian"]) {
      expect(getCardScript(name)?.status).toBe("manual");
      expect(getCardScript(name)?.notes?.length ?? 0).toBeGreaterThan(20);
    }
    expect(getCardScript("Symbol of the Solari")?.status).toBe("implemented");
    const s = withCards(["Sneaky Deckhand"]);
    fund(s, "p1", "Sneaky Deckhand");
    s.as("p1").play("Sneaky Deckhand").expectOk();
    expect(effectiveMight(s.room, boardCard(s, "p1", "Sneaky Deckhand")!.id, s.host)).toBe(2);
  });
});
