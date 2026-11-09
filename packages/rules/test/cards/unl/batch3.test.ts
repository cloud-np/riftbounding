/**
 * Unleashed (UNL) batch 3 — spells.
 */
import { describe, expect, it } from "vitest";
import {
  costAdjustments,
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
  requiredChoices,
  lookupAbility,
  xpOf,
} from "../../../src";
import { boardOf, fund, place, run, zoneOf } from "../../rules/effects/helpers";
import { answer, cardsNamed, hand, resolveChain, withCards, type S } from "./helpers";

function playWith(s: S, player: string, name: string, extra: Record<string, unknown>): void {
  const card = s.handCard(player, name);
  if (!card) throw new Error(`${name} not in ${player}'s hand`);
  s.as(player)
    .apply({ type: "rules_play", cardId: card.id, ...extra } as never)
    .expectOk();
}

function optionIds(
  s: S,
  name: string,
  controller = "p1",
  choices: Record<string, unknown> = {},
): string[] {
  const ability = lookupAbility(name, "spell")!.ability;
  const specs = requiredChoices(s.room, s.host, ability, { controller, choices: choices as never });
  return specs[0]?.options.map((option) => option.id) ?? [];
}

/** Pass until a prompt opens or the chain empties. */
function untilPrompt(s: S): void {
  for (
    let guard = 0;
    guard < 12 && !s.room.rules!.prompt && s.room.rules!.chain.length > 0;
    guard += 1
  ) {
    const holder = s.room.rules!.priority;
    if (!holder) break;
    s.as(holder).pass().expectOk();
  }
}

describe("Unleashed batch 3 — draw, look and Repeat", () => {
  it("[C:Downstage Dramatics][R820.1.d][R820.3.a] draws 1, or 2 when Repeat [2] is paid", () => {
    const s = withCards(["Downstage Dramatics", "Downstage Dramatics"]);
    fund(s, "p1", "Downstage Dramatics");
    let before = hand(s, "p1").length;
    s.as("p1").play("Downstage Dramatics").expectOk();
    resolveChain(s);
    expect(hand(s, "p1")).toHaveLength(before);
    fund(s, "p1", "Downstage Dramatics");
    s.room.rules!.pools.p1!.energy += 2;
    before = hand(s, "p1").length;
    playWith(s, "p1", "Downstage Dramatics", { optionalCosts: ["repeat"] });
    expect(s.room.rules!.pools.p1!.energy).toBe(0);
    resolveChain(s);
    expect(hand(s, "p1")).toHaveLength(before + 1);
  });

  it("[C:Double Trouble][R425][R414][R417.5] look at 3, may reveal a unit and draw it, recycle the rest", () => {
    const s = withCards(["Double Trouble"]);
    fund(s, "p1", "Double Trouble");
    const top = s.host.lookAtTop(s.room, "p1", "deck", 3).map((card) => card.id);
    s.as("p1").play("Double Trouble").expectOk();
    untilPrompt(s);
    s.expectPrompt("choose-card", "p1");
    const offered = s.room.rules!.prompt!.options!.map((option) => option.id);
    for (const id of offered)
      expect(s.host.cardInfo(s.room, id)?.type.toLowerCase()).toContain("unit");
    expect(offered.length).toBeGreaterThan(0);
    answer(s, [offered[0]!]);
    expect(zoneOf(s, offered[0]!)).toBe("hand");
    const rest = top.filter((id) => id !== offered[0]);
    // 417.1: the rest go to the bottom of the Main Deck.
    const deck = s.host.lookAtTop(s.room, "p1", "deck", 999).map((card) => card.id);
    expect(deck.slice(-rest.length).sort()).toEqual([...rest].sort());
  });

  it("[C:Upstage Comedy][R820.2] readies a unit; a paid Repeat readies a second chosen unit", () => {
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
  });

  it("[C:Lunar Boon][R423.1.a][R414] discard 1, then draw 2", () => {
    const s = withCards(["Lunar Boon", "Gust"]);
    fund(s, "p1", "Lunar Boon");
    s.as("p1").play("Lunar Boon").expectOk();
    // Only Gust is in hand: it is discarded without a prompt (423.4 as many as possible).
    resolveChain(s);
    s.expectZone("p1", "Gust", "trash");
    expect(hand(s, "p1")).toHaveLength(2);
  });

  it("[C:Right of Conquest][R190.2] draw 1, then 1 for each battlefield you control", () => {
    const s = withCards(["Right of Conquest"]);
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    s.room.rules!.objects.battlefieldB = { controller: "p2" };
    fund(s, "p1", "Right of Conquest");
    const before = hand(s, "p1").length;
    s.as("p1").play("Right of Conquest").expectOk();
    resolveChain(s);
    expect(hand(s, "p1")).toHaveLength(before - 1 + 2);
  });

  it("[C:Concentrate][R366.2.a][R824] draw 2; costs [2] less at Level 6 and [4] less at Level 11", () => {
    const s = withCards(["Concentrate"]);
    const card = s.handCard("p1", "Concentrate")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: card.id })).toEqual([]);
    run(s, { op: "gain_xp", amount: 6 });
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: card.id })).toEqual([
      expect.objectContaining({ energy: -2 }),
    ]);
    run(s, { op: "gain_xp", amount: 5 });
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: card.id })).toEqual([
      expect.objectContaining({ energy: -4 }),
    ]);
    s.room.rules!.pools.p1 = { energy: 1, power: {} };
    const before = hand(s, "p1").length;
    s.as("p1").play("Concentrate").expectOk();
    resolveChain(s);
    expect(hand(s, "p1")).toHaveLength(before - 1 + 2);
  });
});

