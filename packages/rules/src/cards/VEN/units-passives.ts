/**
 * Vendetta passive abilities (365.1): conditional keywords and Might, computed keyword values,
 * cost reductions from hand (366.2.a), entering ready (369.3) and damage prevention (438).
 */
import type { Ability, Modifier, Selector } from "@rift/protocol";
import { conditional, notIntrinsic, runesControlled } from "./shared";
import { custom, HERE, registerCardScript, SELF } from "../sdk";

const SPIDERLING = "Spiderling";
const SHADOW_ASSASSIN = "Shadow Assassin";
const SHADOWCLOAKED_LURKER = "Shadowcloaked Lurker";

/** One conditional modifier per threshold of `selector`'s count (values from several sources add). */
function perCount(
  selector: Selector,
  steps: number,
  build: (index: number) => Modifier,
): Ability[] {
  return Array.from({ length: steps }, (_, index) =>
    conditional(
      { kind: "count", selector, comparison: { op: "gte", value: index + 1 } },
      build(index),
    ),
  );
}

registerCardScript({
  name: "Disciple of Shen",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nI have [Shield 3] while I'm at a battlefield with exactly one other unit you control. (+3 [Might] while I'm a defender.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Shield"),
    conditional(custom("ven:exactly-one-other-friendly-here", { battlefield: true }), {
      kind: "keyword",
      keyword: "Shield", value: 3,
      target: SELF,
    }),
  ],
});

registerCardScript({
  name: "Repair Specialist",
  text: "I have [Assault] equal to the number of gear you control. (+1 [Might] while I'm an attacker for each instance of Assault.)",
  status: "implemented",
  abilities: [
    // 807.2: instances add up; one instance per gear you control (bounded at 20 gear).
    ...notIntrinsic("Assault"),
    ...perCount({ cardType: "gear", controller: "self" }, 20, () => ({
      kind: "keyword",
      keyword: "Assault",
      target: SELF,
    })),
  ],
});

registerCardScript({
  name: "Spiderling",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nI have +1 [Might] for each other unit you control here with my name.\nYour deck can have any number of cards named Spiderling.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: {
          kind: "count",
          selector: {
            cardType: "unit",
            controller: "self",
            zone: HERE,
            name: SPIDERLING,
            excludeSource: true,
          },
        },
        target: SELF,
      },
    },
  ],
});

registerCardScript({
  name: "Shadow Assassin",
  text: "I enter ready if you have a card with my name in your trash.",
  status: "implemented",
  abilities: [
    conditional(
      { kind: "exists", selector: { zone: "trash", owner: "self", name: SHADOW_ASSASSIN } },
      { kind: "enter-ready", target: SELF },
    ),
  ],
});

registerCardScript({
  name: "Shadowcloaked Lurker",
  text: "I cost [2] less for each card with my name in your trash.",
  status: "implemented",
  // 366.2.a: applies while I'm in hand; my printed cost is [5], so three copies reduce it to 0.
  abilities: perCount({ zone: "trash", owner: "self", name: SHADOWCLOAKED_LURKER }, 3, () => ({
    kind: "cost",
    amount: -2,
    target: SELF,
  })),
});

registerCardScript({
  name: "Plaza Guardian",
  text: "I cost [1] less for each gear you control.\n[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)",
  status: "implemented",
  abilities: perCount({ cardType: "gear", controller: "self" }, 10, () => ({
    kind: "cost",
    amount: -1,
    target: SELF,
  })),
});

registerCardScript({
  name: "Keeper of Law",
  text: "I cost [2][Order] less if you control a battlefield with exactly two units there.",
  status: "implemented",
  abilities: [
    conditional(custom("ven:control-battlefield-with-units", { count: 2 }), { kind: "cost-adjust", energy: -2, power: { Order: -1 }, target: SELF }),
  ],
});

registerCardScript({
  name: "Esteemed Hierophant",
  text: "While you control 7 or more runes, prevent all damage that enemy spells and abilities would deal to me.",
  status: "implemented",
  abilities: [
    {
      // 438.1.a / 438.3.c: a prevention replacement ("all") while the condition holds.
      kind: "replacement",
      matches: {
        type: "damage",
        subject: SELF,
        condition: {
          kind: "and",
          conditions: [runesControlled("gte", 7), custom("ven:damage-from-enemy-spell-or-ability")],
        },
      },
      replace: { prevent: 9999 },
    },
  ],
});

registerCardScript({
  name: "Kinkou Temple",
  text: "Units here with [tank] have +1[might].",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: 1,
        target: { cardType: "unit", keyword: "Tank", zone: HERE },
      },
    },
  ],
});

registerCardScript({
  name: "Hand Hammer",
  text: "[Equip][Calm] ([Calm]: Attach this to a unit you control.)\nI have +2 [Might] while I'm at a battlefield with exactly one other unit you control.\n+1 [Might]",
  status: "implemented",
  abilities: [
    // 718.4: effect text of an attached Equipment applies to the unit it is attached to.
    { kind: "passive", modifier: { kind: "might", amount: 1, target: { targetRef: "host" } } },
    conditional(custom("ven:exactly-one-other-friendly-here", { host: true, battlefield: true }), {
      kind: "might",
      amount: 2,
      target: { targetRef: "host" },
    }),
  ],
});
