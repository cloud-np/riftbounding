/**
 * Vendetta legends, batch 4: Empower / Disempower triggers and activations.
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";
import { fund } from "../../rules/effects/helpers";
import {
  activate,
  addPool,
  boardOf,
  empowered,
  exhaustRunes,
  might,
  place,
  settle,
  withCards,
} from "./helpers";

type S = ReturnType<typeof withCards>;

function resolveTop(s: S): void {
  const rules = s.room.rules!;
  const controller = rules.chain[rules.chain.length - 1]?.controller ?? "p1";
  s.as(controller === "p1" ? "p2" : "p1")
    .pass()
    .expectOk();
}

/** Empower a Questionable Tome through its own [Empower] ability (an empower that is not the legend's). */
function empowerTome(s: S): void {
  const tome = place(s, "p1", "Questionable Tome", "base");
  exhaustRunes(s, "p1");
  activate(s, "p1", tome, "activated:0").expectOk();
  resolveTop(s);
  expect(empowered(s, tome.id)).toBe(true);
}

describe("Vendetta legends — batch 4", () => {
  it("[C:Mel, Soul's Reflection][R442.2][R357.2] empowers when you empower something else; Disempower, [Tap]: -2 Might at a battlefield", () => {
    const s = withCards(["Questionable Tome", "Mel, Soul's Reflection"], ["Caitlyn, Patrolling"]);
    const mel = place(s, "p1", "Mel, Soul's Reflection", "legend");
    const enemy = place(s, "p2", "Caitlyn, Patrolling", "battlefieldA");
    expect(getCardScript("Mel, Soul's Reflection")?.status).toBe("partial");
    // Not Empowered: rejected.
    activate(s, "p1", mel, "activated:1", { "target:0": enemy.id }).expectError("illegal_action");
    empowerTome(s);
    settle(s);
    expect(empowered(s, mel.id)).toBe(true);
    activate(s, "p1", mel, "activated:1", { "target:0": enemy.id }).expectOk();
    resolveTop(s);
    expect(empowered(s, mel.id)).toBe(false);
    expect(might(s, enemy.id)).toBe(1);
  });

  it("[C:Ambessa, Matriarch of War][R442.2][R357.2] empowers when you empower something else; Disempower, [Rune], [Tap]: ready a unit", () => {
    const s = withCards(["Questionable Tome", "Ambessa, Matriarch of War", "Caitlyn, Patrolling"]);
    const ambessa = place(s, "p1", "Ambessa, Matriarch of War", "legend");
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base", { exhausted: true });
    empowerTome(s);
    settle(s);
    expect(empowered(s, ambessa.id)).toBe(true);
    addPool(s, "p1", 0, { any: 1 });
    activate(s, "p1", ambessa, "activated:1", { "target:0": unit.id }).expectOk();
    resolveTop(s);
    expect(empowered(s, ambessa.id)).toBe(false);
    expect(boardOf(s, "p1").base.find((c) => c.id === unit.id)?.exhausted).toBeFalsy();
  });

  it("[C:Zed, Master of Shadows][R428][R442.2] empowers when you banish a card you own; Disempower, [Tap]: discard 1 then draw 1", () => {
    const s = withCards(["Wind and Ghosts", "Treasure Hunter", "Zed, Master of Shadows"]);
    const zed = place(s, "p1", "Zed, Master of Shadows", "legend");
    const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
    fund(s, "p1", "Wind and Ghosts");
    s.as("p1")
      .play("Wind and Ghosts", { choices: { "target:0": unit.id } })
      .expectOk();
    resolveTop(s);
    settle(s);
    expect(empowered(s, zed.id)).toBe(true);
    const hand = boardOf(s, "p1").hand.length;
    const trash = boardOf(s, "p1").trash.length;
    activate(s, "p1", zed, "activated:1").expectOk();
    resolveTop(s);
    settle(s);
    expect(empowered(s, zed.id)).toBe(false);
    expect(boardOf(s, "p1").trash.length).toBe(trash + 1);
    expect(boardOf(s, "p1").hand.length).toBe(hand);
  });
});
