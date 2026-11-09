/**
 * Spiritforged (SFD) wave R3 batch 4 — attachments, computed amounts, counters, reflexive
 * effects, legends and units.
 */
import { describe, expect, it } from "vitest";
import {
  costAdjustments,
  effectiveKeywordValues,
  effectiveKeywords,
  effectiveMight,
} from "../../../src";
import { run } from "../../rules/effects/helpers";
import {
  addPool,
  attack,
  onTop,
  boardCard,
  boardOf,
  countNamed,
  damageOf,
  hand,
  playCard,
  put,
  resolveChain,
  setControl,
  settle,
  statusOf,
  withCards,
  zoneOf,
  type S,
} from "./helpers";

const QUIET = { battlefields: { p1: "Bandle Tree", p2: "Bandle Tree" } };

function attachTo(s: S, gearId: string, unitId: string, controller = "p1"): void {
  run(
    s,
    { op: "attach", gear: { targetRef: `obj:${gearId}` }, to: { targetRef: `obj:${unitId}` } },
    { controller },
  );
}

function activate(
  s: S,
  objectId: string,
  ability: string,
  choices: Record<string, unknown> = {},
): S {
  return s.as("p1").apply({ type: "rules_activate", objectId, ability, choices } as never);
}

describe("SFD batch 4 — attachments", () => {
  it("[C:Angle Shot][R435][R436] attaches an Equipment to a unit with the same controller (or detaches it); draw 1", () => {
    const s = withCards(["Angle Shot", "Angle Shot", "Angle Shot", "Doran's Blade"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const gear = put(s, "p1", "Doran's Blade", "base");
    const before = hand(s, "p1").length;
    playCard(s, "p1", "Angle Shot", {
      choices: { "target:0": unit.id, "target:1": gear.id },
    }).expectOk();
    settle(s);
    expect(boardCard(s, "p1", "Doran's Blade")!.attachedToCardId).toBe(unit.id);
    expect(hand(s, "p1").length).toBe(before - 1 + 1);
    playCard(s, "p1", "Angle Shot", {
      choices: { "target:0": unit.id, "target:1": gear.id },
    }).expectOk();
    settle(s);
    expect(boardCard(s, "p1", "Doran's Blade")!.attachedToCardId).toBeUndefined();
    // Different controllers: not a legal pair.
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Angle Shot", {
      choices: { "target:0": enemy.id, "target:1": gear.id },
      fund: false,
    }).expectError("illegal_target");
  });

  it("[C:Aphelios, Exalted][R435][R355.3] attaching an Equipment to me: choose a mode not chosen this turn", () => {
    const s = withCards([
      "Aphelios, Exalted",
      "Angle Shot",
      "Angle Shot",
      "Doran's Blade",
      "Long Sword",
    ]);
    const aphelios = put(s, "p1", "Aphelios, Exalted", "base");
    const blade = put(s, "p1", "Doran's Blade", "base");
    const sword = put(s, "p1", "Long Sword", "base");
    const runes = boardOf(s, "p1").runeArea.length;
    playCard(s, "p1", "Angle Shot", {
      choices: { "target:0": aphelios.id, "target:1": blade.id },
    }).expectOk();
    settle(s, (prompt) => (prompt.kind === "choose-mode" ? { optionIds: ["channel"] } : undefined));
    expect(boardOf(s, "p1").runeArea.length).toBe(runes + 1);
    playCard(s, "p1", "Angle Shot", {
      choices: { "target:0": aphelios.id, "target:1": sword.id },
    }).expectOk();
    let offered: string[] = [];
    settle(s, (prompt) => {
      if (prompt.kind !== "choose-mode") return undefined;
      offered = (prompt.options ?? []).map((option) => option.id);
      return { optionIds: ["buff"] };
    });
    expect(offered).toEqual(["ready", "buff"]);
    expect(s.room.rules!.objects[aphelios.id]?.buffs).toBe(1);
  });

  it("[C:Jax, Grandmaster at Arms][R435] [1],[Tap]: attach a detached Equipment; [Tap]: move an attached Equipment", () => {
    const s = withCards(["Jax, Grandmaster at Arms", "Doran's Blade"]);
    const jax = put(s, "p1", "Jax, Grandmaster at Arms", "legend");
    const a = put(s, "p1", "Caitlyn, Patrolling", "base");
    const b = put(s, "p1", "Astral Heron", "base");
    const gear = put(s, "p1", "Doran's Blade", "base");
    addPool(s, "p1", 1);
    activate(s, jax.id, "activated:0", { "target:0": gear.id, "target:1": a.id }).expectOk();
    settle(s);
    expect(boardCard(s, "p1", "Doran's Blade")!.attachedToCardId).toBe(a.id);
    s.host.setExhausted(s.room, jax.id, false);
    activate(s, jax.id, "activated:1", { "target:0": gear.id, "target:1": b.id }).expectOk();
    settle(s);
    expect(boardCard(s, "p1", "Doran's Blade")!.attachedToCardId).toBe(b.id);
  });

  it("[C:Jax, Unrelenting][R435] when you attach an Equipment to me, may pay [1] to draw 1 (Weaponmaster: partial)", () => {
    const s = withCards(["Jax, Unrelenting", "Angle Shot", "Doran's Blade"]);
    const jax = put(s, "p1", "Jax, Unrelenting", "base");
    const gear = put(s, "p1", "Doran's Blade", "base");
    playCard(s, "p1", "Angle Shot", {
      choices: { "target:0": jax.id, "target:1": gear.id },
    }).expectOk();
    addPool(s, "p1", 1);
    const before = hand(s, "p1").length;
    settle(s);
    // Angle Shot's own draw + Jax's draw.
    expect(hand(s, "p1").length).toBe(before + 2);
    expect(statusOf("Jax, Unrelenting")).toBe("partial");
  });

  it("[C:Strike Down][R418.6] an equipped friendly unit deals damage equal to its Might to an enemy unit, then an Equipment detaches", () => {
    const s = withCards(["Strike Down", "Doran's Blade"]);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const gear = put(s, "p1", "Doran's Blade", "base");
    const plain = put(s, "p1", "Astral Heron", "base");
    attachTo(s, gear.id, unit.id);
    const enemy = put(s, "p2", "Whiteflame Protector", "battlefieldA");
    playCard(s, "p1", "Strike Down", {
      choices: { "target:0": plain.id, "target:1": enemy.id },
    }).expectError("illegal_target");
    playCard(s, "p1", "Strike Down", {
      choices: { "target:0": unit.id, "target:1": enemy.id },
      fund: false,
    }).expectOk();
    resolveChain(s);
    expect(damageOf(s, enemy.id)).toBe(5);
    expect(boardCard(s, "p1", "Doran's Blade")!.attachedToCardId).toBeUndefined();
  });
});

