import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RulesIntent } from "@rift/protocol";
import { clearCardScripts, explainIllegal, primitives } from "../../../src";
import * as fake from "./fake-effects";
import { bareScenario, boardOf, place, stepOf, toHand } from "./helpers";
import type { RulesScenario } from "../../scenarios/dsl";

vi.mock("../../../src/layers/restrictions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../src/layers/restrictions")>();
  const f = await import("./fake-effects");
  return { ...actual, restrictionFor: f.restrictionFor };
});

beforeEach(() => fake.resetFakes());
afterEach(() => clearCardScripts());

function applyAndExplain(s: RulesScenario, player: string, intent: RulesIntent) {
  const explained = explainIllegal(s.room, player, intent, s.host);
  s.as(player).apply(intent);
  const error = s.lastError();
  expect(explained.ok, `explain=${JSON.stringify(explained)} apply=${JSON.stringify(error)}`).toBe(error === null);
  if (!explained.ok && error) expect({ code: explained.code, rule: explained.rule }).toEqual(error);
  return error;
}

describe("Standard Move [R144][R447–R455]", () => {
  it("[R144.3][R144.3.a][R144.3.c] several Units move together: all costs are paid, then one Move", () => {
    const s = bareScenario();
    const a = place(s, "p1", "Treasure Hunter", "base");
    const b = place(s, "p1", "Stellacorn Herder", "base");
    s.as("p1").apply({ type: "rules_move", unitIds: [a.id, b.id], to: "battlefieldA" }).expectOk();
    const types = s.events().map((event) => event.type);
    const lastExhaust = types.lastIndexOf("exhaust");
    const firstMove = types.indexOf("move");
    expect(lastExhaust).toBeGreaterThanOrEqual(0);
    expect(firstMove).toBeGreaterThan(lastExhaust);
    expect(boardOf(s, "p1").battlefieldA.map((card) => card.id).sort()).toEqual([a.id, b.id].sort());
  });

  it("[R144.3.b][R810.1.b] Origins may differ (a Ganking Unit from a battlefield with one from the Base)", () => {
    const s = bareScenario();
    const ganker = place(s, "p1", "Stellacorn Herder", "battlefieldA");
    s.room.rules!.objects[ganker.id] = { grantedKeywords: ["Ganking"] };
    const fromBase = place(s, "p1", "Treasure Hunter", "base");
    s.as("p1").apply({ type: "rules_move", unitIds: [ganker.id, fromBase.id], to: "battlefieldB" }).expectOk();
    expect(boardOf(s, "p1").battlefieldB).toHaveLength(2);
  });

  it("[R107.3.e][R144] a facedown Unit card cannot make a Standard Move", () => {
    const s = bareScenario();
    const hidden = place(s, "p1", "Treasure Hunter", "battlefieldA");
    boardOf(s, "p1").battlefieldA.find((card) => card.id === hidden.id)!.hidden = true;
    expect(applyAndExplain(s, "p1", { type: "rules_move", unitIds: [hidden.id], to: "base" })).toEqual({
      code: "unit_not_found",
      rule: "107.3.e",
    });
  });

  it("[R421][R475] a restriction on moving (“can't move from here to base”) forbids the Standard Move", () => {
    const s = bareScenario();
    const unit = place(s, "p1", "Stellacorn Herder", "battlefieldA");
    fake.addRestriction((_room, _host, query) => (query.kind === "move" && query.to === "base" ? { rule: "421", note: "Vilemaw's Lair" } : null));
    expect(applyAndExplain(s, "p1", { type: "rules_move", unitIds: [unit.id], to: "base" })).toEqual({ code: "restricted", rule: "421" });
  });

  it("[R358.3.a][EX:358.3.a] a spell that would move a unit stays playable even when that move is prevented", () => {
    const s = bareScenario({ p1: { energy: 1 } });
    place(s, "p1", "Stellacorn Herder", "battlefieldA");
    fake.addRestriction((_room, _host, query) => (query.kind === "move" ? { rule: "421" } : null));
    const flash = toHand(s, "p1", "Gust");
    s.as("p1").apply({ type: "rules_play", cardId: flash.id, hold: true }).expectOk();
  });

  it("[R458.3][R460.1] a Recall is not a Move: move restrictions do not stop it and damage remains", () => {
    const s = bareScenario();
    const unit = place(s, "p1", "Stellacorn Herder", "battlefieldA");
    s.room.rules!.objects[unit.id] = { damage: 1 };
    fake.addRestriction((_room, _host, query) => (query.kind === "move" ? { rule: "421" } : null));
    const step = stepOf(s);
    expect(primitives.recall(s.room, unit.id, step)).toBe(true);
    expect(s.host.findCard(s.room, unit.id)?.zone).toBe("base");
    expect(s.room.rules?.objects[unit.id]?.damage).toBe(1);
    expect(step.events.map((event) => event.type)).toEqual(["recall"]);
  });
});
