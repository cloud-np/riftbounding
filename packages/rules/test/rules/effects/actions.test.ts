import { describe, expect, it } from "vitest";
import { effectiveMight, xpOf } from "../../../src";
import { scenario } from "../../scenarios/dsl";
import { boardOf, eventTypes, place, registerAll, run, spell, zoneNames, zoneOf } from "./helpers";

describe("game actions — draw/exhaust/ready/recycle [R414–R417]", () => {
  it("[R414.4][EX:432.2.d] drawing more than the deck holds draws, Burns Out, then draws the rest", () => {
    const s = scenario();
    const board = boardOf(s, "p1");
    const keep = board.deck.splice(0, board.deck.length - 1);
    board.trash.push(...keep);
    const before = board.hand.length;
    const { events } = run(s, { op: "draw", amount: 2 });
    expect(board.hand.length).toBe(before + 2);
    expect(eventTypes(events)).toContain("burn_out");
    expect(boardOf(s, "p2").score).toBe(1);
  });

  it("[R415.1.c][R416.1.c] exhausting an exhausted object / readying a ready one does nothing", () => {
    const s = scenario();
    const unit = place(s, "p1", "Treasure Hunter", "base");
    expect(eventTypes(run(s, { op: "ready", target: { targetRef: "obj:" + unit.id } }).events)).not.toContain("ready");
    expect(eventTypes(run(s, { op: "exhaust", target: { targetRef: "obj:" + unit.id } }).events)).toContain("exhaust");
    expect(eventTypes(run(s, { op: "exhaust", target: { targetRef: "obj:" + unit.id } }).events)).not.toContain("exhaust");
    expect(eventTypes(run(s, { op: "ready", target: { targetRef: "obj:" + unit.id } }).events)).toContain("ready");
  });

  it("[R417.1][R417.4][EX:417.6] recycling puts cards on the bottom of the owner's deck; Recycle X picks X", () => {
    const s = scenario();
    const board = boardOf(s, "p1");
    const moved = board.deck.splice(board.deck.length - 3, 3);
    board.trash.push(...moved);
    run(s, { op: "recycle", target: { all: true }, amount: 2, from: "trash" });
    s.expectPrompt("choose-card", "p1");
    expect(s.room.rules?.prompt?.min).toBe(2);
    s.as("p1").choose({ optionIds: [moved[0]!.id, moved[1]!.id] }).expectOk();
    const after = boardOf(s, "p1"); // the intent returns a new room (draft clone)
    expect(after.trash.map((card) => card.id)).toEqual([moved[2]!.id]);
    expect(after.deck.slice(0, 2).map((card) => card.id).sort()).toEqual([moved[0]!.id, moved[1]!.id].sort());
  });

  it("[R417.4][EX:417.6] with fewer cards than X in the zone, recycle as many as possible", () => {
    const s = scenario();
    const board = boardOf(s, "p1");
    const moved = board.deck.splice(board.deck.length - 1, 1);
    board.trash.push(...moved);
    run(s, { op: "recycle", target: { all: true }, amount: 3, from: "trash" });
    expect(s.room.rules?.prompt).toBe(null);
    expect(board.trash).toHaveLength(0);
    expect(board.deck[0]!.id).toBe(moved[0]!.id);
  });
});

