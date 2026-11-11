import type { CardInstance, Room } from "@rift/protocol";
import { describe, expect, it } from "vitest";

import { deriveFxEvents, fxEventKey } from "../derive-fx-events";

type Zones = Partial<
  Record<
    | "hand"
    | "base"
    | "trash"
    | "banished"
    | "battlefieldA"
    | "battlefieldB"
    | "battlefieldC"
    | "deck"
    | "champion",
    CardInstance[]
  >
>;

function unit(id: string, might = 3, extra: Partial<CardInstance> = {}): CardInstance {
  return {
    id,
    name: id,
    source: "mainDeck",
    exhausted: false,
    createdAt: 0,
    type: "Unit",
    domains: ["Fury"],
    might,
    ...extra,
  };
}

function spell(id: string): CardInstance {
  return { ...unit(id), type: "Spell", might: undefined };
}

function board(zones: Zones = {}, score = 0) {
  return {
    score,
    floatingEnergy: 0,
    floatingPower: 0,
    deck: [],
    hand: [],
    handRevealToOpponent: false,
    base: [],
    trash: [],
    banished: [],
    battlefieldA: [],
    battlefieldB: [],
    battlefieldC: [],
    battlefieldToken: [],
    champion: [],
    legend: [],
    runeDeck: [],
    runeArea: [],
    deckPeek: { cardIds: [], revealedCardIds: [] },
    ...zones,
  };
}

interface RoomOpts {
  me?: Zones;
  foe?: Zones;
  meScore?: number;
  foeScore?: number;
  active?: string;
  turn?: number;
  chain?: Array<{ id: string; card: CardInstance; by: string }>;
  rules?: unknown;
  arrows?: Room["targetArrowsByPlayer"];
  scored?: Room["battlefieldScoredThisTurnByPlayer"];
}

function room(opts: RoomOpts = {}): Room {
  return {
    phase: "in_game",
    activeTurnPlayerId: opts.active ?? "me",
    turnNumber: opts.turn ?? 1,
    players: [
      { id: "me", name: "Me", board: board(opts.me, opts.meScore ?? 0) },
      { id: "foe", name: "Foe", board: board(opts.foe, opts.foeScore ?? 0) },
    ],
    chainEntries: (opts.chain ?? []).map((entry) => ({
      id: entry.id,
      card: entry.card,
      addedAt: 0,
      fromZone: "hand",
      byPlayerId: entry.by,
      byPlayerName: entry.by,
    })),
    targetArrowsByPlayer: opts.arrows,
    battlefieldScoredThisTurnByPlayer: opts.scored,
    rules: opts.rules,
    log: [],
  } as unknown as Room;
}

const types = (events: ReturnType<typeof deriveFxEvents>) => events.map((event) => event.type);

