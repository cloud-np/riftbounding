/**
 * Unleashed units with conditional passives (365.1, 364.3.a):
 *
 * - Alpha Wildclaw (UNL-057): [Tank]; your units here with less Might than me can't be chosen by
 *   enemy spells and abilities (757.1 `be-targeted:enemy`).
 * - Allay, Eager Admirer (UNL-041): [Deflect]; while I'm at a battlefield, your other units here
 *   have [Deflect] (809.2: a granted instance sums with a printed one).
 * - Crimson Pigeons (UNL-154): +2 [Might] while I'm attacking with another unit.
 * - Monch (UNL-035): if an opponent controls a stunned unit, I cost [2] less (366.2.a: from the
 *   hand) and enter ready (369.3).
 * - Shadow (UNL-194): if you play me to a battlefield, I enter ready (369.3); "[Action] [1][Rune],
 *   [Tap]: [Stun] an enemy unit attacking here." The catalog's card-level [Action] belongs to the
 *   ability (135.2.e.7) and is suppressed.
 */
import type { Condition, Modifier } from "@rift/protocol";
import { aUnit, custom, HERE, registerCardScript, SELF, SELF_AT_BATTLEFIELD, whilePassive as whenever } from "../sdk";


registerCardScript({
  name: "Alpha Wildclaw",
  text: "[Tank] (I must be assigned combat damage first.)\nYour units here with less Might than me can't be chosen by enemy spells and abilities.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "restriction",
        restriction: "be-targeted:enemy",
        target: {
          cardType: "unit",
          controller: "self",
          zone: HERE,
          might: { op: "lt", value: { kind: "might", selector: SELF } },
        },
      },
    },
  ],
});

registerCardScript({
  name: "Allay, Eager Admirer",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhile I'm at a battlefield, your other units here have [Deflect].",
  status: "implemented",
  abilities: [
    whenever(SELF_AT_BATTLEFIELD, {
      kind: "keyword",
      keyword: "Deflect",
      target: { cardType: "unit", controller: "self", zone: HERE, excludeSource: true },
    }),
  ],
});

registerCardScript({
  name: "Crimson Pigeons",
  text: "I have +2 [Might] while I'm attacking with another unit.",
  status: "implemented",
  abilities: [
    whenever(custom("unl:attacking-with-another"), { kind: "might", amount: 2, target: SELF }),
  ],
});

const OPPONENT_HAS_STUNNED: Condition = {
  kind: "exists",
  selector: { cardType: "unit", controller: "opponent", stunned: true },
};

registerCardScript({
  name: "Monch",
  text: "If an opponent controls a stunned unit, i cost [2] less and enter ready.",
  status: "implemented",
  abilities: [
    whenever(OPPONENT_HAS_STUNNED, { kind: "cost", amount: -2, target: SELF }),
    whenever(OPPONENT_HAS_STUNNED, { kind: "enter-ready", target: SELF }),
  ],
});

registerCardScript({
  name: "Shadow",
  text: "If you play me to a battlefield, I enter ready.\n[Action] [1][Rune], [Tap]: [Stun] an enemy unit attacking here. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Action" },
    whenever(SELF_AT_BATTLEFIELD, { kind: "enter-ready", target: SELF }),
    {
      kind: "activated",
      cost: { energy: 1, power: { any: 1 }, exhaust: SELF },
      keywords: ["action"],
      effect: {
        op: "stun",
        target: aUnit({ controller: "opponent", zone: HERE, where: custom("core:attacking") }),
      },
    },
  ],
});
