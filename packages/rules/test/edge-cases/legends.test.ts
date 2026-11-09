/**
 * Edge cases: starter-kit legends that are in play every game — docs/rules/edge-cases-audit.md
 * ("Most-played unfinished cards").
 */
import { describe, expect, it } from "vitest";
import { boardOf, drive, duel, placeUnit, setControl, toHand, type S } from "./helpers";

/** p1 has Evelynn, Agony's Embrace as an extra legend and hides `card` at battlefieldA this turn. */
function hiddenSetup(card: string): { s: S; hiddenId: string } {
  const s = duel({ p1: ["Evelynn, Agony's Embrace", card] });
  s.placeFromDeck("p1", "Evelynn, Agony's Embrace", "legend");
  placeUnit(s, "p1", "Caitlyn, Patrolling", "battlefieldA", "holder");
  setControl(s.room, "battlefieldA", "p1");
  const hidden = toHand(s, "p1", card);
  s.room.rules!.pools.p1 = { energy: 0, power: { any: 1 } };
  s.as("p1").apply({ type: "rules_play", cardId: hidden.id, hide: true, location: "battlefieldA" }).expectOk();
  return { s, hiddenId: hidden.id };
}

describe("Evelynn, Agony's Embrace [R811.6][R383.1.b]", () => {
  it("[R811.6][R383.4.a][C:Evelynn, Agony's Embrace] playing a card from face down on another player's turn: draw 1, then discard 1", () => {
    const { s, hiddenId } = hiddenSetup("Sprite Call");
    s.as("p1").endTurn().expectOk();
    drive(s);
    // p2 attacks battlefieldA; p1 gets Focus in the combat showdown and plays Sprite Call from face down.
    placeUnit(s, "p2", "Astral Heron", "base", "attacker");
    s.as("p2").move("Astral Heron", "battlefieldA").expectOk();
    s.as("p2").pass().expectOk();
    expect(s.room.rules?.focus).toBe("p1");
    toHand(s, "p1", "Rebuke");
    toHand(s, "p1", "Defy");
    const handBefore = boardOf(s, "p1").hand.length;
    s.as("p1").apply({ type: "rules_play", cardId: hiddenId }).expectOk();
    const prompts: string[] = [];
    const events = drive(s, {
      until: () => s.room.rules!.chain.length === 0 && !s.room.rules!.prompt,
      answer: (prompt) => (prompts.push(`${prompt.kind}:${prompt.rule}`), null),
    });
    const types = events.map((event) => event.type);
    // Drew 1, then discarded 1 of the player's choice (423.1.a) because it is p2's turn.
    expect(types).toContain("draw");
    expect(types).toContain("discard");
    expect(types.indexOf("draw")).toBeLessThan(types.indexOf("discard"));
    expect(prompts).toContain("choose-card:423.1.a");
    expect(boardOf(s, "p1").hand.length).toBe(handBefore);
  });

  it("[R811.6][C:Evelynn, Agony's Embrace] on its controller's own turn it only draws", () => {
    const { s, hiddenId } = hiddenSetup("Sprite Call");
    s.as("p1").endTurn().expectOk();
    drive(s);
    s.as("p2").endTurn().expectOk();
    drive(s);
    expect(s.room.rules?.turn.player).toBe("p1");
    const handBefore = boardOf(s, "p1").hand.length;
    s.as("p1").apply({ type: "rules_play", cardId: hiddenId }).expectOk();
    drive(s);
    expect(boardOf(s, "p1").hand.length).toBe(handBefore + 1);
  });

  it("[R383.1.b][C:Evelynn, Agony's Embrace] a card played from hand does not trigger it", () => {
    const s = duel({ p1: ["Evelynn, Agony's Embrace", "Sprite Call"] });
    s.placeFromDeck("p1", "Evelynn, Agony's Embrace", "legend");
    toHand(s, "p1", "Sprite Call");
    s.room.rules!.pools.p1 = { energy: 3, power: {} };
    const handBefore = boardOf(s, "p1").hand.length;
    s.as("p1").play("Sprite Call").expectOk();
    drive(s);
    expect(boardOf(s, "p1").hand.length).toBe(handBefore - 1);
  });
});