describe("deriveFxEvents", () => {
  it("returns nothing for identical rooms and outside a game", () => {
    const a = room({ me: { base: [unit("u1")] } });
    expect(deriveFxEvents(a, a, "me")).toEqual([]);
    expect(deriveFxEvents(a, { ...a, phase: "lobby" } as Room, "me")).toEqual([]);
  });

  it("detects a unit played from hand to base (viewer)", () => {
    const prev = room({ me: { hand: [unit("u1")] } });
    const next = room({ me: { base: [unit("u1")] } });
    const events = deriveFxEvents(prev, next, "me");
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: "card_played",
      fromZone: "hand",
      toZone: "base",
      isViewer: true,
    });
  });

  it("detects opponent plays and marks them non-viewer", () => {
    const prev = room({ foe: { hand: [unit("f1")] } });
    const next = room({ foe: { base: [unit("f1")] } });
    expect(deriveFxEvents(prev, next, "me")[0]).toMatchObject({
      type: "card_played",
      isViewer: false,
      playerId: "foe",
    });
  });

  it("treats an unseen card appearing on the opponent's board as a hand play", () => {
    const prev = room();
    const next = room({ foe: { base: [unit("f9")] } });
    expect(deriveFxEvents(prev, next, "me")[0]).toMatchObject({ fromZone: "hand" });
  });

  it("marks token creation as fromZone none", () => {
    const prev = room();
    const next = room({ me: { base: [unit("t1", 1, { source: "token" })] } });
    expect(deriveFxEvents(prev, next, "me")[0]).toMatchObject({
      type: "card_played",
      fromZone: "none",
    });
  });

  it("detects a unit leaving the chain onto the board", () => {
    const card = unit("u1");
    const prev = room({ chain: [{ id: "c1", card, by: "me" }] });
    const next = room({ me: { base: [card] } });
    expect(deriveFxEvents(prev, next, "me")[0]).toMatchObject({
      type: "card_played",
      fromZone: "chain",
    });
  });

  it("detects moves base -> battlefield and battlefield -> battlefield", () => {
    const u = unit("u1");
    const a = room({ me: { base: [u] } });
    const b = room({ me: { battlefieldA: [u] } });
    const c = room({ me: { battlefieldB: [u] } });
    expect(deriveFxEvents(a, b, "me").find((e) => e.type === "unit_moved")).toMatchObject({
      fromZone: "base",
      toZone: "battlefieldA",
    });
    expect(deriveFxEvents(b, c, "me").find((e) => e.type === "unit_moved")).toMatchObject({
      fromZone: "battlefieldA",
      toZone: "battlefieldB",
    });
  });

  it("emits spell_cast with targets from arrows, and spell_resolved afterwards", () => {
    const s = spell("s1");
    const target = unit("t1");
    const prev = room({ foe: { base: [target] } });
    const cast = room({
      foe: { base: [target] },
      chain: [{ id: "c1", card: s, by: "foe" }],
      arrows: { foe: [{ sourceCardId: "s1", targetCardId: "t1", sourceAnchor: "chain", targetAnchor: "board" }] },
    });
    const castEvents = deriveFxEvents(prev, cast, "me");
    expect(castEvents[0]).toMatchObject({ type: "spell_cast", isViewer: false, targetIds: ["t1"] });
    const resolved = room({ foe: { base: [target] }, me: { trash: [s] } });
    const resolveEvents = deriveFxEvents(cast, resolved, "me");
    expect(resolveEvents[0]).toMatchObject({ type: "spell_resolved", targetIds: ["t1"] });
  });

  it("reads strict chain choices as targets", () => {
    const s = spell("s1");
    const target = unit("t1");
    const prev = room({ me: { base: [target] } });
    const next = room({
      me: { base: [target] },
      chain: [{ id: "c1", card: s, by: "me" }],
      rules: { chain: [{ id: "c1", choices: { target: "t1", other: ["zzz"] } }], objects: {} },
    });
    expect(deriveFxEvents(prev, next, "me")[0]).toMatchObject({ targetIds: ["t1"] });
  });

  it("does not treat unit chain entries as spell casts", () => {
    const prev = room();
    const next = room({ chain: [{ id: "c1", card: unit("u1"), by: "me" }] });
    expect(deriveFxEvents(prev, next, "me")).toEqual([]);
  });

  it("detects unit death with last-known snapshot", () => {
    const u = unit("u1");
    const prev = room({ me: { battlefieldA: [u] } });
    const next = room({ me: { trash: [u] } });
    const death = deriveFxEvents(prev, next, "me").find((event) => event.type === "unit_died");
    expect(death).toMatchObject({ fromZone: "battlefieldA", toZone: "trash", inCombat: false });
  });

  it("treats a vanished token as dead", () => {
    const t = unit("t1", 1, { source: "token" });
    const prev = room({ me: { base: [t] } });
    const next = room();
    expect(types(deriveFxEvents(prev, next, "me"))).toContain("unit_died");
  });

  it("sandbox: contested battlefield + removal is a clash with deaths", () => {
    const mine = unit("m1", 4);
    const theirs = unit("f1", 2);
    const prev = room({ me: { battlefieldA: [mine] }, foe: { battlefieldA: [theirs] } });
    const next = room({ me: { battlefieldA: [mine] }, foe: { trash: [theirs] } });
    const events = deriveFxEvents(prev, next, "me");
    const clash = events.find((event) => event.type === "combat_clash");
    expect(clash).toBeDefined();
    if (clash?.type !== "combat_clash") throw new Error("no clash");
    expect(clash.attackers.map((unit) => unit.id)).toEqual(["m1"]);
    expect(clash.defenders.map((unit) => unit.id)).toEqual(["f1"]);
    expect(clash.defenders[0]).toMatchObject({ died: true, damage: 2 });
    const order = types(events);
    expect(order.indexOf("combat_clash")).toBeLessThan(order.indexOf("unit_died"));
    expect(events.find((event) => event.type === "unit_died")).toMatchObject({ inCombat: true });
    // A conquer follows once the defender is gone.
    expect(order).toContain("conquer");
  });

  it("sandbox: second player entering a battlefield starts a showdown", () => {
    const prev = room({ me: { battlefieldB: [unit("m1")] }, foe: { base: [unit("f1")] } });
    const next = room({ me: { battlefieldB: [unit("m1")] }, foe: { battlefieldB: [unit("f1")] } });
    const events = deriveFxEvents(prev, next, "me");
    expect(types(events)).toEqual(["unit_moved", "showdown_start"]);
  });

  it("strict: showdown appearing emits showdown_start", () => {
    const prev = room({ rules: { showdown: null, combat: null, objects: {}, chain: [] } });
    const next = room({
      rules: {
        showdown: { battlefield: "battlefieldC", kind: "combat", startedBy: "me" },
        combat: null,
        objects: {},
        chain: [],
      },
    });
    expect(deriveFxEvents(prev, next, "me")[0]).toMatchObject({
      type: "showdown_start",
      battlefield: "battlefieldC",
      kind: "combat",
    });
  });

  it("strict: combat resolution yields per-unit damage, deaths and survivors", () => {
    const a1 = unit("a1", 5);
    const a2 = unit("a2", 2);
    const d1 = unit("d1", 3);
    const combat = { battlefield: "battlefieldA", attacker: "me", defender: "foe", step: "damage" };
    const prev = room({
      me: { battlefieldA: [a1, a2] },
      foe: { battlefieldA: [d1] },
      rules: {
        showdown: null,
        combat,
        chain: [],
        objects: {
          a1: { designation: "attacker", damage: 0 },
          a2: { designation: "attacker", damage: 0 },
          d1: { designation: "defender", damage: 0 },
        },
      },
    });
    const next = room({
      me: { battlefieldA: [a1], trash: [a2] },
      foe: { trash: [d1] },
      rules: { showdown: null, combat: null, chain: [], objects: { a1: { damage: 3 } } },
    });
    const events = deriveFxEvents(prev, next, "me");
    const clash = events.find((event) => event.type === "combat_clash");
    if (clash?.type !== "combat_clash") throw new Error("no clash");
    expect(clash.attackers.map((u) => [u.id, u.damage, u.died])).toEqual([
      ["a1", 3, false],
      ["a2", 2, true],
    ]);
    expect(clash.defenders.map((u) => [u.id, u.died])).toEqual([["d1", true]]);
    expect(clash.totalDamage).toBe(3 + 2 + 3);
    expect(events.filter((event) => event.type === "unit_died")).toHaveLength(2);
    // Survivors of a clash don't also get a standalone damage event.
    expect(events.some((event) => event.type === "damage")).toBe(false);
  });

  it("strict: no clash when combat ends without damage", () => {
    const a1 = unit("a1");
    const d1 = unit("d1");
    const prev = room({
      me: { battlefieldA: [a1] },
      foe: { battlefieldA: [d1] },
      rules: {
        combat: { battlefield: "battlefieldA", attacker: "me", defender: "foe", step: "showdown" },
        objects: {},
        chain: [],
      },
    });
    const next = room({
      me: { battlefieldA: [a1] },
      foe: { battlefieldA: [d1] },
      rules: { combat: null, objects: {}, chain: [] },
    });
    expect(deriveFxEvents(prev, next, "me").some((event) => event.type === "combat_clash")).toBe(
      false,
    );
  });

  it("strict: non-combat damage and buffs", () => {
    const u = unit("u1", 3);
    const prev = room({ me: { base: [u] }, rules: { objects: { u1: { damage: 0 } }, chain: [] } });
    const hurt = room({ me: { base: [u] }, rules: { objects: { u1: { damage: 2 } }, chain: [] } });
    expect(deriveFxEvents(prev, hurt, "me")[0]).toMatchObject({ type: "damage", amount: 2 });
    const buffed = room({
      me: { base: [{ ...u, temporaryMightBuff: 2 }] },
      rules: { objects: { u1: { damage: 0 } }, chain: [] },
    });
    expect(deriveFxEvents(prev, buffed, "me")[0]).toMatchObject({ type: "might_buff", amount: 2 });
  });

  it("emits conquer then score with the source battlefield", () => {
    const u = unit("u1");
    const prev = room({ me: { base: [u] } });
    const next = room({
      me: { battlefieldB: [u] },
      meScore: 1,
      scored: {
        me: { battlefieldA: false, battlefieldB: true, battlefieldC: false, battlefieldToken: false },
      },
    });
    const events = deriveFxEvents(prev, next, "me");
    expect(types(events)).toEqual(["unit_moved", "conquer", "score"]);
    expect(events[2]).toMatchObject({
      type: "score",
      battlefield: "battlefieldB",
      source: "conquer",
      isViewer: true,
    });
  });

  it("emits hold score at turn start and a generic score otherwise", () => {
    const u = unit("u1");
    const prev = room({ me: { battlefieldA: [u] }, active: "foe", turn: 2 });
    const next = room({
      me: { battlefieldA: [u] },
      meScore: 1,
      active: "me",
      turn: 3,
      scored: {
        me: { battlefieldA: true, battlefieldB: false, battlefieldC: false, battlefieldToken: false },
      },
    });
    const events = deriveFxEvents(prev, next, "me");
    expect(types(events)).toEqual(["turn_start", "score"]);
    expect(events[1]).toMatchObject({ source: "hold", battlefield: "battlefieldA" });
    const manual = deriveFxEvents(prev, room({ me: { battlefieldA: [u] }, meScore: 2, active: "foe", turn: 2 }), "me");
    expect(manual[0]).toMatchObject({ type: "score", delta: 2, battlefield: null, source: "other" });
  });

  it("emits turn_start for both players", () => {
    const a = room({ active: "me", turn: 1 });
    const b = room({ active: "foe", turn: 2 });
    expect(deriveFxEvents(a, b, "me")[0]).toMatchObject({ type: "turn_start", isViewer: false });
    expect(deriveFxEvents(b, room({ active: "me", turn: 3 }), "me")[0]).toMatchObject({
      type: "turn_start",
      isViewer: true,
    });
  });

  it("counts draws from deck", () => {
    const c = unit("c1");
    const prev = room({ me: { deck: [c] } });
    const next = room({ me: { hand: [c] } });
    expect(deriveFxEvents(prev, next, "me")[0]).toMatchObject({
      type: "card_drawn",
      count: 1,
      isViewer: true,
    });
  });

  it("orders play before clash before deaths before score", () => {
    const m = unit("m1", 4);
    const f = unit("f1", 1);
    const prev = room({ me: { base: [m] }, foe: { battlefieldA: [f] } });
    const next = room({
      me: { battlefieldA: [m] },
      foe: { trash: [f] },
      meScore: 1,
      scored: {
        me: { battlefieldA: true, battlefieldB: false, battlefieldC: false, battlefieldToken: false },
      },
    });
    // prev: contested only after move, so sandbox clash is not derivable; ensure ordering anyway.
    const order = types(deriveFxEvents(prev, next, "me"));
    expect(order.indexOf("unit_moved")).toBeLessThan(order.indexOf("unit_died"));
    expect(order.indexOf("unit_died")).toBeLessThan(order.indexOf("conquer"));
    expect(order.indexOf("conquer")).toBeLessThan(order.indexOf("score"));
  });

  it("produces stable dedupe keys", () => {
    const prev = room({ me: { hand: [unit("u1")] } });
    const next = room({ me: { base: [unit("u1")] } });
    const [a] = deriveFxEvents(prev, next, "me");
    const [b] = deriveFxEvents(prev, next, "me");
    expect(fxEventKey(a!)).toBe(fxEventKey(b!));
    expect(fxEventKey(a!)).toBe("play:u1:base");
  });
});
