/**
 * Lane B R4 proof tests — self play restrictions (054.1), Ambush during a showdown (822.1.b /
 * 308.1.a) and a limited play's location permission (420.3.b / 355.2.b).
 */
import { describe, expect, it } from "vitest";
import { boardOf, fund, place, zoneOf } from "../../effects/helpers";
import { withCards as unlCards } from "../../../cards/unl/helpers";
import { withCards as venCards } from "../../../cards/ven-ogs/helpers";

describe("self play restriction [R054.1]", () => {
  it("[R054.1][C:Ol' Poro] a play restriction printed on a card in hand is applied", () => {
    const s = venCards(["Ol' Poro"]);
    fund(s, "p1", "Ol' Poro");
    s.as("p1").play("Ol' Poro").expectError("restricted");
    expect(boardOf(s, "p1").hand.some((card) => card.name === "Ol' Poro")).toBe(true);
  });

  it("[R054.1][C:Ol' Poro] the restriction ends after the controller's third turn", () => {
    const s = venCards(["Ol' Poro"]);
    const card = s.handCard("p1", "Ol' Poro")!;
    fund(s, "p1", "Ol' Poro");
    // Duel, p1 first: p1's fourth turn is turn number 7 (315 counts every player's turn).
    s.room.rules!.turn.player = "p1";
    s.room.rules!.turn.number = 7;
    s.as("p1").play("Ol' Poro").expectOk();
    expect(zoneOf(s, card.id)).toBe("base");
  });
});

describe("Ambush option [R822.1.b][R308.1.a]", () => {
  it("[R822.1.b][R308.1.a][C:Inferna] Ambush into a controlled battlefield during a showdown there", () => {
    const s = unlCards(["Inferna"], [], { firstPlayer: "p2" });
    place(s, "p1", "Caitlyn, Patrolling", "battlefieldA");
    s.room.rules!.objects.battlefieldA = { controller: "p1" };
    place(s, "p2", "Whiteflame Protector", "base");
    s.as("p2").move("Whiteflame Protector", "battlefieldA").expectOk();
    s.as("p2").pass().expectOk();
    fund(s, "p1", "Inferna");
    s.as("p1").play("Inferna", { location: "battlefieldA" }).expectOk();
  });
});

describe("limited play location [R420.3.b][R355.2.b]", () => {
  it("[R420.3.b][R355.2.b][C:Thrill of the Hunt] the played unit enters a battlefield with no friendly units", () => {
    const s = unlCards(["Thrill of the Hunt"]);
    const unit = place(s, "p1", "Caitlyn, Patrolling", "base");
    fund(s, "p1", "Thrill of the Hunt");
    s.as("p1")
      .play("Thrill of the Hunt", { choices: { "target:0": unit.id, destination: "battlefieldA" } })
      .expectOk();
    for (let step = 0; step < 8 && s.room.rules!.chain.length > 0; step += 1) {
      s.as(s.room.rules!.priority!).pass().expectOk();
    }
    expect(zoneOf(s, unit.id)).toBe("battlefieldA");
  });
});
