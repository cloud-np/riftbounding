/**
 * Wave R4 — Vendetta units scripted after wave R3 (implements full printed text unless noted).
 */
import { describe, expect, it } from "vitest";
import { combatContribution, getCardScript } from "../../../src";
import {
  activate,
  addPool,
  answer,
  boardOf,
  empowered,
  exhaustRunes,
  might,
  place,
  runeCount,
  setControl,
  settle,
  withCards,
  zoneOf,
} from "./helpers";

describe("Wave R4 Vendetta units", () => {
  it("[C:Blade Twirler][R383.4.e][R441] the first move each turn burns the chosen player", () => {
    const s = withCards(["Blade Twirler"]);
    const twirler = place(s, "p1", "Blade Twirler", "base");
    const before = boardOf(s, "p2").deck.length;
    s.as("p1").move("Blade Twirler", "battlefieldA").expectOk();
    settle(s);
    expect(s.room.rules!.prompt?.kind).toBe("choose-player");
    answer(s, ["p2"]);
    settle(s);
    expect(boardOf(s, "p2").deck.length).toBe(before - 1);
    // Once per turn: moving back does not burn again.
    s.host.setExhausted(s.room, twirler.id, false);
    s.as("p1").move("Blade Twirler", "base").expectOk();
    settle(s);
    expect(s.room.rules!.prompt).toBeNull();
    expect(boardOf(s, "p2").deck.length).toBe(before - 1);
  });

  it("[C:Dame the Despoiler][R828.1.c] Empowered attack: increase my Might to the chosen unit's, then +1", () => {
    const s = withCards(["Dame the Despoiler"], [], { battlefields: { p2: "Bandle Tree" } });
    const dame = place(s, "p1", "Dame the Despoiler", "base");
    const big = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    setControl(s, "battlefieldA", "p2");
    addPool(s, "p1", 5, { Body: 1 });
    activate(s, "p1", dame, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, dame.id)).toBe(true);
    s.as("p1").move("Dame the Despoiler", "battlefieldA").expectOk();
    settle(s);
    expect(s.room.rules!.prompt?.kind).toBe("choose-card");
    answer(s, [big.id]);
    settle(s);
    expect(might(s, dame.id)).toBe(9);
  });

  it("[C:Profiteer][R442][R443] may disempower something to empower a legend, unit, or gear", () => {
    const s = withCards(["Profiteer"]);
    const source = place(s, "p1", "Caitlyn, Patrolling", "base");
    const target = place(s, "p1", "Treasure Hunter", "base");
    s.room.rules!.objects[source.id] = { ...(s.room.rules!.objects[source.id] ?? {}), empowered: 1 };
    fundPlay(s, "Profiteer");
    s.as("p1").play("Profiteer").expectOk();
    settle(s);
    expect(s.room.rules!.prompt?.kind).toBe("yes-no");
    answer(s, ["yes"]);
    settle(s);
    // The only Empowered object is picked automatically; then choose what to empower.
    expect(s.room.rules!.prompt?.kind).toBe("choose-card");
    answer(s, [target.id]);
    settle(s);
    expect(empowered(s, source.id)).toBe(false);
    expect(empowered(s, target.id)).toBe(true);
  });

  it("[C:Sacred Protector][R467.2.a] contributes no combat damage unless exactly one other friendly unit is there", () => {
    const s = withCards(["Sacred Protector"]);
    const protector = place(s, "p1", "Sacred Protector", "battlefieldA");
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    expect(combatContribution(s.room, protector.id, s.host)).toBeGreaterThan(0);
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    expect(combatContribution(s.room, protector.id, s.host)).toBe(0);
  });

  it("[C:Sandstone Chimera][R315.3.b.1][R370] while at a battlefield players channel only 1 rune", () => {
    const s = withCards(["Sandstone Chimera"]);
    place(s, "p1", "Sandstone Chimera", "battlefieldA");
    const p1Runes = runeCount(s, "p1");
    const p2Runes = runeCount(s, "p2");
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(runeCount(s, "p2")).toBe(p2Runes + 1);
    s.as("p2").endTurn().expectOk();
    settle(s);
    expect(runeCount(s, "p1")).toBe(p1Runes + 1);
  });

  it("[C:Tail-Cloaked Matriarch][R828.1.d][R420.3] on empower may play a cheap unit from the trash", () => {
    const s = withCards(["Tail-Cloaked Matriarch"]);
    const matriarch = place(s, "p1", "Tail-Cloaked Matriarch", "base");
    const caitlyn = place(s, "p1", "Caitlyn, Patrolling", "trash");
    addPool(s, "p1", 2, { Chaos: 1 });
    activate(s, "p1", matriarch, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    settle(s);
    expect(s.room.rules!.prompt?.kind).toBe("yes-no");
    answer(s, ["yes"]);
    settle(s);
    // A single legal unit in the trash is picked automatically (055).
    expect(zoneOf(s, caitlyn.id)).toBe("base");
    expect(s.host.findCard(s.room, caitlyn.id)?.playerId).toBe("p1");
  });

  it("[C:Kharox][R828.1.d][R441][R420.3] on empower an opponent burns 3 and you may play a unit from their trash", () => {
    const s = withCards(["Kharox"], ["Caitlyn, Patrolling"]);
    const kharox = place(s, "p1", "Kharox", "base");
    const stolen = place(s, "p2", "Caitlyn, Patrolling", "trash");
    const deck = boardOf(s, "p2").deck.length;
    addPool(s, "p1", 6, { Chaos: 2 });
    activate(s, "p1", kharox, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    settle(s);
    // The only opponent is chosen automatically; the burn happens before the may decision.
    expect(boardOf(s, "p2").deck.length).toBe(deck - 3);
    expect(s.room.rules!.prompt?.kind).toBe("yes-no");
    answer(s, ["yes"]);
    settle(s);
    if (s.room.rules!.prompt?.kind === "choose-card") answer(s, [stolen.id]);
    settle(s);
    expect(zoneOf(s, stolen.id)).toBe("base");
    expect(s.host.findCard(s.room, stolen.id)?.playerId).toBe("p1");
  });

  it("[C:Otterpus][R371][R473.1] a first/second-turn conquer or hold is replaced by a draw", () => {
    const s = withCards(["Otterpus"]);
    place(s, "p1", "Otterpus", "base");
    place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    setControl(s, "battlefieldA", "p2");
    s.as("p1").endTurn().expectOk();
    const events = [...s.events()];
    events.push(...settle(s));
    expect(s.host.score(s.room, "p2")).toBe(0);
    expect(events.some((event) => event.type === "replaced" && event.data?.action === "score")).toBe(true);
    expect(events.some((event) => event.type === "score")).toBe(false);
  });

  it("[C:Ravenbloom Prefect][R740.4.a.2][R428] opponent's gear play: may banish me to banish it", () => {
    const s = withCards(["Ravenbloom Prefect"], ["Rage Amplifier"]);
    const prefect = place(s, "p1", "Ravenbloom Prefect", "base");
    s.as("p1").endTurn().expectOk();
    settle(s);
    const gear = s.handCard("p2", "Rage Amplifier")!;
    fundPlay(s, "Rage Amplifier", "p2");
    s.as("p2").play("Rage Amplifier").expectOk();
    settle(s);
    expect(s.room.rules!.prompt?.kind).toBe("yes-no");
    answer(s, ["yes"]);
    settle(s);
    expect(zoneOf(s, prefect.id)).toBe("banished");
    expect(zoneOf(s, gear.id)).toBe("banished");
  });

  it("[C:Mask Mother][C:Fallen Feline][C:Tornado Warrior][C:Dune Surfer] partial scripts still resolve as printed units", () => {
    const s = withCards(["Mask Mother", "Fallen Feline", "Tornado Warrior", "Dune Surfer"]);
    for (const name of ["Mask Mother", "Fallen Feline", "Tornado Warrior", "Dune Surfer"]) {
      fundPlay(s, name);
      s.as("p1").play(name).expectOk();
      settle(s);
      expect(s.room.rules!.manual, name).toBeNull();
      expect(s.findBoardCard(name), name).toBeDefined();
      expect(getCardScript(name)?.status).toBe("partial");
    }
  });
});

/** Fund a hand card exactly (the lane helper `fund` only lives in the effects test helpers). */
function fundPlay(s: ReturnType<typeof withCards>, name: string, playerId = "p1"): void {
  const card = s.handCard(playerId, name);
  if (!card) throw new Error(`${name} not in ${playerId}'s hand`);
  const info = s.host.cardInfo(s.room, card.id);
  const pool = s.room.rules!.pools[playerId]!;
  pool.energy += info?.energyCost ?? 0;
  const power = info?.powerCost ?? 0;
  if (power > 0) {
    const domain = (info?.domains?.[0] ?? "any") as keyof typeof pool.power;
    pool.power = { ...pool.power, [domain]: (pool.power[domain] ?? 0) + power };
  }
}
