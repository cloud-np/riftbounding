/**
 * Unleashed battlefields (battlefield abilities act for the event's player, 190.6; "here" is the
 * battlefield itself, 053.3):
 *
 * - Abandoned Hall (UNL-205): when a player plays a spell (420.4.a), they may give a unit they
 *   control here +1 [Might] this turn.
 * - Amateur Recital (UNL-207): when you hold here, you may move a unit at a battlefield to its base.
 * - Black Flame Altar (UNL-208): units here with [Temporary] have [Shield] (passive, 365.1).
 * - Forbidding Waste (UNL-210): while a unit here is defending alone, it has -2 [Might].
 * - Ripper's Bay (UNL-214): when a unit here is returned to a player's hand, that player may pay
 *   [1] to channel 1 rune exhausted.
 * - Star Spring (UNL-215): the first time a player plays a non-token unit here each turn (383.3.e),
 *   they may move another unit they control here to its base.
 * - Valley of Idols (UNL-218): when a player plays a unit here, they may pay [1] to [Buff] it.
 * - Vaults of Helia (UNL-219): when you hold here, your non-token units cost [1] more to play this
 *   turn (356.3).
 */
import { registerCardScript } from "../registry";
import { EVENT_SUBJECT, HERE, WHEN_YOU_HOLD_HERE, aUnit, custom } from "../dsl";

registerCardScript({
  name: "Abandoned Hall",
  text: "When a player plays a spell, they may give a unit they control here +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "spell_resolved" } },
      optional: true,
      effect: {
        op: "temporary_might",
        amount: 1,
        target: aUnit({ controller: "self", zone: HERE }),
      },
    },
  ],
});

registerCardScript({
  name: "Amateur Recital",
  text: "When you hold here, you may move a unit at a battlefield to its base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      optional: true,
      effect: { op: "move", target: aUnit({ zone: "battlefield" }), to: "base" },
    },
  ],
});

registerCardScript({
  name: "Black Flame Altar",
  text: "Units here with [temporary] have [shield] . (+1 while they're defenders)",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Shield",
        target: { cardType: "unit", zone: HERE, keyword: "Temporary" },
      },
    },
  ],
});

registerCardScript({
  name: "Forbidding Waste",
  text: "While a unit here is defending alone, it has -2 [Might] . (It's alone if there are no other friendly units here.)",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: -2,
        target: { cardType: "unit", zone: HERE, where: custom("unl:defending-alone") },
      },
    },
  ],
});

registerCardScript({
  name: "Ripper's Bay",
  text: "When a unit here is returned to a player's hand, that player may pay [1] to channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "return_to_hand", from: HERE, cardType: "unit" } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "channel", amount: 1, exhausted: true },
      },
    },
  ],
});

registerCardScript({
  name: "Star Spring",
  text: "The first time a player plays a non-token unit here each turn, they may move another unit they control here to its base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "unit_played",
          zone: HERE,
          condition: {
            kind: "not",
            condition: { kind: "exists", selector: { targetRef: "event", token: true } },
          },
        },
      },
      limit: { kind: "once-per-turn" },
      optional: true,
      effect: {
        op: "move",
        target: aUnit({ controller: "self", zone: HERE, excludeRefs: ["event"] }),
        to: "base",
      },
    },
  ],
});

registerCardScript({
  name: "Valley of Idols",
  text: "When a player plays a unit here, they may pay [1] to [buff] it. (Give it a +1 [might] buff if it doesn't have one.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "unit_played", zone: HERE } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "buff", target: EVENT_SUBJECT },
      },
    },
  ],
});

registerCardScript({
  name: "Vaults of Helia",
  text: "When you hold here, your non-token units cost [1] more to play this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: {
        op: "continuous",
        modifier: {
          kind: "cost",
          amount: 1,
          target: { cardType: "unit", controller: "self", token: false },
        },
        duration: "this-turn",
      },
    },
  ],
});