describe("game actions — deal/heal/kill/banish [R418][R419][R428][R429][R712–R715]", () => {
  it("[R418.1.b][R418.6.a][EX:418.6.a] dealt damage is marked on the unit with the effect's source", () => {
    const s = scenario();
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const { events } = run(s, { op: "deal", amount: 2, target: { targetRef: "obj:" + unit.id } }, { source: "spell-src" });
    expect(s.room.rules?.objects[unit.id]?.damage).toBe(2);
    expect(events.find((event) => event.type === "damage")).toMatchObject({ cardId: unit.id, amount: 2, sourceObjectId: "spell-src" });
  });

  it("[R418.1.e][R418.1.e.1] only Valid Damage (≥ 1) is dealt", () => {
    const s = scenario();
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const { events } = run(s, { op: "deal", amount: 0, target: { targetRef: "obj:" + unit.id } });
    expect(eventTypes(events)).not.toContain("damage");
  });

  it("[R714][R715.2][EX:715.2] Bonus Damage is summed once and added to each target separately", () => {
    // Singularity: "Deal 6 to each of up to two units." + "Your spells and abilities deal 1 Bonus Damage".
    registerAll([spell("Rebuke", { op: "deal", amount: 6, target: { chosen: true, cardType: "unit", maxCount: 2 } })]);
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const a = place(s, "p2", "Whiteflame Protector", "battlefieldA");
    const b = place(s, "p2", "Astral Heron", "battlefieldA");
    s.room.rules!.effects.push({
      id: "fx-bonus-1", controller: "p1", duration: "permanent", modifier: { kind: "bonus-damage", amount: 1 },
    });
    s.as("p1").play("Rebuke", { choices: { "target:0": [a.id, b.id] } }).expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.objects[a.id]?.damage).toBe(7);
    expect(zoneOf(s, b.id)).toBe("trash"); // 7 Might, 7 damage
  });

  it("[R715.4][EX:715.4] no Bonus Damage applies when no damage would be dealt", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.effects.push({
      id: "fx-bonus", controller: "p1", duration: "permanent", modifier: { kind: "bonus-damage", amount: 3 },
    });
    const { events } = run(s, { op: "deal", amount: 0, target: { targetRef: "obj:" + unit.id } });
    expect(eventTypes(events)).not.toContain("damage");
  });

  it("[R419.1][R419.2] healing clears marked damage", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.objects[unit.id] = { damage: 2 };
    run(s, { op: "heal", amount: 1, target: { targetRef: "obj:" + unit.id } });
    expect(s.room.rules?.objects[unit.id]?.damage).toBe(1);
    run(s, { op: "heal", target: { targetRef: "obj:" + unit.id } } as never);
    expect(s.room.rules?.objects[unit.id]?.damage).toBeUndefined();
  });

  it("[R429.2][R429.2.a][R429.5.b] a killed permanent goes to its owner's trash with attribution", () => {
    const s = scenario();
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    const { events } = run(s, { op: "kill", target: { targetRef: "obj:" + unit.id } }, { source: "killer" });
    expect(zoneOf(s, unit.id)).toBe("trash");
    expect(events.find((event) => event.type === "kill")).toMatchObject({
      cardId: unit.id,
      sourceObjectId: "killer",
      data: { owner: "p2", might: 3, responsible: "p1" },
    });
    // 429.2.a: a card in the trash cannot be killed again.
    expect(eventTypes(run(s, { op: "kill", target: { targetRef: "obj:" + unit.id } }).events)).not.toContain("kill");
  });

  it("[R429][R056.2] a killed unit whose control changed goes to its owner's Trash", () => {
    const s = scenario();
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.host.setController(s.room, unit.id, "p1");
    run(s, { op: "kill", target: { targetRef: "obj:" + unit.id } });
    expect(zoneNames(s, "p2", "trash")).toContain("Caitlyn, Patrolling");
    expect(zoneNames(s, "p1", "trash")).not.toContain("Caitlyn, Patrolling");
  });

  it("[R428.2][R428.2.a][R056.2] banishing goes to the owner's Banishment and is not a kill", () => {
    const s = scenario();
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.host.setController(s.room, unit.id, "p1");
    const { events } = run(s, { op: "banish", target: { targetRef: "obj:" + unit.id } });
    expect(zoneNames(s, "p2", "banished")).toContain("Caitlyn, Patrolling");
    expect(eventTypes(events)).toContain("banish");
    expect(eventTypes(events)).not.toContain("kill");
  });

  it("[R056.2][R705] return to hand goes to the owner's hand and drops buffs/statuses", () => {
    const s = scenario();
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[unit.id] = { buffs: 1, stunned: true, damage: 1 };
    run(s, { op: "return_to_hand", target: { targetRef: "obj:" + unit.id } });
    expect(zoneOf(s, unit.id)).toBe("hand");
    expect(s.room.rules?.objects[unit.id]).toBeUndefined();
  });

  it("[R186.1] a token put into a non-board zone ceases to exist", () => {
    const s = scenario();
    run(s, { op: "create", token: { name: "Recruit" }, zone: "base" });
    const token = boardOf(s, "p1").base.find((card) => card.name === "Recruit")!;
    run(s, { op: "return_to_hand", target: { targetRef: "obj:" + token.id } });
    expect(s.host.findCard(s.room, token.id)).toBe(null);
  });
});

