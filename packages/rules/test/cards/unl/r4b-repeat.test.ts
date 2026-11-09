/**
 * Unleashed R4b — Repeat cards upgraded after R4-engine lane B: the scripts use the engine's
 * Repeat execution (820.1.d) and the per-execution choices bound as `repeat:<run>:<key>`
 * (820.2), instead of the R3 `ifRepeat` workaround.
 */
import { describe, expect, it } from "vitest";
import { effectiveKeywordValues, effectiveMight, getCardScript } from "../../../src";
import { boardOf, fund, place, zoneOf } from "../../rules/effects/helpers";
import { hand, playWith, resolveChain, settle, withCards, type S } from "./helpers";

/** Put the named deck cards on top, `names[0]` first (the draw end of the deck). */
function putOnTop(s: S, player: string, names: string[]): void {
  const deck = boardOf(s, player).deck;
  const picked = names.map((name) => {
    const index = deck.findIndex((card) => card.name === name);
    if (index < 0) throw new Error(`putOnTop: ${name} is not in the deck`);
    return deck.splice(index, 1)[0]!;
  });
  deck.push(...picked.reverse());
}

describe("Unleashed R4b — Repeat executes once per paid instance [R820.1.d]", () => {
  it("[C:Upstage Comedy][R820.1.d][R820.2] a paid Repeat readies a second unit chosen for that execution", () => {
    const s = withCards(["Upstage Comedy"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    const b = place(s, "p1", "Treasure Hunter", "base", { exhausted: true });
    fund(s, "p1", "Upstage Comedy");
    s.room.rules!.pools.p1!.energy += 2;
    playWith(s, "p1", "Upstage Comedy", {
      optionalCosts: ["repeat"],
      choices: { "target:0": a.id, "repeat:1:target:0": b.id },
    });
    resolveChain(s);
    expect(s.host.isExhausted(s.room, a.id)).toBe(false);
    expect(s.host.isExhausted(s.room, b.id)).toBe(false);
    expect(getCardScript("Upstage Comedy")?.status).toBe("implemented");
    expect(getCardScript("Upstage Comedy")?.repeatHandled).toBeUndefined();
  });

  it("[C:Upstage Comedy][R820.2] the repeated execution makes its own target choice on play", () => {
    const s = withCards(["Upstage Comedy"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    const b = place(s, "p1", "Treasure Hunter", "base", { exhausted: true });
    fund(s, "p1", "Upstage Comedy");
    s.room.rules!.pools.p1!.energy += 2;
    playWith(s, "p1", "Upstage Comedy", {
      optionalCosts: ["repeat"],
      choices: { "target:0": a.id },
    });
    expect(s.room.rules?.prompt?.data?.key).toBe("repeat:1:target:0");
    const options = s.room.rules?.prompt?.options?.map((option) => option.id) ?? [];
    expect(options).toEqual(expect.arrayContaining([a.id, b.id]));
    s.as("p1").choose({ optionIds: [b.id] }).expectOk();
    resolveChain(s);
    expect(s.host.isExhausted(s.room, a.id)).toBe(false);
    expect(s.host.isExhausted(s.room, b.id)).toBe(false);
  });

  it("[C:Double Trouble][R820.1.d][R820.2] a paid Repeat looks again and draws a second unit", () => {
    const s = withCards(["Double Trouble"]);
    putOnTop(s, "p1", [
      "Treasure Hunter",
      "Caitlyn, Patrolling",
      "Whiteflame Protector",
      "Astral Heron",
      "Stellacorn Herder",
      "Reckless Innovator",
    ]);
    fund(s, "p1", "Double Trouble");
    s.room.rules!.pools.p1!.energy += 2;
    const before = hand(s, "p1").length;
    const drawn: string[] = [];
    playWith(s, "p1", "Double Trouble", { optionalCosts: ["repeat"] });
    let looks = 0;
    settle(s, {
      onPrompt: (prompt) => {
        if (prompt.kind !== "choose-card") return undefined;
        looks += 1;
        const first = prompt.options?.[0]?.id;
        const ids = first ? [first] : [];
        drawn.push(...ids);
        return ids;
      },
    });
    // One look per execution (820.1.d), each with its own choice (820.2).
    expect(looks).toBe(2);
    expect(drawn).toHaveLength(2);
    for (const id of drawn) expect(s.host.cardInfo(s.room, id)?.type.toLowerCase()).toContain("unit");
    expect(hand(s, "p1")).toHaveLength(before + 1);
    expect(getCardScript("Double Trouble")?.status).toBe("implemented");
    expect(getCardScript("Double Trouble")?.repeatHandled).toBeUndefined();
  });

  it("[C:Downstage Dramatics][R820.1.d] a paid Repeat draws one more card", () => {
    const s = withCards(["Downstage Dramatics"]);
    fund(s, "p1", "Downstage Dramatics");
    s.room.rules!.pools.p1!.energy += 2;
    const before = hand(s, "p1").length;
    playWith(s, "p1", "Downstage Dramatics", { optionalCosts: ["repeat"] });
    resolveChain(s);
    expect(hand(s, "p1")).toHaveLength(before + 1);
    expect(getCardScript("Downstage Dramatics")?.status).toBe("implemented");
    expect(getCardScript("Downstage Dramatics")?.repeatHandled).toBeUndefined();
  });

  it("[C:Square Up][R820.1.c][R820.1.d] Repeat — Discard 1 gives Assault 4 to two units", () => {
    const s = withCards(["Square Up", "Gust"]);
    const a = place(s, "p1", "Caitlyn, Patrolling", "base");
    const b = place(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Square Up");
    playWith(s, "p1", "Square Up", {
      optionalCosts: ["repeat"],
      choices: { "target:0": a.id, "repeat:1:target:0": b.id },
    });
    resolveChain(s);
    expect(effectiveKeywordValues(s.room, a.id, s.host).assault).toBe(4);
    expect(effectiveKeywordValues(s.room, b.id, s.host).assault).toBe(4);
    s.expectZone("p1", "Gust", "trash");
    expect(getCardScript("Square Up")?.status).toBe("implemented");
    expect(getCardScript("Square Up")?.repeatHandled).toBeUndefined();
  });

  it("[C:Existential Dread][R820.1.d][R820.2] a paid Repeat stuns two different attacking units", () => {
    const s = withCards(["Existential Dread"], [], { firstPlayer: "p2" });
    place(s, "p1", "Treasure Hunter", "battlefieldA");
    const first = place(s, "p2", "Caitlyn, Patrolling", "base");
    const second = place(s, "p2", "Whiteflame Protector", "base");
    s.as("p2")
      .apply({ type: "rules_move", unitIds: [first.id, second.id], to: "battlefieldA" })
      .expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules!.objects[first.id]?.designation).toBe("attacker");
    expect(s.room.rules!.objects[second.id]?.designation).toBe("attacker");
    fund(s, "p1", "Existential Dread");
    s.room.rules!.pools.p1!.energy += 2;
    playWith(s, "p1", "Existential Dread", {
      optionalCosts: ["repeat"],
      choices: { "target:0": first.id, "repeat:1:target:0": second.id },
    });
    resolveChain(s);
    expect(s.room.rules!.objects[first.id]?.stunned).toBe(true);
    expect(s.room.rules!.objects[second.id]?.stunned).toBe(true);
    expect(getCardScript("Existential Dread")?.status).toBe("implemented");
    expect(getCardScript("Existential Dread")?.repeatHandled).toBeUndefined();
  });
});

describe("Unleashed R4b — Curtain Call [R820]", () => {
  it("[C:Curtain Call][R820.1.c][R820.1.d] the three Repeat costs are offered, each adds an execution, and each chooses an unused mode", () => {
    const s = withCards(["Curtain Call"]);
    const battlefieldVictim = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const baseVictim = place(s, "p2", "Whiteflame Protector", "base");
    const mightVictim = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Curtain Call");
    s.room.rules!.pools.p1!.energy += 2;
    s.room.rules!.pools.p1!.power.any = (s.room.rules!.pools.p1!.power.any ?? 0) + 2;
    const before = hand(s, "p1").length;
    playWith(s, "p1", "Curtain Call", {
      optionalCosts: ["repeat", "repeat:1", "repeat:2"],
      choices: {
        mode: "draw",
        "repeat:1:mode": "deal2",
        "repeat:1:target:0": battlefieldVictim.id,
        "repeat:2:mode": "deal3",
        "repeat:2:target:1": baseVictim.id,
        "repeat:3:mode": "might",
        "repeat:3:target:2": mightVictim.id,
      },
    });
    resolveChain(s);
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
    expect(s.room.rules!.pools.p1!.power.any ?? 0).toBe(0);
    expect(hand(s, "p1")).toHaveLength(before); // played (-1), draw 1
    expect(s.room.rules!.objects[battlefieldVictim.id]?.damage).toBe(2);
    expect(s.room.rules!.objects[baseVictim.id]?.damage).toBe(3);
    expect(effectiveMight(s.room, mightVictim.id, s.host)).toBe(8 - 4);
    expect(getCardScript("Curtain Call")?.status).toBe("implemented");
  });

  it("[C:Curtain Call][R355.3][R820.2] a repeated execution cannot choose a mode already chosen; it is re-asked with the unused modes", () => {
    const s = withCards(["Curtain Call"]);
    const victim = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    place(s, "p2", "Treasure Hunter", "battlefieldB");
    fund(s, "p1", "Curtain Call");
    s.room.rules!.pools.p1!.energy += 1;
    s.room.rules!.pools.p1!.power.any = (s.room.rules!.pools.p1!.power.any ?? 0) + 1;
    const before = hand(s, "p1").length;
    playWith(s, "p1", "Curtain Call", {
      optionalCosts: ["repeat"],
      choices: { mode: "draw", "repeat:1:mode": "draw" },
    });
    const asked: string[] = [];
    settle(s, {
      onPrompt: (prompt) => {
        if (prompt.kind === "choose-mode") {
          asked.push(prompt.kind);
          return ["deal2"];
        }
        if (prompt.kind === "choose-target") {
          asked.push(prompt.kind);
          return [victim.id];
        }
        return undefined;
      },
    });
    expect(asked).toEqual(["choose-mode", "choose-target"]);
    expect(s.room.rules!.objects[victim.id]?.damage).toBe(2);
    expect(hand(s, "p1")).toHaveLength(before); // draw 1 from the first execution
  });
});