describe("SFD batch 4 — triggers and computed amounts", () => {
  it("[C:Altar of Memories][R415.4] when a friendly unit dies, may exhaust me: draw 1, then put a card from hand on top or bottom", () => {
    const s = withCards(["Drag Under"], ["Altar of Memories", "Premonition"]);
    const altar = put(s, "p2", "Altar of Memories", "base");
    const victim = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const spell = s.handCard("p2", "Premonition")!;
    playCard(s, "p1", "Drag Under", { choices: { "target:0": victim.id } }).expectOk();
    settle(s, (prompt) => {
      if (prompt.kind === "choose-card") return { optionIds: [spell.id] };
      if (prompt.kind === "choose-mode") return { optionIds: ["top"] };
      return undefined;
    });
    expect(s.host.isExhausted(s.room, altar.id)).toBe(true);
    const deck = boardOf(s, "p2").deck;
    expect(deck[deck.length - 1]!.id).toBe(spell.id);
  });

  it("[C:Lucian, Gunslinger][R807] when I attack, deal damage equal to my Assault to an enemy unit here", () => {
    const s = withCards(["Lucian, Gunslinger"], [], QUIET);
    const { defenders } = attack(s, "Lucian, Gunslinger", ["Astral Heron"]);
    resolveChain(s);
    expect(damageOf(s, defenders[0]!.id)).toBe(1);
  });

  it("[C:Kato the Arm][R801.3.a] when I move to a battlefield, another friendly unit gets my keywords and my Might this turn", () => {
    const s = withCards(["Kato the Arm"], [], QUIET);
    put(s, "p1", "Kato the Arm", "base");
    const friend = put(s, "p1", "Caitlyn, Patrolling", "base");
    s.as("p1").move("Kato the Arm", "battlefieldA").expectOk();
    settle(s);
    expect(effectiveKeywords(s.room, friend.id, s.host)).toContain("Deflect");
    expect(effectiveMight(s.room, friend.id, s.host)).toBe(3 + 3);
  });

  it("[C:Fiora, Peerless][R433.1.a] attacking one on one doubles my Might this combat", () => {
    const s = withCards(["Fiora, Peerless"], [], QUIET);
    const { attacker } = attack(s, "Fiora, Peerless", ["Astral Heron"]);
    resolveChain(s);
    expect(effectiveMight(s.room, attacker.id, s.host)).toBe(6);
    const crowd = withCards(["Fiora, Peerless"], [], QUIET);
    attack(crowd, "Fiora, Peerless", ["Treasure Hunter", "Stellacorn Herder"]);
    expect(crowd.room.rules!.chain.some((item) => item.cardName === "Fiora, Peerless")).toBe(false);
  });

  it("[C:Ancient Warmonger][R807] Assault equal to the number of enemy units here", () => {
    const s = withCards(["Ancient Warmonger"]);
    const unit = put(s, "p1", "Ancient Warmonger", "battlefieldA");
    expect(effectiveKeywordValues(s.room, unit.id, s.host).assault).toBeUndefined();
    put(s, "p2", "Treasure Hunter", "battlefieldA");
    put(s, "p2", "Stellacorn Herder", "battlefieldA");
    put(s, "p2", "Astral Heron", "battlefieldB");
    expect(effectiveKeywordValues(s.room, unit.id, s.host).assault).toBe(2);
    expect(statusOf("Ancient Warmonger")).toBe("partial");
  });

  it("[C:Lucian, Purifier][R807][R718] your Equipment each give Assault to the equipped unit", () => {
    const s = withCards(["Lucian, Purifier", "Doran's Blade", "Long Sword"]);
    put(s, "p1", "Lucian, Purifier", "legend");
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    expect(effectiveKeywordValues(s.room, unit.id, s.host).assault).toBeUndefined();
    attachTo(s, put(s, "p1", "Doran's Blade", "base").id, unit.id);
    attachTo(s, put(s, "p1", "Long Sword", "base").id, unit.id);
    expect(effectiveKeywordValues(s.room, unit.id, s.host).assault).toBe(2);
  });
});

