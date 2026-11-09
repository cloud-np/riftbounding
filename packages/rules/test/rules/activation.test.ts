import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CardScript } from "@rift/protocol";
import { clearCardScripts, explainIllegal, legalIntents, registerCardScripts } from "../../src";
import { scenario } from "../scenarios/dsl";

function noopSpell(name: string, text: string): CardScript {
  return {
    name,
    text,
    status: "implemented",
    abilities: [{ kind: "spell", effect: { op: "seq", effects: [] } }],
  };
}

/** F7 fixture: [triggered, activated] must expose `activated:1` everywhere. */
const mixedAbilities: CardScript = {
  name: "Treasure Hunter",
  text: "Test script with a triggered ability first and an activated ability second.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "probe" } },
      effect: { op: "seq", effects: [] },
    },
    { kind: "activated", cost: {}, effect: { op: "seq", effects: [] } },
  ],
};

const addEnergy: CardScript = {
  name: "Astral Heron",
  text: "Test Add ability (empty effect: must not fabricate resources).",
  status: "implemented",
  abilities: [
    { kind: "activated", cost: {}, effect: { op: "seq", effects: [] }, addsResources: true },
  ],
};

const addUnimplemented: CardScript = {
  name: "Whiteflame Protector",
  text: "Test Add ability whose effect R2 must execute.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: {},
      effect: { op: "add", resources: { energy: 1 } },
      addsResources: true,
    },
  ],
};

beforeAll(() => {
  registerCardScripts([
    noopSpell("Rebuke", "[ACTION] test no-op"),
    noopSpell("Defy", "[REACTION] test no-op"),
    mixedAbilities,
    addEnergy,
    addUnimplemented,
  ]);
});
afterAll(() => clearCardScripts());

describe("activated abilities [R376–R381][R403.3]", () => {
  it("[R380][R403.3] a card in hand cannot be activated", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    const card = s.handCard("p1", "Treasure Hunter")!;
    const intent = { type: "rules_activate", objectId: card.id, ability: "activated:1" } as const;

    const explained = explainIllegal(s.room, "p1", intent, s.host);
    expect(explained).toMatchObject({ ok: false, code: "illegal_action" });
    if (!explained.ok) expect(explained.rule).toBe("380");

    s.as("p1").apply(intent);
    expect(s.lastError()?.code).toBe("illegal_action");
    expect(s.room.rules?.chain.length).toBe(0);
    expect(s.handCard("p1", "Treasure Hunter")?.id).toBe(card.id);
  });

  it("[R403.3] an unknown ability ref is rejected without mutating the chain", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    s.as("p1").apply({
      type: "rules_activate",
      objectId: unit.id,
      ability: "totally-not-an-ability",
    });
    expect(s.lastError()?.code).toBe("illegal_action");
    expect(s.room.rules?.chain.length).toBe(0);
  });

  it("[R403.3] a ref that resolves to a triggered ability is not activatable", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;
    s.as("p1").apply({ type: "rules_activate", objectId: unit.id, ability: "triggered:event" });
    expect(s.lastError()?.code).toBe("illegal_action");
    expect(s.lastError()?.rule).toBe("403.3");
  });

  it("[R399][R403.3] mixed [triggered, activated] abilities share one stable ref scheme (activated:1)", () => {
    const s = scenario({ p1: { hand: ["Treasure Hunter"], energy: 2 } });
    s.as("p1").play("Treasure Hunter").expectOk();
    const unit = s.findBoardCard("Treasure Hunter")!;

    const legal = legalIntents(s.room, "p1", s.host);
    // 164.2: the player's Basic Runes also list their two Add abilities; the unit's one ref is
    // the full-array index `activated:1`.
    expect(legal.activatable.filter((entry) => entry.objectId === unit.id)).toEqual([
      { objectId: unit.id, ability: "activated:1" },
    ]);
    const explained = explainIllegal(
      s.room,
      "p1",
      { type: "rules_activate", objectId: unit.id, ability: "activated:1" },
      s.host,
    );
    expect(explained.ok).toBe(true);

    s.as("p1").activate("Treasure Hunter", "activated:1").expectOk();
    expect(s.room.rules?.manual).toBe(null);
    expect(s.room.rules?.chain.map((item) => item.abilityRef)).toEqual(["activated:1"]);
    // The empty effect resolves once the opponent passes; no manual window is opened.
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.chain.length).toBe(0);
    expect(s.room.rules?.manual).toBe(null);
  });

  it("[R430.2][R430.2.a] an Add ability never fabricates 1 Energy and never passes Priority", () => {
    // 357: Astral Heron costs [7]; the pool pays it exactly and is then empty.
    const s = scenario({ p1: { hand: ["Astral Heron"], energy: 7 } });
    s.as("p1").play("Astral Heron").expectOk();
    const unit = s.findBoardCard("Astral Heron")!;
    expect(s.room.rules?.pools.p1?.energy).toBe(0);

    s.as("p1").activate("Astral Heron", "activated:0").expectOk();
    expect(s.room.rules?.pools.p1?.energy).toBe(0);
    expect(s.room.rules?.chain.length).toBe(0);
    expect(s.room.rules?.priority).toBe("p1");
    expect(s.events().some((event) => event.type === "add_resolved")).toBe(true);
  });

  it("[R430.2][R430.5] a scripted Add effect adds its resources as it resolves immediately", () => {
    // R2-effects implements the `add` op: the R1 placeholder ("leaves the pool untouched") is
    // replaced by the 430.2/430.5 behaviour — the ability finalizes, resolves at once and adds [1].
    // 357: Whiteflame Protector costs [8][C][C] (Calm), so the play is funded exactly.
    const s = scenario({ p1: { hand: ["Whiteflame Protector"], energy: 8, power: { Calm: 2 } } });
    s.as("p1").play("Whiteflame Protector").expectOk();
    const unit = s.findBoardCard("Whiteflame Protector")!;
    const before = { ...s.room.rules!.pools.p1! };

    s.as("p1").activate("Whiteflame Protector", "activated:0").expectOk();
    expect(s.room.rules?.pools.p1).toEqual({ ...before, energy: before.energy + 1 });
    expect(s.room.rules?.chain.length).toBe(0);
    expect(s.room.rules?.priority).toBe("p1");
    expect(s.events().some((event) => event.type === "add_resolved")).toBe(true);
    expect(unit.id).toBeTruthy();
  });

  it("[R309.1.a][R430.3] addsResources does not grant an Action/Reaction timing permission", () => {
    const s = scenario({
      p1: { hand: ["Astral Heron", "Rebuke"], energy: 9, power: { Chaos: 2 } },
    });
    s.as("p1").play("Astral Heron").expectOk();
    // 337.4 + hold: P1 keeps Priority with a Chain on the table (Neutral Closed).
    s.as("p1").play("Rebuke", { hold: true }).expectOk();
    expect(s.room.rules?.chain.length).toBe(1);

    const unit = s.findBoardCard("Astral Heron")!;
    s.as("p1").apply({ type: "rules_activate", objectId: unit.id, ability: "activated:0" });
    expect(s.lastError()?.code).toBe("closed_state_requires_reaction");
    expect(s.lastError()?.rule).toBe("309.1.a");
    expect(s.room.rules?.chain.length).toBe(1);
  });
});
