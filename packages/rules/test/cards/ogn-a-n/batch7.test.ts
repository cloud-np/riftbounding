/**
 * Origins A–N, batch 7: partially automated cards (cost/location/zone gaps) and Hallowed Tomb.
 */
import { describe, expect, it } from "vitest";
import {
  listActivatedAbilities,
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  getCardScript,
} from "../../../src";
import { boardOf, fund, place, run, zoneOf } from "../../rules/effects/helpers";
import { setControl } from "../../rules/combat/helpers";
import {
  answer,
  cardIn,
  drain,
  passBoth,
  promptOptions,
  settle,
  toTrash,
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

describe("Origins A–N — keyword-only partial cards (the unscripted line is a known gap)", () => {
  const rows: Array<{ name: string; keywords: string[]; tags: string }> = [
    { name: "Brazen Buccaneer", keywords: [], tags: "[R204.2]" },
    { name: "Commander Ledros", keywords: ["Deflect", "Ganking"], tags: "[R809.1.c][R810.1]" },
    { name: "Kraken Hunter", keywords: ["Accelerate", "Assault"], tags: "[R805.1.b][R807.1.c]" },
    { name: "Deadbloom Predator", keywords: ["Deflect"], tags: "[R809.1.c]" },
    { name: "Immortal Phoenix", keywords: ["Assault"], tags: "[R807.1.c]" },
    { name: "Kai'Sa, Evolutionary", keywords: ["Ganking"], tags: "[R810.1]" },
    { name: "Kayn, Unleashed", keywords: ["Ganking"], tags: "[R810.1]" },
    { name: "Nocturne, Horrifying", keywords: ["Ganking"], tags: "[R810.1]" },
  ];
  for (const row of rows) {
    it(`[C:${row.name}]${row.tags} is played at its printed cost with its printed keywords (status partial)`, () => {
      const s = withCards([row.name]);
      fund(s, "p1", row.name);
      s.as("p1").play(row.name).expectOk();
      const card = cardIn(s, "p1", "base", row.name)!;
      expect(card).toBeTruthy();
      for (const keyword of row.keywords)
        expect(effectiveKeywords(s.room, card.id, s.host)).toContain(keyword);
      const script = getCardScript(row.name)!;
      expect(script.status).toBe("partial");
      expect(script.notes).toMatch(/Not automated/);
    });
  }

  it("[C:Immortal Phoenix][R807.1.c] has Assault 2", () => {
    const s = withCards(["Immortal Phoenix"]);
    const phoenix = place(s, "p1", "Immortal Phoenix", "base");
    expect(effectiveKeywordValues(s.room, phoenix.id, s.host).assault).toBe(2);
  });
});

describe("Origins A–N — partially automated spells and units", () => {
  it("[C:Call to Glory][R479.4] gives a unit +3 Might this turn (the spend-a-buff cost is not automated)", () => {
    const s = withCards(["Call to Glory"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Call to Glory");
    s.as("p1")
      .play("Call to Glory", { choices: { "target:0": unit.id } })
      .expectOk();
    drain(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(6);
  });

  it("[C:Disintegrate][R418.1.b] deals 3 to a unit at a battlefield (the draw on kill is not automated)", () => {
    const s = withCards(["Disintegrate"]);
    const enemy = place(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Disintegrate");
    s.as("p1")
      .play("Disintegrate", { choices: { "target:0": enemy.id } })
      .expectOk();
    drain(s);
    expect(s.room.rules!.objects[enemy.id]?.damage).toBe(3);
  });

  it("[C:Guerilla Warfare][R355.13] returns up to two cards with Hidden from your trash to your hand", () => {
    const s = withCards(["Guerilla Warfare", "Block", "Block"]);
    const plain = toTrash(s, "p1", "Treasure Hunter");
    const block = toTrash(s, "p1", "Block");
    const block2 = toTrash(s, "p1", "Block");
    fund(s, "p1", "Guerilla Warfare");
    s.as("p1")
      .play("Guerilla Warfare", { choices: { "target:0": [block.id, block2.id] } })
      .expectOk();
    drain(s);
    expect(zoneOf(s, block.id)).toBe("hand");
    expect(zoneOf(s, block2.id)).toBe("hand");
    expect(zoneOf(s, plain.id)).toBe("trash");
    // A card without Hidden is not a legal choice.
    const t = withCards(["Guerilla Warfare"]);
    const nonHidden = toTrash(t, "p1", "Treasure Hunter");
    fund(t, "p1", "Guerilla Warfare");
    t.as("p1")
      .play("Guerilla Warfare", { choices: { "target:0": [nonHidden.id] } })
      .expectError("illegal_target");
  });

  it("[C:Karma, Channeler][R417.1] when you recycle a card to your Main Deck, buff a friendly unit", () => {
    const s = withCards(["Forge of the Future", "Karma, Channeler"]);
    const karma = place(s, "p1", "Karma, Channeler", "base");
    fund(s, "p1", "Forge of the Future");
    s.as("p1").play("Forge of the Future").expectOk();
    passBoth(s);
    const mine = boardOf(s, "p1").deck.splice(0, 1);
    expect(mine[0]).toBeTruthy();
    boardOf(s, "p1").trash.push(...mine);
    const forge = cardIn(s, "p1", "base", "Forge of the Future")!;
    activate(s, "p1", forge.id, "Forge of the Future", {
      choices: { "target:0": [mine[0]!.id] },
    }).expectOk();
    const prompt = drain(s);
    if (prompt) {
      answer(s, { optionIds: [karma.id] });
      drain(s);
    }
    expect(s.room.rules!.objects[karma.id]?.buffs).toBe(1);
  });

  it("[C:Mageseeker Warden][R054.1][R364.3.a] while at a battlefield, spells and abilities can't ready enemy units and gear", () => {
    const s = withCards(["Mageseeker Warden"]);
    const warden = place(s, "p1", "Mageseeker Warden", "battlefieldA");
    const enemy = place(s, "p2", "Astral Heron", "base", { exhausted: true });
    const friend = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    run(s, { op: "ready", target: { targetRef: `obj:${enemy.id}` } }, { controller: "p2" });
    run(s, { op: "ready", target: { targetRef: `obj:${friend.id}` } }, { controller: "p1" });
    expect(s.host.isExhausted(s.room, enemy.id)).toBe(true);
    expect(s.host.isExhausted(s.room, friend.id)).toBe(false);
    // At the base the restriction does not apply.
    s.host.moveCard(s.room, "p1", "battlefieldA", "base", warden.id);
    run(s, { op: "ready", target: { targetRef: `obj:${enemy.id}` } }, { controller: "p2" });
    expect(s.host.isExhausted(s.room, enemy.id)).toBe(false);
    expect(getCardScript("Mageseeker Warden")?.status).toBe("partial");
  });

  it("[C:Miss Fortune, Captain][R383.1.b][R403.1] the first time I move each turn, you may ready something else that's exhausted", () => {
    const s = withCards(["Miss Fortune, Captain"]);
    place(s, "p1", "Miss Fortune, Captain", "base");
    const tired = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    s.as("p1").move("Miss Fortune, Captain", "battlefieldB").expectOk();
    s.expectPrompt(undefined, "p1");
    answer(s, { optionIds: ["yes"] });
    settle(s, () => !s.host.isExhausted(s.room, tired.id));
    expect(s.host.isExhausted(s.room, tired.id)).toBe(false);
  });
});

describe("Origins A–N — Hallowed Tomb", () => {
  it("[C:Hallowed Tomb][R383.4.d][R403.1] when you hold here, you may return your Chosen Champion from your trash to your empty Champion Zone", () => {
    const s = withCards([], [], { battlefields: { p2: "Hallowed Tomb" } });
    place(s, "p2", "Astral Heron", "battlefieldB");
    setControl(s.room, "battlefieldB", "p2");
    const board = boardOf(s, "p2");
    const champion = board.champion.splice(0, 1)[0]!;
    board.trash.push(champion);
    s.as("p1").endTurn().expectOk();
    s.expectPrompt(undefined, "p2");
    answer(s, { optionIds: ["yes"] });
    drain(s);
    expect(boardOf(s, "p2").champion.map((card) => card.id)).toEqual([champion.id]);
    expect(zoneOf(s, champion.id)).toBe("champion");
  });
});