describe("SFD batch 4 — spells", () => {
  it("[C:Counter Strike][R438][R375] the next damage to the chosen unit this turn is prevented; draw 1", () => {
    const s = withCards(["Counter Strike", "Hextech Ray", "Hextech Ray"]);
    const unit = put(s, "p2", "Astral Heron", "battlefieldA");
    const before = hand(s, "p1").length;
    playCard(s, "p1", "Counter Strike", { choices: { "target:0": unit.id } }).expectOk();
    resolveChain(s);
    expect(hand(s, "p1").length).toBe(before - 1 + 1);
    playCard(s, "p1", "Hextech Ray", { choices: { "target:0": unit.id } }).expectOk();
    resolveChain(s);
    expect(damageOf(s, unit.id)).toBe(0);
    playCard(s, "p1", "Hextech Ray", { choices: { "target:0": unit.id } }).expectOk();
    resolveChain(s);
    expect(damageOf(s, unit.id)).toBe(3);
  });

  it("[C:Emperor's Divide][R421] moves any number of friendly units at battlefields to their base", () => {
    const s = withCards(["Emperor's Divide"], [], QUIET);
    const a = put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const b = put(s, "p1", "Astral Heron", "battlefieldB");
    playCard(s, "p1", "Emperor's Divide", { choices: { "target:0": [a.id, b.id] } }).expectOk();
    settle(s);
    expect(zoneOf(s, a.id)).toBe("base");
    expect(zoneOf(s, b.id)).toBe("base");
  });

  it("[C:Not So Fast][R426] counters an enemy spell that chooses a friendly unit", () => {
    const s = withCards(["Hextech Ray"], ["Not So Fast"]);
    const unit = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Hextech Ray", { choices: { "target:0": unit.id } }).expectOk();
    const ray = s.room.rules!.chain[0]!;
    playCard(s, "p2", "Not So Fast", { choices: { "target:0": ray.id } }).expectOk();
    resolveChain(s);
    expect(damageOf(s, unit.id)).toBe(0);
    expect(s.room.rules!.chain).toHaveLength(0);
  });

  it("[C:Riposte][R426] counters a spell; a friendly unit gets +Might equal to its Energy cost this turn", () => {
    const s = withCards(["Hextech Ray"], ["Riposte"]);
    const unit = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Hextech Ray", { choices: { "target:0": unit.id } }).expectOk();
    const ray = s.room.rules!.chain[0]!;
    const cost = s.host.cardInfo(s.room, ray.cardSnapshot!.id)?.energyCost ?? 0;
    playCard(s, "p2", "Riposte", {
      choices: { "target:0": unit.id, "target:1": ray.id },
    }).expectOk();
    resolveChain(s);
    expect(damageOf(s, unit.id)).toBe(0);
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(7 + cost);
  });

  it("[C:Switcheroo][R434] swaps the Might of two units at the same battlefield this turn", () => {
    const s = withCards(["Switcheroo"]);
    const small = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const big = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Switcheroo", {
      choices: { "target:0": small.id, "target:1": big.id },
    }).expectOk();
    resolveChain(s);
    expect(effectiveMight(s.room, small.id, s.host)).toBe(7);
    expect(effectiveMight(s.room, big.id, s.host)).toBe(3);
  });

  it("[C:Arise!][R388][R440] a Sand Soldier for each Equipment you control; then ready up to two of them", () => {
    const s = withCards(["Arise!", "Doran's Blade", "Long Sword", "Sterak's Gage"]);
    put(s, "p1", "Doran's Blade", "base");
    put(s, "p1", "Long Sword", "base");
    put(s, "p1", "Sterak's Gage", "base");
    playCard(s, "p1", "Arise!").expectOk();
    settle(s, (prompt) =>
      prompt.kind === "choose-target"
        ? { optionIds: (prompt.options ?? []).slice(0, 2).map((option) => option.id) }
        : undefined,
    );
    const soldiers = boardOf(s, "p1").base.filter((card) => card.name === "Sand Soldier");
    expect(soldiers).toHaveLength(3);
    expect(soldiers.filter((card) => !card.exhausted)).toHaveLength(2);
  });

  it("[C:Guards!][R388][R740.4.a] plays a Sand Soldier; then may pay [Order] to ready it", () => {
    const s = withCards(["Guards!"]);
    playCard(s, "p1", "Guards!").expectOk();
    addPool(s, "p1", 0, { Order: 1 });
    settle(s);
    expect(boardCard(s, "p1", "Sand Soldier")!.exhausted).toBe(false);
  });

  it("[C:Relentless Pursuit][R421][R435][R393] moves a friendly unit, may attach an Equipment; this turn it may return to base when it conquers", () => {
    const s = withCards(["Relentless Pursuit", "Doran's Blade"], [], QUIET);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    const gear = put(s, "p1", "Doran's Blade", "base");
    playCard(s, "p1", "Relentless Pursuit", {
      choices: { "target:0": unit.id, destination: "battlefieldA", "target:1": [gear.id] },
    }).expectOk();
    settle(s);
    expect(boardCard(s, "p1", "Doran's Blade")!.attachedToCardId).toBe(unit.id);
    expect(zoneOf(s, unit.id)).toBe("base");
  });

  it("[C:Void Drone][R366.2.a] costs [2] less when played from anywhere other than your hand", () => {
    const s = withCards(["Void Drone"]);
    const drone = s.handCard("p1", "Void Drone")!;
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: drone.id })).toEqual([]);
    s.host.moveCardToOwnerZone(s.room, drone.id, "trash");
    expect(costAdjustments(s.room, s.host, { playerId: "p1", cardId: drone.id })).toEqual([
      expect.objectContaining({ energy: -2 }),
    ]);
  });
});