describe("Unleashed batch 3 — unit-targeting spells", () => {
  it("[C:Moonlight Affliction][R479.4] gives a unit -10 Might this turn", () => {
    const s = withCards(["Moonlight Affliction"]);
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    fund(s, "p1", "Moonlight Affliction");
    s.as("p1")
      .play("Moonlight Affliction", { choices: { "target:0": enemy.id } })
      .expectOk();
    resolveChain(s);
    expect(effectiveMight(s.room, enemy.id, s.host)).toBe(-7);
  });

  it("[C:Soul Harvest][R429] kills a unit at a battlefield with 3 Might or less", () => {
    const s = withCards(["Soul Harvest"]);
    const small = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    place(s, "p2", "Whiteflame Protector", "battlefieldA");
    place(s, "p2", "Treasure Hunter", "base");
    expect(optionIds(s, "Soul Harvest")).toEqual([small.id]);
    fund(s, "p1", "Soul Harvest");
    s.as("p1")
      .play("Soul Harvest", { choices: { "target:0": small.id } })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, small.id)).toBe("trash");
  });

  it("[C:The Ruination][R429][R355.5.a] kills all units", () => {
    const s = withCards(["The Ruination"]);
    const ids = [
      place(s, "p1", "Caitlyn, Patrolling", "base").id,
      place(s, "p2", "Whiteflame Protector", "battlefieldA").id,
      place(s, "p2", "Treasure Hunter", "base").id,
    ];
    fund(s, "p1", "The Ruination");
    s.as("p1").play("The Ruination").expectOk();
    resolveChain(s);
    for (const id of ids) expect(zoneOf(s, id)).toBe("trash");
  });

  it("[C:Monster Harpoon][R359.3.f.2][R107.3] deals 2, or 4 while you control a facedown card", () => {
    const s = withCards(["Monster Harpoon", "Monster Harpoon", "Back Off"]);
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldB");
    fund(s, "p1", "Monster Harpoon");
    s.as("p1")
      .play("Monster Harpoon", { choices: { "target:0": a.id } })
      .expectOk();
    resolveChain(s);
    expect(s.room.rules!.objects[a.id]?.damage).toBe(2);
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const backOff = s.handCard("p1", "Back Off")!;
    s.room.rules!.pools.p1 = { energy: 0, power: { any: 1 } };
    s.as("p1")
      .apply({ type: "rules_play", cardId: backOff.id, hide: true, location: "battlefieldA" })
      .expectOk();
    fund(s, "p1", "Monster Harpoon");
    s.as("p1")
      .play("Monster Harpoon", { choices: { "target:0": a.id } })
      .expectOk();
    resolveChain(s);
    expect(s.room.rules!.objects[a.id]?.damage).toBe(6);
  });

  it("[C:Combat Experience][R824][R727.1.b] +1 Might this turn, +3 instead at Level 6", () => {
    const s = withCards(["Combat Experience", "Combat Experience"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Combat Experience");
    s.as("p1")
      .play("Combat Experience", { choices: { "target:0": unit.id } })
      .expectOk();
    resolveChain(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);
    run(s, { op: "gain_xp", amount: 6 });
    fund(s, "p1", "Combat Experience");
    s.as("p1")
      .play("Combat Experience", { choices: { "target:0": unit.id } })
      .expectOk();
    resolveChain(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(7);
  });

  it("[C:Friendship][R143.1] +1 Might for each of Bird, Cat, Dog and Poro among your units", () => {
    const s = withCards(["Friendship", "Mutated Mouser", "Mosstomper"], ["Loyal Poro"]);
    const target = place(s, "p1", "Caitlyn, Patrolling", "base");
    place(s, "p1", "Mutated Mouser", "base"); // Cat
    place(s, "p1", "Mosstomper", "base"); // Dog
    run(s, { op: "create", token: { name: "Bird", play: true } }); // Bird
    place(s, "p2", "Loyal Poro", "base"); // an enemy Poro does not count
    fund(s, "p1", "Friendship");
    s.as("p1")
      .play("Friendship", { choices: { "target:0": target.id } })
      .expectOk();
    resolveChain(s);
    expect(effectiveMight(s.room, target.id, s.host)).toBe(6);
  });

  it("[C:Heroic Charge][R424][R355.7] +1 to a friendly unit and stun an enemy unit at its location", () => {
    const s = withCards(["Heroic Charge"], [], { firstPlayer: "p1" });
    const friend = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const near = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    place(s, "p2", "Astral Heron", "battlefieldB");
    expect(optionIds(s, "Heroic Charge", "p1", { "target:0": friend.id })).toEqual([near.id]);
    fund(s, "p1", "Heroic Charge");
    s.as("p1")
      .play("Heroic Charge", { choices: { "target:0": friend.id, "target:1": near.id } })
      .expectOk();
    resolveChain(s);
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(4);
    expect(s.room.rules!.objects[near.id]?.stunned).toBe(true);
  });

  it("[C:Back Off][R424][R811.1.b] stuns a unit and draws 1 when played from hand", () => {
    const s = withCards(["Back Off"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Back Off");
    const before = hand(s, "p1").length;
    s.as("p1")
      .play("Back Off", { choices: { "target:0": enemy.id } })
      .expectOk();
    resolveChain(s);
    expect(s.room.rules!.objects[enemy.id]?.stunned).toBe(true);
    expect(hand(s, "p1")).toHaveLength(before);
  });

  it("[C:Crescent Strike][R418] 4 to the chosen enemy unit and 1 to each other enemy unit there", () => {
    const s = withCards(["Crescent Strike"]);
    const main = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const other = place(s, "p2", "Astral Heron", "battlefieldA");
    const elsewhere = place(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    const mine = place(s, "p1", "Treasure Hunter", "base");
    fund(s, "p1", "Crescent Strike");
    s.as("p1")
      .play("Crescent Strike", { choices: { "target:0": main.id } })
      .expectOk();
    resolveChain(s);
    expect(s.room.rules!.objects[main.id]?.damage).toBe(4);
    expect(s.room.rules!.objects[other.id]?.damage).toBe(1);
    expect(s.room.rules!.objects[elsewhere.id]?.damage).toBeUndefined();
    expect(s.room.rules!.objects[mine.id]?.damage).toBeUndefined();
  });

  it("[C:Clash of Giants][R418.6.b.3] two chosen units deal damage equal to their Mights to each other", () => {
    const s = withCards(["Clash of Giants"]);
    const big = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const small = place(s, "p2", "Caitlyn, Patrolling", "battlefieldB");
    fund(s, "p1", "Clash of Giants");
    s.as("p1")
      .play("Clash of Giants", { choices: { "target:0": big.id, "target:1": small.id } })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, small.id)).toBe("trash");
    expect(s.room.rules!.objects[big.id]?.damage).toBe(3);
    // The same unit cannot be both choices.
    const ability = lookupAbility("Clash of Giants", "spell")!.ability;
    const specs = requiredChoices(s.room, s.host, ability, {
      controller: "p1",
      choices: { "target:1": big.id },
    });
    expect(specs.find((spec) => spec.key === "target:0")?.options.map((o) => o.id)).not.toContain(
      big.id,
    );
  });

  it("[C:Isolate][R421][R740.2.a] moves an enemy unit to its base; draws if an enemy unit is then alone there", () => {
    const s = withCards(["Isolate", "Isolate"]);
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = place(s, "p2", "Astral Heron", "battlefieldA");
    fund(s, "p1", "Isolate");
    const before = hand(s, "p1").length;
    s.as("p1")
      .play("Isolate", { choices: { "target:0": a.id } })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, a.id)).toBe("base");
    expect(hand(s, "p1")).toHaveLength(before - 1 + 1);
    // Moving the last enemy unit leaves none there: no draw.
    fund(s, "p1", "Isolate");
    const again = hand(s, "p1").length;
    s.as("p1")
      .play("Isolate", { choices: { "target:0": b.id } })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, b.id)).toBe("base");
    expect(hand(s, "p1")).toHaveLength(again - 1);
  });

  it("[C:Keeper's Verdict][R412.4] the owner places the chosen enemy unit on the top or bottom of their deck", () => {
    const s = withCards(["Keeper's Verdict"]);
    const enemy = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Keeper's Verdict");
    s.as("p1")
      .play("Keeper's Verdict", { choices: { "target:0": enemy.id } })
      .expectOk();
    untilPrompt(s);
    s.expectPrompt("choose-mode", "p2");
    answer(s, ["top"]);
    expect(s.host.lookAtTop(s.room, "p2", "deck", 1)[0]?.id).toBe(enemy.id);
    expect(s.room.rules!.objects[enemy.id]).toBeUndefined();
  });

  it("[C:Shadow's Call][R801.3.a][R816] a friendly unit without Temporary gains Temporary; draw 2", () => {
    const s = withCards(["Shadow's Call"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    run(s, { op: "create", token: { name: "Sprite", play: true } });
    const sprite = cardsNamed(s, "p1", "base", "Sprite")[0]!;
    expect(optionIds(s, "Shadow's Call")).toEqual([unit.id]);
    expect(optionIds(s, "Shadow's Call")).not.toContain(sprite.id);
    fund(s, "p1", "Shadow's Call");
    const before = hand(s, "p1").length;
    s.as("p1")
      .play("Shadow's Call", { choices: { "target:0": unit.id } })
      .expectOk();
    resolveChain(s);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toContain("Temporary");
    expect(hand(s, "p1")).toHaveLength(before - 1 + 2);
  });

  it("[C:Turn to Dust][R801.3.a] gives a gear Temporary", () => {
    const s = withCards(["Turn to Dust"], ["Divining Shells"]);
    const gear = place(s, "p2", "Divining Shells", "base");
    fund(s, "p1", "Turn to Dust");
    s.as("p1")
      .play("Turn to Dust", { choices: { "target:0": gear.id } })
      .expectOk();
    resolveChain(s);
    expect(effectiveKeywords(s.room, gear.id, s.host)).toContain("Temporary");
  });

  it("[C:Star-Crossed][R056] returns a friendly unit and an enemy unit to their owners' hands", () => {
    const s = withCards(["Star-Crossed"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "base");
    const theirs = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    fund(s, "p1", "Star-Crossed");
    s.as("p1")
      .play("Star-Crossed", { choices: { "target:0": mine.id, "target:1": theirs.id } })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, mine.id)).toBe("hand");
    expect(zoneOf(s, theirs.id)).toBe("hand");
    expect(hand(s, "p2").some((card) => card.id === theirs.id)).toBe(true);
  });

  it("[C:Sprite Burst][R440.2.c][R816] plays two ready 3 Might Sprites with Temporary", () => {
    const s = withCards(["Sprite Burst"]);
    fund(s, "p1", "Sprite Burst");
    s.as("p1").play("Sprite Burst").expectOk();
    resolveChain(s);
    const sprites = cardsNamed(s, "p1", "base", "Sprite");
    expect(sprites).toHaveLength(2);
    for (const sprite of sprites) {
      expect(sprite.exhausted).toBe(false);
      expect(effectiveMight(s.room, sprite.id, s.host)).toBe(3);
      expect(effectiveKeywordValues(s.room, sprite.id, s.host).temporary).toBe(1);
    }
  });

  it("[C:Vault Breaker][R801.3.a][R807.2] Assault 2 and Ganking this turn", () => {
    const s = withCards(["Vault Breaker"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Vault Breaker");
    s.as("p1")
      .play("Vault Breaker", { choices: { "target:0": unit.id } })
      .expectOk();
    resolveChain(s);
    expect(effectiveKeywords(s.room, unit.id, s.host)).toEqual(
      expect.arrayContaining(["Assault", "Ganking"]),
    );
    expect(effectiveKeywordValues(s.room, unit.id, s.host).assault).toBe(2);
  });
});

describe("Unleashed batch 3 — counters and modes", () => {
  it("[C:Abandon][R426.1.a][R437] counters a spell, which returns to its owner's hand; then Predict", () => {
    const s = withCards(["Moonlight Affliction"], ["Abandon"]);
    const unit = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Moonlight Affliction");
    s.as("p1")
      .play("Moonlight Affliction", { choices: { "target:0": unit.id } })
      .expectOk();
    const item = s.room.rules!.chain[0]!;
    fund(s, "p2", "Abandon");
    s.as("p2")
      .play("Abandon", { choices: { "target:0": item.id } })
      .expectOk();
    untilPrompt(s);
    s.expectPrompt("choose-card", "p2");
    answer(s, []);
    resolveChain(s);
    s.expectZone("p1", "Moonlight Affliction", "hand");
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3);
  });

  it("[C:Lilting Lullaby][R426][R054.1] counters a spell; its controller can't play spells this turn", () => {
    const s = withCards(["Moonlight Affliction", "Lunar Boon"], ["Lilting Lullaby"]);
    const unit = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Moonlight Affliction");
    s.as("p1")
      .play("Moonlight Affliction", { choices: { "target:0": unit.id } })
      .expectOk();
    const item = s.room.rules!.chain[0]!;
    fund(s, "p2", "Lilting Lullaby");
    s.as("p2")
      .play("Lilting Lullaby", { choices: { "target:0": item.id } })
      .expectOk();
    resolveChain(s);
    s.expectZone("p1", "Moonlight Affliction", "trash");
    fund(s, "p1", "Lunar Boon");
    s.as("p1").play("Lunar Boon").expectError("restricted");
  });

  it("[C:Flurry of Feathers][R355.3] choose one: counter a spell, or play four Birds", () => {
    const s = withCards(["Moonlight Affliction", "Flurry of Feathers"], ["Flurry of Feathers"]);
    const unit = place(s, "p2", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Moonlight Affliction");
    s.as("p1")
      .play("Moonlight Affliction", { choices: { "target:0": unit.id } })
      .expectOk();
    const item = s.room.rules!.chain[0]!;
    fund(s, "p2", "Flurry of Feathers");
    s.as("p2")
      .play("Flurry of Feathers", { choices: { mode: "counter", "target:0": item.id } })
      .expectOk();
    resolveChain(s);
    s.expectZone("p1", "Moonlight Affliction", "trash");
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(3);
    fund(s, "p1", "Flurry of Feathers");
    s.as("p1")
      .play("Flurry of Feathers", { choices: { mode: "birds" } })
      .expectOk();
    resolveChain(s);
    const birds = cardsNamed(s, "p1", "base", "Bird");
    expect(birds).toHaveLength(4);
    expect(effectiveKeywordValues(s.room, birds[0]!.id, s.host).deflect).toBe(1);
  });

  it("[C:Disposal Order][R355.3][R417.1.c] recycle up to 3 cards from opponents' trashes, or draw 1", () => {
    const s = withCards(["Disposal Order", "Disposal Order"]);
    const theirs = boardOf(s, "p2");
    theirs.trash.push(...theirs.deck.splice(0, 4));
    const picks = theirs.trash.slice(0, 3).map((card) => card.id);
    fund(s, "p1", "Disposal Order");
    s.as("p1")
      .play("Disposal Order", { choices: { mode: "recycle", "target:0": picks } })
      .expectOk();
    resolveChain(s);
    expect(boardOf(s, "p2").trash).toHaveLength(1);
    for (const id of picks) expect(zoneOf(s, id)).toBe("deck");
    fund(s, "p1", "Disposal Order");
    const before = hand(s, "p1").length;
    s.as("p1")
      .play("Disposal Order", { choices: { mode: "draw" } })
      .expectOk();
    resolveChain(s);
    expect(hand(s, "p1")).toHaveLength(before);
  });
});

describe("Unleashed batch 3 — battlefield and move spells", () => {
  it("[C:Stare Down][R421][R355.7] moves enemy units with less Might than the chosen unit at the chosen battlefield to base; gain 1 XP", () => {
    const s = withCards(["Stare Down"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "base");
    const weak = place(s, "p2", "Treasure Hunter", "battlefieldA");
    const strong = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const elsewhere = place(s, "p2", "Treasure Hunter", "battlefieldB");
    fund(s, "p1", "Stare Down");
    s.as("p1")
      .play("Stare Down", {
        choices: { "target:0": mine.id, battlefield: "battlefield:battlefieldA" },
      })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, weak.id)).toBe("base");
    expect(zoneOf(s, strong.id)).toBe("battlefieldA");
    expect(zoneOf(s, elsewhere.id)).toBe("battlefieldB");
    expect(xpOf(s.room, "p1")).toBe(1);
  });

  it("[C:Moonfall][R421][R355.13] at a battlefield where you have units: move up to one enemy unit there, then enemy units there get -2", () => {
    const s = withCards(["Moonfall"]);
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const visitor = place(s, "p2", "Whiteflame Protector", "base");
    const ability = lookupAbility("Moonfall", "spell")!.ability;
    const specs = requiredChoices(s.room, s.host, ability, { controller: "p1", choices: {} });
    expect(specs[0]!.options.map((o) => o.id)).toEqual(["battlefield:battlefieldA"]);
    fund(s, "p1", "Moonfall");
    s.as("p1")
      .play("Moonfall", {
        choices: { battlefield: "battlefield:battlefieldA", "target:0": [visitor.id] },
      })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, visitor.id)).toBe("battlefieldA");
    expect(effectiveMight(s.room, visitor.id, s.host)).toBe(6);
  });

  it("[C:Void Assault][R421][R355.4] moves a friendly unit, then an enemy unit, each to its chosen destination", () => {
    const s = withCards(["Void Assault"]);
    const mine = place(s, "p1", "Caitlyn, Patrolling", "base");
    const theirs = place(s, "p2", "Whiteflame Protector", "base");
    fund(s, "p1", "Void Assault");
    s.as("p1")
      .play("Void Assault", {
        choices: {
          "target:0": mine.id,
          destination: "battlefieldB",
          "target:1": theirs.id,
          "destination:1": "battlefieldB",
        },
      })
      .expectOk();
    resolveChain(s);
    expect(zoneOf(s, mine.id)).toBe("battlefieldB");
    expect(zoneOf(s, theirs.id)).toBe("battlefieldB");
  });

  it("[C:Grim Resolve][R390][R468.3.c] +3 to a friendly unit; when it wins a combat this turn, gain 2 XP", () => {
    const s = withCards(["Grim Resolve"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    place(s, "p2", "Treasure Hunter", "battlefieldB");
    fund(s, "p1", "Grim Resolve");
    s.as("p1")
      .play("Grim Resolve", { choices: { "target:0": unit.id } })
      .expectOk();
    resolveChain(s);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(6);
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldB").expectOk();
    for (let guard = 0; guard < 20 && xpOf(s.room, "p1") === 0; guard += 1) {
      const prompt = s.room.rules!.prompt;
      if (prompt) {
        s.as(prompt.playerId).choose({
          optionIds: prompt.options?.slice(0, prompt.min).map((o) => o.id) ?? [],
        });
        continue;
      }
      const actor = s.room.rules!.priority ?? s.room.rules!.focus;
      if (!actor) break;
      s.as(actor).pass();
    }
    expect(xpOf(s.room, "p1")).toBe(2);
  });
});
