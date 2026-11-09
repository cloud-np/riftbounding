/**
 * Spiritforged (SFD) — wave R3 batch 1: plain spells, play effects, "enter ready" units and
 * Deathknell units. Each `registerCardScript` call registers one card (text = current text,
 * errata applied).
 */
import { registerCardScript } from "../registry";
import { SELF, WHEN_I_DIE, WHEN_PLAYED, custom } from "../dsl";
import {
  HERE_ZONE,
  countOf,
  enterReady,
  gold,
  mech,
  sandSoldier,
  target,
  whilePassive,
} from "./common";

const ENEMY_UNIT = { cardType: "unit", controller: "opponent" as const };

registerCardScript({
  name: "Against the Odds",
  text: "[REACTION] (Play at any time, even before spells and abilities resolve.)\nGive a friendly unit at a battlefield +2 [Might] this turn for each enemy unit there.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "temporary_might",
        amount: countOf({ ...ENEMY_UNIT, sameLocationAs: "target:0" }, 2),
        target: target({ controller: "self", zone: "battlefield", targetRef: "target:0" }),
      },
    },
  ],
});

registerCardScript({
  name: "Premonition",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\nDraw 3.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "draw", amount: 3 } }],
});

registerCardScript({
  name: "Punch First",
  text: "[ACTION] (Play on your turn or in showdowns.)\nGive a unit +5 [Might] this turn.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 5, target: target() } }],
});

registerCardScript({
  name: "Detonate",
  text: "Kill a gear. Its controller draws 2.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "kill", target: { chosen: true, cardType: "gear", targetRef: "target:0" } },
          // 359.3.e.13: "its controller" is read through last-known information after the kill.
          { op: "draw", amount: 2, player: { kind: "controller", of: { targetRef: "target:0" } } },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Factory Recall",
  text: "[Action] (Play on your turn or in showdowns.)\nReturn a gear to its owner's hand.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "return_to_hand", target: { chosen: true, cardType: "gear" } } },
  ],
});

registerCardScript({
  name: "Defiant Dance",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nGive a unit +2 [Might] this turn and another unit -2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "temporary_might", amount: 2, target: target({ targetRef: "target:0" }) },
          {
            op: "temporary_might",
            amount: -2,
            target: target({ targetRef: "target:1", excludeRefs: ["target:0"] }),
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "On the Hunt",
  text: "Ready your units.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "ready", target: { cardType: "unit", controller: "self" } } },
  ],
});

registerCardScript({
  name: "Downwell",
  text: "Return all units and gear to their owners' hands.",
  status: "implemented",
  // One instruction: units and gear return simultaneously (056; attached gear detach, 719.5).
  abilities: [
    { kind: "spell", effect: { op: "return_to_hand", target: { cardType: "permanent" } } },
  ],
});

registerCardScript({
  name: "Show of Strength",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nDraw 1 for each of your [Mighty] units. (A unit is Mighty while it has 5+ [Might].)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "draw",
        amount: countOf({ cardType: "unit", controller: "self", mighty: true }),
      },
    },
  ],
});

registerCardScript({
  name: "Sudden Storm",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Action] (Play on your turn or in showdowns.)\nDeal 2 to a unit at a battlefield. If it's attacking, deal 4 to it instead.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: custom("sfd:attacking", { ref: "target:0" }),
        then: {
          op: "deal",
          amount: 4,
          target: target({ zone: "battlefield", targetRef: "target:0" }),
        },
        else: {
          op: "deal",
          amount: 2,
          target: target({ zone: "battlefield", targetRef: "target:0" }),
        },
      },
    },
  ],
});

registerCardScript({
  name: "Wages of Pain",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Action] (Play on your turn or in showdowns.)\nDeal 3 to a unit at a battlefield. Play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [{ op: "deal", amount: 3, target: target({ zone: "battlefield" }) }, gold()],
      },
    },
  ],
});

