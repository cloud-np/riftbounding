/**
 * Engine regressions found while scripting Vendetta / Proving Grounds (ven-ogs lane). Each test
 * keeps the minimal reproduction of the previously rules-wrong behaviour; all are fixed in R4.
 */
import { describe, expect, it } from "vitest";
import { getCardScript } from "../../../src";
import { boardOf, fund, spell } from "../../rules/effects/helpers";
import {
  activate,
  addPool,
  empowered,
  exhaustRunes,
  place,
  settle,
  withCards,
  zoneOf,
} from "./helpers";
import { registerTestCardScript } from "../../../src/testing";

describe("engine reproductions (ven-ogs)", () => {
  // cleanup/cleanup.ts "expire-this-turn" (317.2.c step 3d) deletes every rules object without
  // buffs/baseMight/counters/grantedKeywords/grantedAbilities/controller. Gear, legends and units
  // with 0 base Might lose their Empowered status (and keyword grants, prevention, Might mods) at
  // the end of the turn, although Empowered lasts until the object leaves the board (442.2, 828).
  it("[C:Steel Paws][R442.2][R317.2.c] a 0-Might unit loses Empowered in the Expiration Step", () => {
    const s = withCards(["Steel Paws"]);
    fund(s, "p1", "Steel Paws");
    s.as("p1").play("Steel Paws").expectOk();
    settle(s);
    const paws = s.findBoardCardAnywhere("Steel Paws")!;
    exhaustRunes(s, "p1");
    addPool(s, "p1", 7);
    activate(s, "p1", paws, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, paws.id)).toBe(true);
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(empowered(s, paws.id)).toBe(true);
  });

  it("[C:Tools of Empire][R442.2][R317.2.c] an Empowered gear loses Empowered in the Expiration Step", () => {
    const s = withCards(["Tools of Empire"]);
    const tools = place(s, "p1", "Tools of Empire", "base");
    exhaustRunes(s, "p1");
    addPool(s, "p1", 2);
    activate(s, "p1", tools, "activated:0").expectOk();
    s.as("p2").pass().expectOk();
    expect(empowered(s, tools.id)).toBe(true);
    s.as("p1").endTurn().expectOk();
    settle(s);
    expect(empowered(s, tools.id)).toBe(true);
  });

  // play/additional-costs.ts `deflectCosts` reads `cardKeywords` → the array form of
  // `effectiveKeywords`, which returns bare keyword names ("Deflect", not "Deflect 2"), so
  // `keywordValue` counts 1: a [Deflect 2] unit costs [Rune] instead of [Rune][Rune] (809.1.c /
  // 809.2).
  it("[C:Nasus, Ascended][R809.1.c][R809.2] choosing a [Deflect 2] unit costs [Rune][Rune] more", () => {
    const s = withCards(["Hextech Ray"], ["Nasus, Ascended"]);
    const nasus = place(s, "p2", "Nasus, Ascended", "battlefieldA");
    exhaustRunes(s, "p1");
    // An exhausted Basic Rune can still be recycled for Power (164.2.b, no Exhaust in the cost),
    // so remove the Rune Area to make the [Rune][Rune] Deflect surcharge decisive.
    boardOf(s, "p1").runeArea = [];
    fund(s, "p1", "Hextech Ray");
    addPool(s, "p1", 0, { any: 1 });
    s.as("p1")
      .play("Hextech Ray", { choices: { "target:0": nasus.id } })
      .expectError("insufficient_resources");
  });

  // triggers/finalize.ts `notePaidAdditionalCost` marks `paidAdditionalCost` when
  // `item.paid.additional` is non-empty, but `paidCostRecord` also records exhausted/recycled
  // runes and the Power total there. A permanent paid with runes is treated as if its optional
  // additional cost was paid, so "When you play me, if you paid the additional cost" fires
  // although the player declined it (356.4.f.1 / 355.1.a).
  it("[C:Clockwork Keeper][R356.4.f.1][R355.1.a] paying with runes is not paying the optional additional cost", () => {
    const s = withCards(["Clockwork Keeper"]);
    const hand = s.room.players.find((player) => player.id === "p1")!.board!.hand.length;
    // Two ready runes pay [2]; the optional [Calm] is declined (no optionalCosts).
    s.as("p1").play("Clockwork Keeper").expectOk();
    settle(s);
    expect(s.room.players.find((player) => player.id === "p1")!.board!.hand.length).toBe(hand - 1);
  });

  // effects/ops/delayed.ts `replace` stores the creator's choices (359.3.f.3.a) and passes them to
  // the replacing instructions, but replacements/interceptor.ts `matchesProposal` evaluates the
  // `matches` matcher without them: a delayed replacement whose matcher names a chosen object
  // ("the next time it dies this turn") never applies. Highlander works around it by freezing the
  // chosen id into the matcher (`ven:with-bound`).
  it("[C:Highlander][R359.3.f.3.a][R391.3] a delayed replacement matcher can refer to the chosen unit", () => {
    const original = getCardScript("Highlander")!;
    registerTestCardScript(
      spell("Highlander", {
        op: "for_each",
        selector: { chosen: true, cardType: "unit", targetRef: "target:0" },
        effect: {
          op: "replace",
          matches: { type: "kill", subject: { targetRef: "target:0" } },
          // Card text: "heal it, exhaust it, and recall it instead." The heal is part of the
          // real card; without it the recalled unit keeps lethal damage and cleanup 3a kills it.
          replace: {
            op: "seq",
            effects: [
              { op: "heal", amount: 99, target: { targetRef: "event" } },
              { op: "exhaust", target: { targetRef: "event" } },
              { op: "recall", target: { targetRef: "event" } },
            ],
          },
        },
      }),
    );
    try {
      const s = withCards(["Highlander", "Hextech Ray"]);
      const unit = place(s, "p1", "Treasure Hunter", "battlefieldA");
      fund(s, "p1", "Highlander");
      s.as("p1")
        .play("Highlander", { choices: { "target:0": unit.id } })
        .expectOk();
      s.as("p2").pass().expectOk();
      fund(s, "p1", "Hextech Ray");
      s.as("p1")
        .play("Hextech Ray", { choices: { "target:0": unit.id } })
        .expectOk();
      s.as("p2").pass().expectOk();
      expect(zoneOf(s, unit.id)).toBe("base");
    } finally {
      registerTestCardScript(original);
    }
  });
});