describe("game actions — move/recall/stun/buff/counter [R421][R424][R426][R427][R456–R460]", () => {
  it("[R421.2][R452] an effect Move goes to the destination and applies Contested", () => {
    const s = scenario();
    const unit = place(s, "p1", "Treasure Hunter", "base");
    const { events } = run(s, { op: "move", target: { targetRef: "obj:" + unit.id }, to: "battlefieldA" });
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
    expect(eventTypes(events)).toContain("move");
    expect(s.room.rules?.contested.battlefieldA).toBe("p1");
  });

  it("[R355.4.a][R451.2] no Move to the current location or to a battlefield held by two other players", () => {
    const s = scenario();
    const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
    expect(eventTypes(run(s, { op: "move", target: { targetRef: "obj:" + unit.id }, to: "battlefieldA" }).events)).not.toContain("move");
  });

  it("[R457][R458.1][R460.1] a Recall is not a Move and keeps damage/statuses", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects[unit.id] = { damage: 1, stunned: true };
    const { events } = run(s, { op: "recall", target: { targetRef: "obj:" + unit.id } });
    expect(zoneOf(s, unit.id)).toBe("base");
    expect(eventTypes(events)).toContain("recall");
    expect(eventTypes(events)).not.toContain("move");
    expect(s.room.rules?.objects[unit.id]).toMatchObject({ damage: 1, stunned: true });
  });

  it("[R424.1.a.1][EX:424.1.a.1] a stunned unit is not stunned again (no event)", () => {
    const s = scenario();
    const unit = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    expect(eventTypes(run(s, { op: "stun", target: { targetRef: "obj:" + unit.id } }).events)).toContain("stun");
    expect(eventTypes(run(s, { op: "stun", target: { targetRef: "obj:" + unit.id } }).events)).not.toContain("stun");
  });

  it("[R427.1.b][R427.1.c][EX:427.1.c] buffing adds one buff; an already buffed unit is not buffed again", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    expect(eventTypes(run(s, { op: "buff", target: { targetRef: "obj:" + unit.id } }).events)).toContain("buff");
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(4);
    expect(eventTypes(run(s, { op: "buff", target: { targetRef: "obj:" + unit.id } }).events)).not.toContain("buff");
    expect(s.room.rules?.objects[unit.id]?.buffs).toBe(1);
  });

  it("[R702.2.b][R702.2.b.1][R702.2.b.2] spending a buff needs a buff on a unit you control", () => {
    const s = scenario();
    const mine = place(s, "p1", "Caitlyn, Patrolling", "base");
    const theirs = place(s, "p2", "Treasure Hunter", "base");
    s.room.rules!.objects[mine.id] = { buffs: 1 };
    s.room.rules!.objects[theirs.id] = { buffs: 1 };
    expect(eventTypes(run(s, { op: "spend_buff", target: { targetRef: "obj:" + theirs.id } }).events)).not.toContain("spend_buff");
    expect(eventTypes(run(s, { op: "spend_buff", target: { targetRef: "obj:" + mine.id } }).events)).toContain("spend_buff");
    expect(s.room.rules?.objects[mine.id]?.buffs).toBeUndefined();
    expect(eventTypes(run(s, { op: "spend_buff", target: { targetRef: "obj:" + mine.id } }).events)).not.toContain("spend_buff");
  });

  it("[R426.1.a][R426.1.a.1][R426.1.b] a countered spell leaves the chain for the trash and is not played", () => {
    const s = scenario({ p1: { hand: ["Rebuke"], energy: 2 } });
    s.as("p1").play("Rebuke", { hold: true }).expectOk();
    const item = s.room.rules!.chain[0]!;
    const { events } = run(s, { op: "counter", target: { targetRef: "obj:" + item.id } }, { controller: "p2" });
    expect(s.room.rules?.chain).toHaveLength(0);
    s.expectZone("p1", "Rebuke", "trash");
    expect(eventTypes(events)).toContain("counter");
    expect(eventTypes(events)).not.toContain("spell_resolved");
  });
});