registerCardScript({
  name: "Blood Money",
  text: "[Action] (Play on your turn or in showdowns.)\nKill a unit at a battlefield with 2 [Might] or less. If it was an enemy unit, play a Gold gear token exhausted. If it was a friendly unit, play two Gold gear tokens exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "kill",
            target: target({
              zone: "battlefield",
              might: { op: "lte", value: 2 },
              targetRef: "target:0",
            }),
          },
          {
            op: "if",
            condition: custom("sfd:ref-was-friendly", { ref: "target:0", friendly: false }),
            then: gold(),
          },
          {
            op: "if",
            condition: custom("sfd:ref-was-friendly", { ref: "target:0", friendly: true }),
            then: gold(2),
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Drag Under",
  text: "[Action] (Play on your turn or in showdowns.)\nI cost [2] less to play from anywhere other than your hand.\nKill a unit at a battlefield.",
  status: "implemented",
  abilities: [
    // 366.2.a: the card's own cost passive applies in the zone it is played from.
    whilePassive(custom("sfd:self-not-in-hand"), { kind: "cost", amount: -2, target: SELF }),
    { kind: "spell", effect: { op: "kill", target: target({ zone: "battlefield" }) } },
  ],
});

registerCardScript({
  name: "Production Surge",
  text: "This costs [2] less if you control a Mech.\nPlay a 3 [Might] Mech unit token to your base.\nDraw 1.",
  status: "implemented",
  abilities: [
    whilePassive(
      { kind: "exists", selector: { cardType: "unit", controller: "self", tag: "Mech" } },
      { kind: "cost", amount: -2, target: SELF },
    ),
    { kind: "spell", effect: { op: "seq", effects: [mech(), { op: "draw", amount: 1 }] } },
  ],
});

registerCardScript({
  name: "Beast Below",
  text: "When you play me, return another friendly unit and an enemy unit to their owners' hands.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "return_to_hand", target: target({ controller: "self", excludeSelf: true }) },
          { op: "return_to_hand", target: target(ENEMY_UNIT) },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Bubble Bot",
  text: "When you play me, ready another friendly Mech.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "ready",
        target: target({ controller: "self", tag: "Mech", excludeSelf: true }),
      },
    },
  ],
});

registerCardScript({
  name: "Sandshifter",
  text: "When you play me, kill an enemy unit with 3 [Might] or less.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "kill", target: target({ ...ENEMY_UNIT, might: { op: "lte", value: 3 } }) },
    },
  ],
});

registerCardScript({
  name: "Trove Golem",
  text: "When you play me, play four Gold gear tokens exhausted.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: gold(4) }],
});

registerCardScript({
  name: "Royal Guard",
  text: "When you play me, play a 2 [Might] Sand Soldier unit token here.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: sandSoldier(HERE_ZONE) }],
});

registerCardScript({
  name: "Eager Drakehound",
  text: "I enter ready.",
  status: "implemented",
  abilities: [enterReady()],
});

registerCardScript({
  name: "Direwing",
  text: "I enter ready if you control another Dragon.",
  status: "implemented",
  abilities: [
    enterReady({
      kind: "exists",
      selector: { controller: "self", tag: "Dragon", excludeSource: true },
    }),
  ],
});

registerCardScript({
  name: "Xin Zhao, Vigilant",
  text: "[Tank] (I must be assigned combat damage first.)\nI enter ready if you have two or more other units in your base.",
  status: "implemented",
  abilities: [
    enterReady({
      kind: "count",
      selector: { cardType: "unit", controller: "self", zone: "base", excludeSource: true },
      comparison: { op: "gte", value: 2 },
    }),
  ],
});

registerCardScript({
  name: "Honest Broker",
  text: "[DEATHKNELL] — Play a Gold gear token exhausted. (When I die, get the effect.)",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_DIE, effect: gold() }],
});

registerCardScript({
  name: "Ferrous Forerunner",
  text: "[DEATHKNELL] — Play two 3 [Might] Mech unit tokens to your base. (When I die, get the effect.)",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_DIE, effect: mech(2) }],
});

registerCardScript({
  name: "Unsung Hero",
  text: "[Deathknell] — If I was [Mighty], draw 2. (When I die, get the effect. I'm Mighty while I have 5+ [Might].)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      // 383.2.a.1 / 808.1.d.3: "if I was Mighty" reads the last-known Might on the kill event.
      condition: custom("sfd:event-might-at-least", { n: 5 }),
      effect: { op: "draw", amount: 2 },
    },
  ],
});

registerCardScript({
  name: "Lonely Poro",
  text: "[Deathknell] — If I died alone, draw 1. (When I die, get the effect. I'm alone if there are no other friendly units here.)",
  status: "partial",
  notes:
    '"Alone" is checked against friendly units still at my location after the death; friendly units that died simultaneously (e.g. the same combat damage step, 467.2.d) are not looked back at (no last-known information of other objects, 359.3.e.13).',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      condition: custom("sfd:died-alone"),
      effect: { op: "draw", amount: 1 },
    },
  ],
});