describe("SFD batch 4 — Repeat spells (first execution)", () => {
  it("[C:Marching Orders][R418.6] a friendly unit and an enemy unit at a battlefield deal damage equal to their Mights to each other", () => {
    const s = withCards(["Marching Orders"]);
    const mine = put(s, "p1", "Astral Heron", "base");
    const theirs = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    playCard(s, "p1", "Marching Orders", {
      choices: { "target:0": mine.id, "target:1": theirs.id },
    }).expectOk();
    resolveChain(s);
    expect(zoneOf(s, theirs.id)).toBe("trash");
    expect(damageOf(s, mine.id)).toBe(3);
  });

  it("[C:Piercing Light][R418] deals 2 to a unit at a battlefield, then 2 to up to one other unit", () => {
    const s = withCards(["Piercing Light"]);
    const a = put(s, "p2", "Astral Heron", "battlefieldA");
    const b = put(s, "p2", "Whiteflame Protector", "base");
    playCard(s, "p1", "Piercing Light", {
      choices: { "target:0": a.id, "target:1": [b.id] },
    }).expectOk();
    resolveChain(s);
    expect([damageOf(s, a.id), damageOf(s, b.id)]).toEqual([2, 2]);
  });

  it("[C:Rocket Barrage][R355.3] choose one: deal 4 to a unit in a base, or kill a gear", () => {
    const s = withCards(["Rocket Barrage", "Rocket Barrage"], ["Doran's Blade"]);
    const unit = put(s, "p2", "Astral Heron", "base");
    const gear = put(s, "p2", "Doran's Blade", "base");
    playCard(s, "p1", "Rocket Barrage", {
      choices: { mode: "deal", "target:0": unit.id },
    }).expectOk();
    resolveChain(s);
    expect(damageOf(s, unit.id)).toBe(4);
    playCard(s, "p1", "Rocket Barrage", {
      choices: { mode: "kill", "target:1": gear.id },
    }).expectOk();
    resolveChain(s);
    expect(zoneOf(s, gear.id)).toBe("trash");
  });

  it("[C:Thwonk!][R424] stuns an attacking unit", () => {
    const s = withCards([], ["Thwonk!"], QUIET);
    const { attacker } = attack(s, "Astral Heron", ["Treasure Hunter"]);
    s.as("p1").pass().expectOk();
    playCard(s, "p2", "Thwonk!", { choices: { "target:0": attacker.id } }).expectOk();
    s.as("p1").pass().expectOk();
    expect(s.room.rules!.objects[attacker.id]?.stunned).toBeTruthy();
  });

  it("[C:Hard Bargain][R426][R445.2] counters a spell unless its controller pays [2]", () => {
    const s = withCards(["Hextech Ray", "Hextech Ray"], ["Hard Bargain", "Hard Bargain"]);
    const unit = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Hextech Ray", { choices: { "target:0": unit.id } }).expectOk();
    playCard(s, "p2", "Hard Bargain", {
      choices: { "target:0": s.room.rules!.chain[0]!.id },
    }).expectOk();
    // P1 could pay (two runes) but declines: the spell is countered.
    resolveChain(s, (prompt) => (prompt.kind === "yes-no" ? { optionIds: ["no"] } : undefined));
    expect(damageOf(s, unit.id)).toBe(0);
    // This time the controller pays [2] and the spell resolves.
    playCard(s, "p1", "Hextech Ray", { choices: { "target:0": unit.id } }).expectOk();
    playCard(s, "p2", "Hard Bargain", {
      choices: { "target:0": s.room.rules!.chain[0]!.id },
    }).expectOk();
    addPool(s, "p1", 2);
    resolveChain(s, (prompt) => (prompt.kind === "yes-no" ? { optionIds: ["yes"] } : undefined));
    expect(damageOf(s, unit.id)).toBe(3);
  });

  it("[C:Temptation][R421][R355.4] moves an enemy unit to a location holding another unit of its controller", () => {
    const s = withCards(["Temptation"], [], QUIET);
    const lone = put(s, "p2", "Caitlyn, Patrolling", "base");
    put(s, "p2", "Astral Heron", "battlefieldB");
    playCard(s, "p1", "Temptation", { choices: { "target:0": lone.id } }).expectOk();
    resolveChain(s);
    expect(zoneOf(s, lone.id)).toBe("battlefieldB");
  });
});