describe("game actions — resources, XP, burn, predict, create [R430–R441][R728–R733][R179–R187]", () => {
  it("[R430.5] Add puts Energy and Power into the Rune Pool", () => {
    const s = scenario();
    run(s, { op: "add", resources: { energy: 2, power: { Calm: 1 } } });
    expect(s.room.rules?.pools.p1).toEqual({ energy: 2, power: { Calm: 1 } });
  });

  it("[R431.2][EX:431.2][R431.3] channel N runes (exhausted when instructed), as many as possible", () => {
    const s = scenario();
    const before = boardOf(s, "p1").runeArea.length;
    run(s, { op: "channel", amount: 1, exhausted: true });
    const area = boardOf(s, "p1").runeArea;
    expect(area.length).toBe(before + 1);
    expect(area[area.length - 1]!.exhausted).toBe(true);
    const deckRunes = boardOf(s, "p1").runeDeck.length;
    run(s, { op: "channel", amount: deckRunes + 5 });
    expect(boardOf(s, "p1").runeDeck).toHaveLength(0);
  });

  it("[R730.1][R730.2][R733] XP is gained and spent; spending more than you have is negated", () => {
    const s = scenario();
    run(s, { op: "gain_xp", amount: 3 });
    expect(xpOf(s.room, "p1")).toBe(3);
    run(s, { op: "spend_xp", amount: 5 });
    expect(xpOf(s.room, "p1")).toBe(3);
    run(s, { op: "spend_xp", amount: 2 });
    expect(xpOf(s.room, "p1")).toBe(1);
  });

  it("[R441.1][R441.4] burn moves the top of the Main Deck to the trash, burning out when it runs dry", () => {
    const s = scenario();
    const board = boardOf(s, "p1");
    const top = board.deck[board.deck.length - 1]!;
    run(s, { op: "burn", amount: 1, target: { controller: "self" } });
    expect(board.trash.map((card) => card.id)).toContain(top.id);
    board.trash.length = 0;
    board.deck.splice(0, board.deck.length - 1);
    const { events } = run(s, { op: "burn", amount: 2, target: { controller: "self" } });
    expect(eventTypes(events)).toContain("burn_out");
  });

  it("[R437.1][R437.1.a][R437.4.a] predict: look at the top card, recycle it or keep it; never burn out", () => {
    const s = scenario();
    const board = boardOf(s, "p1");
    const top = board.deck[board.deck.length - 1]!;
    run(s, { op: "predict", amount: 1 });
    s.expectPrompt("choose-card", "p1");
    s.as("p1").choose({ optionIds: [top.id] }).expectOk();
    expect(boardOf(s, "p1").deck[0]!.id).toBe(top.id);
    boardOf(s, "p1").deck.length = 0;
    const { events } = run(s, { op: "predict", amount: 2 });
    expect(eventTypes(events)).not.toContain("burn_out");
  });

  it("[R440.2.b.1][R182][R183][R187.1] a created Recruit token is a 1 Might unit at its controller's base", () => {
    const s = scenario();
    run(s, { op: "create", token: { name: "Recruit", count: 2, play: true } }, { controller: "p2" });
    const tokens = boardOf(s, "p2").base.filter((card) => card.name === "Recruit");
    expect(tokens).toHaveLength(2);
    expect(effectiveMight(s.room, tokens[0]!.id, s.host)).toBe(1);
    expect(tokens[0]!.exhausted).toBe(true);
    expect(tokens[0]!.ownerPlayerId).toBe("p2");
  });

  it("[R184.1][R187.5] a Gold gear token played exhausted", () => {
    const s = scenario();
    run(s, { op: "create", token: { name: "Gold", exhausted: true, play: true } });
    const gold = boardOf(s, "p1").base.find((card) => card.name === "Gold");
    expect(gold?.exhausted).toBe(true);
  });

  it("[R442.1.b][R443.1.a.1] empower is binary; disempowering a non-empowered object does nothing", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    expect(eventTypes(run(s, { op: "disempower", target: { targetRef: "obj:" + unit.id } }).events)).not.toContain("disempower");
    expect(eventTypes(run(s, { op: "empower", target: { targetRef: "obj:" + unit.id } }).events)).toContain("empower");
    expect(eventTypes(run(s, { op: "empower", target: { targetRef: "obj:" + unit.id } }).events)).not.toContain("empower");
    expect(s.room.rules?.objects[unit.id]?.empowered).toBe(1);
  });

  it("[R470.2] \"score N points\" gains points without the Scoring process", () => {
    const s = scenario();
    const { events } = run(s, { op: "score_points", amount: 2 });
    expect(boardOf(s, "p1").score).toBe(2);
    expect(eventTypes(events)).toContain("gain_points");
    expect(eventTypes(events)).not.toContain("score");
  });

  it("[R423.1.a][R423.4][EX:423.4] discard: the player chooses; excess is negated", () => {
    const s = scenario();
    const board = boardOf(s, "p1");
    board.hand.push(...board.deck.splice(0, 3));
    run(s, { op: "discard", amount: 2 });
    s.expectPrompt("choose-card", "p1");
    const pick = board.hand.slice(0, 2).map((card) => card.id);
    s.as("p1").choose({ optionIds: pick }).expectOk();
    expect(boardOf(s, "p1").trash.map((card) => card.id).sort()).toEqual(pick.sort());
    const rest = boardOf(s, "p1").hand.length;
    run(s, { op: "discard", amount: rest + 3 });
    expect(boardOf(s, "p1").hand).toHaveLength(0);
  });
});