describe("SFD batch 4 — units and legends", () => {
  it("[C:Azir, Sovereign][R421] when I attack, may move any number of your token units here", () => {
    const s = withCards(["Azir, Sovereign", "Desert's Call"], [], QUIET);
    playCard(s, "p1", "Desert's Call").expectOk();
    settle(s);
    const soldier = boardCard(s, "p1", "Sand Soldier")!;
    attack(s, "Azir, Sovereign", ["Treasure Hunter"]);
    resolveChain(s, (prompt) =>
      prompt.kind === "choose-card" ? { optionIds: [soldier.id] } : undefined,
    );
    expect(zoneOf(s, soldier.id)).toBe("battlefieldA");
  });

  it("[C:Glasc Mixologist][R808][R420.3] Deathknell: may play a unit costing ≤[3] and ≤[Rune] from your trash, ignoring its cost", () => {
    const s = withCards(["Drag Under"], ["Glasc Mixologist", "Treasure Hunter"]);
    const mixologist = put(s, "p2", "Glasc Mixologist", "battlefieldA");
    const hunter = put(s, "p2", "Treasure Hunter", "trash");
    playCard(s, "p1", "Drag Under", { choices: { "target:0": mixologist.id } }).expectOk();
    settle(s, (prompt) => (prompt.kind === "choose-card" ? { optionIds: [hunter.id] } : undefined));
    expect(zoneOf(s, hunter.id)).toBe("base");
  });

  it("[C:Ornn, Blacksmith][R425][R414][R417] when played (or holding): look at 4, may reveal and draw a gear, recycle the rest", () => {
    const s = withCards(["Ornn, Blacksmith", "Doran's Blade"]);
    const gear = onTop(s, "p1", "Doran's Blade");
    const before = hand(s, "p1").length;
    playCard(s, "p1", "Ornn, Blacksmith").expectOk();
    settle(s, (prompt) => (prompt.kind === "choose-card" ? { optionIds: [gear.id] } : undefined));
    expect(zoneOf(s, gear.id)).toBe("hand");
    expect(hand(s, "p1").length).toBe(before - 1 + 1);
  });

  it("[C:Prize of Progress][R377] when you use an activated ability of a gear, +1 Might this turn", () => {
    const s = withCards(["Prize of Progress", "Heart of Dark Ice"]);
    const prize = put(s, "p1", "Prize of Progress", "base");
    const heart = put(s, "p1", "Heart of Dark Ice", "base");
    const other = put(s, "p1", "Caitlyn, Patrolling", "base");
    activate(s, heart.id, "activated:0", { "target:0": other.id }).expectOk();
    settle(s);
    expect(effectiveMight(s.room, prize.id, s.host)).toBe(4);
  });

  it("[C:Renata Glasc, Mastermind][R377.2.b] [1][Mind]: draw 1 and [4][Mind]x4,[Tap]: score 1 — only while at a battlefield", () => {
    const s = withCards(["Renata Glasc, Mastermind"], [], QUIET);
    const renata = put(s, "p1", "Renata Glasc, Mastermind", "base");
    addPool(s, "p1", 1, { Mind: 1 });
    activate(s, renata.id, "activated:0").expectError("illegal_action");
    s.host.moveCard(s.room, "p1", "base", "battlefieldA", renata.id);
    s.host.setExhausted(s.room, renata.id, false);
    const before = hand(s, "p1").length;
    activate(s, renata.id, "activated:0").expectOk();
    settle(s);
    expect(hand(s, "p1").length).toBe(before + 1);
    addPool(s, "p1", 4, { Mind: 4 });
    const score = boardOf(s, "p1").score ?? 0;
    activate(s, renata.id, "activated:1").expectOk();
    settle(s);
    expect(boardOf(s, "p1").score).toBe(score + 1);
  });

  it("[C:Renata Glasc, Industrialist][R369.3] your unit tokens enter ready (gear tokens: partial)", () => {
    const s = withCards(["Desert's Call", "Renata Glasc, Industrialist"]);
    put(s, "p1", "Renata Glasc, Industrialist", "base");
    playCard(s, "p1", "Desert's Call").expectOk();
    settle(s);
    expect(boardCard(s, "p1", "Sand Soldier")!.exhausted).toBe(false);
    expect(statusOf("Renata Glasc, Industrialist")).toBe("partial");
  });

  it("[C:Renata Glasc, Chem-Baroness][R383.4.d] when you hold, may exhaust me to play a Gold (Gold bonus: partial)", () => {
    const s = withCards(["Renata Glasc, Chem-Baroness"], [], QUIET);
    const renata = put(s, "p1", "Renata Glasc, Chem-Baroness", "legend");
    put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.as("p1").endTurn().expectOk();
    s.as("p2").endTurn().expectOk();
    settle(s);
    expect(s.host.isExhausted(s.room, renata.id)).toBe(true);
    expect(countNamed(s, "p1", "base", "Gold")).toBe(1);
  });

  it("[C:Rumble, Hotheaded][R807] your Mechs have Assault (conquer trigger: manual window)", () => {
    const s = withCards(["Rumble, Hotheaded", "Clanging Sentry"]);
    const rumble = put(s, "p1", "Rumble, Hotheaded", "base");
    const sentry = put(s, "p1", "Clanging Sentry", "base");
    expect(effectiveKeywordValues(s.room, rumble.id, s.host).assault).toBe(1);
    expect(effectiveKeywordValues(s.room, sentry.id, s.host).assault).toBe(1);
    expect(statusOf("Rumble, Hotheaded")).toBe("partial");
  });

  it("[C:Sivir, Battle Mistress][R164.2.b][R429] recycling a rune: may exhaust me for a Gold; an enemy unit dying readies me", () => {
    const s = withCards(["Drag Under", "Sivir, Battle Mistress", "Called Shot"], [], {
      p1: { runes: ["Chaos Rune"] },
    });
    const sivir = put(s, "p1", "Sivir, Battle Mistress", "legend");
    // Called Shot's [Chaos] is paid by recycling the Chaos Rune (164.2.b): Sivir may exhaust for a Gold.
    s.as("p1").play("Called Shot").expectOk();
    settle(s);
    expect(s.host.isExhausted(s.room, sivir.id)).toBe(true);
    expect(countNamed(s, "p1", "base", "Gold")).toBe(1);
    const enemy = put(s, "p2", "Astral Heron", "battlefieldA");
    playCard(s, "p1", "Drag Under", { choices: { "target:0": enemy.id } }).expectOk();
    settle(s);
    expect(s.host.isExhausted(s.room, sivir.id)).toBe(false);
    expect(statusOf("Sivir, Battle Mistress")).toBe("partial");
  });

  it("[C:Irelia, Blade Dancer][R383.4.c] when you conquer, may pay [1] to ready me (choose trigger: partial)", () => {
    const s = withCards(["Irelia, Blade Dancer"], [], QUIET);
    const irelia = put(s, "p1", "Irelia, Blade Dancer", "legend", { exhausted: true });
    put(s, "p1", "Caitlyn, Patrolling", "base");
    addPool(s, "p1", 1);
    s.as("p1").move("Caitlyn, Patrolling", "battlefieldA").expectOk();
    settle(s);
    expect(s.host.isExhausted(s.room, irelia.id)).toBe(false);
  });

  it("[C:Irelia, Fervent][R416] when you ready me, +1 Might this turn (choose trigger: partial)", () => {
    const s = withCards(["Irelia, Fervent", "On the Hunt"]);
    const irelia = put(s, "p1", "Irelia, Fervent", "base", { exhausted: true });
    playCard(s, "p1", "On the Hunt").expectOk();
    settle(s);
    expect(effectiveMight(s.room, irelia.id, s.host)).toBe(5);
  });

  it("[C:Soraka, Wanderer][R369.1] another unit you control here with less Might would die: heal, exhaust and recall it instead", () => {
    const s = withCards(["Drag Under"], ["Soraka, Wanderer"]);
    put(s, "p2", "Soraka, Wanderer", "battlefieldA");
    const friend = put(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    playCard(s, "p1", "Drag Under", { choices: { "target:0": friend.id } }).expectOk();
    settle(s);
    expect(zoneOf(s, friend.id)).toBe("base");
    expect(s.host.isExhausted(s.room, friend.id)).toBe(true);
  });

  it("[C:Ezreal, Dashing][R418.6][R806] attacking deals my Might to an enemy unit here; [Mind]: move me to base", () => {
    const s = withCards(["Ezreal, Dashing"], [], QUIET);
    const { attacker, defenders } = attack(s, "Ezreal, Dashing", ["Astral Heron"]);
    resolveChain(s);
    expect(damageOf(s, defenders[0]!.id)).toBe(3);
    addPool(s, "p1", 0, { Mind: 1 });
    activate(s, attacker.id, "activated:2").expectOk();
    resolveChain(s);
    expect(zoneOf(s, attacker.id)).toBe("base");
  });

  it("[C:Azir, Emperor of the Sands][R377.2.b] Sand Soldiers have Weaponmaster; [1],[Tap]: a Sand Soldier, only after playing an Equipment", () => {
    const s = withCards(["Azir, Emperor of the Sands", "Long Sword"]);
    const azir = put(s, "p1", "Azir, Emperor of the Sands", "legend");
    addPool(s, "p1", 1);
    activate(s, azir.id, "activated:2").expectError("illegal_action");
    playCard(s, "p1", "Long Sword").expectOk();
    settle(s);
    activate(s, azir.id, "activated:2").expectOk();
    settle(s);
    const soldier = boardCard(s, "p1", "Sand Soldier")!;
    expect(effectiveKeywords(s.room, soldier.id, s.host)).toContain("Weaponmaster");
  });

  it("[C:Vanguard Armory][R440.2.b] [Tap]: play three 1 Might Recruits, each to a location you choose", () => {
    const s = withCards(["Vanguard Armory"], [], QUIET);
    const armory = put(s, "p1", "Vanguard Armory", "base");
    put(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    setControl(s.room, "battlefieldA", "p1");
    const picks = ["battlefieldA", "base", "battlefieldA"];
    activate(s, armory.id, "activated:0").expectOk();
    resolveChain(s, (prompt) =>
      prompt.kind === "choose-battlefield" ? { optionIds: [picks.shift()!] } : undefined,
    );
    expect(countNamed(s, "p1", "battlefieldA", "Recruit")).toBe(2);
    expect(countNamed(s, "p1", "base", "Recruit")).toBe(1);
  });

  it("[C:Chemtech Cask][R420.4.a] when you play a spell on an opponent's turn, may exhaust me to play a Gold", () => {
    const s = withCards(["Premonition"], ["Chemtech Cask", "Premonition"]);
    put(s, "p2", "Chemtech Cask", "base");
    playCard(s, "p1", "Premonition").expectOk();
    // Not on p2's turn when p1 plays; p2 reacts with its own Reaction spell on p1's turn.
    s.room.rules!.priority = "p2";
    playCard(s, "p2", "Premonition").expectOk();
    settle(s);
    expect(countNamed(s, "p2", "base", "Gold")).toBe(1);
  });

  it("[C:Bard, Mercurial][R170.11.c][R356.4.f.1] exhausting your legend as the extra cost: move any number of your units to an open battlefield", () => {
    const s = withCards(["Bard, Mercurial"], [], QUIET);
    const unit = put(s, "p1", "Caitlyn, Patrolling", "base");
    put(s, "p2", "Astral Heron", "battlefieldB");
    playCard(s, "p1", "Bard, Mercurial", { optionalCosts: ["optional:0"] }).expectOk();
    expect(s.host.isExhausted(s.room, boardOf(s, "p1").legend[0]!.id)).toBe(true);
    settle(s, (prompt) => (prompt.kind === "choose-card" ? { optionIds: [unit.id] } : undefined));
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
  });
});