describe("game actions — double/swap/attach/look [R433][R434][R435][R436][R425]", () => {
  it("[R433.1.a][EX:433.1.a] doubling Might adds the current Might for the turn", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    s.room.rules!.objects[unit.id] = { buffs: 1 };
    run(s, { op: "double", target: { targetRef: "obj:" + unit.id } });
    expect(effectiveMight(s.room, unit.id, s.host)).toBe(8);
  });

  it("[R479.4.c][EX:479.4.c] an increase by a negative amount is 0 (doubling a negative Might)", () => {
    const s = scenario();
    const unit = place(s, "p1", "Treasure Hunter", "base");
    s.room.rules!.objects[unit.id] = { temporaryMight: -3 };
    run(s, { op: "double", target: { targetRef: "obj:" + unit.id } });
    expect(s.room.rules?.objects[unit.id]?.temporaryMight).toBe(-3);
  });

  it("[R434.1.b][R434.1.c] swapping Mights raises the lower and lowers the higher by the difference", () => {
    const s = scenario();
    const small = place(s, "p1", "Treasure Hunter", "base");
    const big = place(s, "p2", "Caitlyn, Patrolling", "base");
    run(s, { op: "swap", a: { targetRef: "obj:" + small.id }, b: { targetRef: "obj:" + big.id } });
    expect(effectiveMight(s.room, small.id, s.host)).toBe(3);
    expect(effectiveMight(s.room, big.id, s.host)).toBe(1);
  });

  it("[R435.1.f][R435.4][EX:435.5] attaching moves the gear to the unit's location without other state changes", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const blade = place(s, "p1", "Blade of the Exile", "base", { exhausted: true });
    run(s, { op: "attach", gear: { targetRef: "obj:" + blade.id }, to: { targetRef: "obj:" + unit.id } });
    const located = s.host.findCard(s.room, blade.id)!;
    expect(located.zone).toBe("battlefieldA");
    expect(located.card.attachedToCardId).toBe(unit.id);
    expect(located.card.exhausted).toBe(true);
  });

  it("[R435.1.h.1][R436.1.a.1] units are never attached; detaching an unattached card does nothing", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    const other = place(s, "p1", "Treasure Hunter", "base");
    expect(eventTypes(run(s, { op: "attach", gear: { targetRef: "obj:" + other.id }, to: { targetRef: "obj:" + unit.id } }).events)).not.toContain("attach");
    expect(eventTypes(run(s, { op: "detach", target: { targetRef: "obj:" + other.id } }).events)).not.toContain("detach");
  });

  it("[R719.5] when the top-most card is killed, its gear detaches and stays", () => {
    const s = scenario();
    const unit = place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    const blade = place(s, "p1", "Blade of the Exile", "battlefieldA");
    s.host.attach(s.room, blade.id, unit.id);
    run(s, { op: "kill", target: { targetRef: "obj:" + unit.id } });
    const gear = s.host.findCard(s.room, blade.id)!;
    expect(gear.zone).toBe("battlefieldA");
    expect(gear.card.attachedToCardId).toBeUndefined();
  });

  it("[R425.1.a.2][R432.1.c] look at the top cards (as many as possible) and act on them", () => {
    const s = scenario();
    const board = boardOf(s, "p1");
    const top2 = board.deck.slice(-2).map((card) => card.id);
    run(s, {
      op: "look",
      amount: 2,
      then: { op: "recycle", target: { targetRef: "looked" } },
    });
    expect(board.deck.slice(0, 2).map((card) => card.id).sort()).toEqual(top2.sort());
  });

  it("[R412.6] search a zone for a matching card and act on it", () => {
    const s = scenario();
    const board = boardOf(s, "p1");
    run(s, {
      op: "search",
      zone: "deck",
      selector: { name: "Astral Heron" },
      then: { op: "return_to_hand", target: { targetRef: "found" } },
    });
    s.expectPrompt("choose-card", "p1");
    const option = s.room.rules!.prompt!.options![0]!;
    s.as("p1").choose({ optionIds: [option.id] }).expectOk();
    expect(boardOf(s, "p1").hand.some((card) => card.id === option.id)).toBe(true);
  });
});
