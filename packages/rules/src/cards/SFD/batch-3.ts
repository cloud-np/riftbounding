/**
 * Spiritforged (SFD) — wave R3 batch 3: move / attack / defend / conquer / hold / combat-win
 * triggers, play effects (optional additional costs, 356.4.f.1), battlefields and delayed
 * effects.
 */
import type { CardTypeName, Condition, Effect, Selector } from "@rift/protocol";
import { registerCardScript } from "../registry";
import {
  EVENT_SUBJECT,
  PAID_ADDITIONAL,
  SELF,
  WHEN_I_MOVE,
  WHEN_PLAYED,
  WHEN_YOU_CONQUER_HERE,
  WHEN_YOU_DEFEND_HERE,
  WHEN_YOU_HOLD_HERE,
  custom,
} from "../dsl";
import {
  HERE_ZONE,
  WHEN_I_ATTACK_OR_DEFEND,
  WHEN_I_CONQUER,
  WHEN_I_DEFEND,
  WHEN_I_HOLD,
  WHEN_I_MOVE_FROM_BATTLEFIELD,
  WHEN_I_MOVE_TO_BATTLEFIELD,
  WHEN_I_WIN_A_COMBAT,
  WHEN_YOU_WIN_A_COMBAT,
  countOf,
  enterReady,
  gold,
  notIntrinsic,
  recruit,
  sandSoldier,
  target,
} from "./common";

const IN_LOOKED: Condition = custom("in-ref", { ref: "looked" });
const LOOKED: Selector = { zone: "deck", where: IN_LOOKED };

/** Reveal the top card of your Main Deck; if it matches `type`, `then` it; otherwise recycle it. */
function revealTop(type: CardTypeName, then: Effect): Effect {
  return {
    op: "look",
    amount: 1,
    then: {
      op: "seq",
      effects: [
        { op: "reveal", target: LOOKED },
        {
          op: "if",
          condition: { kind: "exists", selector: { ...LOOKED, cardType: type } },
          then,
          else: { op: "recycle", target: LOOKED },
        },
      ],
    },
  };
}

/* ---------------------------------------------------------------- move triggers */

registerCardScript({
  name: "Apprentice Smith",
  text: "When I move, reveal the top card of your Main Deck. If it's a gear, draw it. Otherwise, recycle it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: revealTop("gear", { op: "custom", id: "sfd:draw-ref", params: { ref: "looked" } }),
    },
  ],
});

registerCardScript({
  name: "Harpoon Squad",
  text: "When I move from a battlefield, give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_FROM_BATTLEFIELD,
      effect: { op: "temporary_might", amount: 2, target: SELF },
    },
  ],
});

registerCardScript({
  name: "Ribbon Dancer",
  text: "When I move to a battlefield, give another friendly unit +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_TO_BATTLEFIELD,
      effect: {
        op: "temporary_might",
        amount: 1,
        target: target({ controller: "self", excludeSelf: true }),
      },
    },
  ],
});

registerCardScript({
  name: "Corrupt Enforcer",
  text: "When I move to a battlefield, discard 1.\nWhen I win a combat, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_TO_BATTLEFIELD,
      effect: { op: "discard", amount: 1 },
    },
    { kind: "triggered", trigger: WHEN_I_WIN_A_COMBAT, effect: { op: "draw", amount: 1 } },
  ],
});

registerCardScript({
  name: "Corina Veraza",
  text: "[Accelerate] (You may pay [1][Order] as an additional cost to have me enter ready.)\nWhen I move to a battlefield, play three 1 [Might] Recruit unit tokens here.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_I_MOVE_TO_BATTLEFIELD, effect: recruit(HERE_ZONE, 3) },
  ],
});

registerCardScript({
  name: "Fae Porter",
  text: "When I move to a battlefield, you may pay [Chaos] to move a unit you control to the same battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_TO_BATTLEFIELD,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { power: { Chaos: 1 } },
        effect: {
          op: "move",
          target: target({ controller: "self", excludeSelf: true }),
          to: HERE_ZONE,
        },
      },
    },
  ],
});

/* ---------------------------------------------------------------- conquer / hold */

registerCardScript({
  name: "Plundering Poro",
  text: "When I conquer, play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_CONQUER, effect: gold() }],
});

registerCardScript({
  name: "Eminent Benefactor",
  text: "When I hold, play two Gold gear tokens exhausted.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_I_HOLD, effect: gold(2) }],
});

registerCardScript({
  name: "Dunebreaker",
  text: "If you have two or fewer cards in your hand, I enter ready.\nWhen I hold, draw 2.",
  status: "implemented",
  abilities: [
    enterReady({ kind: "compare", left: { kind: "cards-in-hand" }, op: "lte", right: 2 }),
    { kind: "triggered", trigger: WHEN_I_HOLD, effect: { op: "draw", amount: 2 } },
  ],
});

registerCardScript({
  name: "Guardian of the Passage",
  text: "When I hold, you may return a unit or gear from your trash to your hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "returned",
            selector: { zone: "trash", owner: "self", cardType: "permanent" },
            min: 1,
            max: 1,
          },
          { op: "return_to_hand", target: { targetRef: "returned" } },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Lucian, Merciless",
  text: "[Weaponmaster] (When you play me, you may [Equip] one of your Equipment to me for [Rune] less, even if it's already attached.)\nThe first time I conquer each turn, ready me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      limit: { kind: "once-per-turn" },
      effect: { op: "ready", target: SELF },
    },
  ],
});

/* ---------------------------------------------------------------- combat */

registerCardScript({
  name: "Draven, Vanquisher",
  text: "When I win a combat, play a Gold gear token exhausted.\nWhen I attack or defend, you may pay [Fury] to give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_I_WIN_A_COMBAT, effect: gold() },
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { power: { Fury: 1 } },
        effect: { op: "temporary_might", amount: 2, target: SELF },
      },
    },
  ],
});

registerCardScript({
  name: "Draven, Audacious",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nThe first time I win a combat each turn, you score 1 point.\nWhen I die in combat, choose an opponent. They score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_WIN_A_COMBAT,
      limit: { kind: "once-per-turn" },
      effect: { op: "score_points", amount: 1 },
    },
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "die", subject: SELF, condition: custom("sfd:died-in-combat") },
      },
      effect: { op: "score_points", amount: 1, player: { kind: "chosen", ref: "opponent" } },
    },
  ],
});

registerCardScript({
  name: "Draven, Glorious Executioner",
  text: "When you win a combat, draw 1. (You win if only your units remain after combat.)",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_YOU_WIN_A_COMBAT, effect: { op: "draw", amount: 1 } },
  ],
});

registerCardScript({
  name: "Loyal Pup",
  text: "When you defend at a battlefield, you may move me there.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // 383.4.f: the player-level Defender designation event (466.2.c.3).
      trigger: { kind: "event", event: { type: "defend", player: "self", data: { player: true } } },
      optional: true,
      effect: { op: "move", target: SELF, to: { kind: "chosen", ref: "event-zone" } },
    },
  ],
});

registerCardScript({
  name: "Overzealous Fan",
  text: "When I defend, you may kill me to move an attacking unit to its base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DEFEND,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { kill: SELF },
        effect: {
          op: "move",
          target: target({ where: custom("sfd:attacking", { ref: "it" }) }),
          to: "base",
        },
      },
    },
  ],
});

registerCardScript({
  name: "Fiora, Worthy",
  text: "When a unit you control becomes [Mighty], you may pay [Order] to ready it. (A unit is Mighty while it has 5+ [Might].)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "become_mighty", player: "self" } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { power: { Order: 1 } },
        effect: { op: "ready", target: EVENT_SUBJECT },
      },
    },
  ],
});

registerCardScript({
  name: "Fiora, Grand Duelist",
  text: "When one of your units becomes [Mighty], you may exhaust me to channel 1 rune exhausted. (A unit is Mighty while it has 5+ [Might].)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "become_mighty", player: "self" } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { exhaust: SELF },
        effect: { op: "channel", amount: 1, exhausted: true },
      },
    },
  ],
});

/* ---------------------------------------------------------------- battlefields */

registerCardScript({
  name: "Hall of Legends",
  text: "When you conquer here, you may pay [1] to ready your legend.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "ready", target: { cardType: "legend", controller: "self" } },
      },
    },
  ],
});

registerCardScript({
  name: "Treasure Hoard",
  text: "When you conquer here, you may pay [1] to play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: { op: "cost_then", optional: true, cost: { energy: 1 }, effect: gold() },
    },
  ],
});

registerCardScript({
  name: "Power Nexus",
  text: "When you hold here, you may pay [Rune][Rune][Rune][Rune] to score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: {
        op: "cost_then",
        optional: true,
        cost: { power: { any: 4 } },
        effect: { op: "score_points", amount: 1 },
      },
    },
  ],
});

registerCardScript({
  name: "The Papertree",
  text: "When you hold here, each player channels 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: { op: "channel", amount: 1, player: "each", exhausted: true },
    },
  ],
});

registerCardScript({
  name: "Minefield",
  text: "When you conquer here, put the top 2 cards of your Main Deck into your trash.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: { op: "custom", id: "sfd:mill", params: { amount: 2 } },
    },
  ],
});

registerCardScript({
  name: "Sunken Temple",
  text: "When you conquer here with one or more [Mighty] units, you may pay [1] to draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      condition: {
        kind: "exists",
        selector: { cardType: "unit", controller: "self", zone: HERE_ZONE, mighty: true },
      },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: { op: "draw", amount: 1 },
      },
    },
  ],
});

registerCardScript({
  name: "Seat of Power",
  text: "When you conquer here, draw 1 for each other battlefield you or allies control.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: {
        op: "draw",
        amount: countOf({
          cardType: "battlefield",
          excludeSource: true,
          where: custom("sfd:it-battlefield-friendly"),
        }),
      },
    },
  ],
});

registerCardScript({
  name: "Ravenbloom Conservatory",
  text: "When you defend here, reveal the top card of your Main Deck. If it's a spell, put it in your hand. Otherwise, recycle it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_DEFEND_HERE,
      effect: revealTop("spell", {
        op: "custom",
        id: "sfd:to-hand-ref",
        params: { ref: "looked" },
      }),
    },
  ],
});

registerCardScript({
  name: "Veiled Temple",
  text: "When you conquer here, you may ready a friendly gear. If it's an equipment, you may detach it.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      effect: {
        op: "may",
        label: "Ready a friendly gear?",
        effect: {
          op: "seq",
          effects: [
            {
              op: "ready",
              target: { chosen: true, cardType: "gear", controller: "self", targetRef: "target:0" },
            },
            {
              op: "if",
              condition: { kind: "exists", selector: { targetRef: "target:0", tag: "Equipment" } },
              then: {
                op: "may",
                label: "Detach it?",
                effect: { op: "detach", target: { targetRef: "target:0" } },
              },
            },
          ],
        },
      },
    },
  ],
});

registerCardScript({
  name: "Emperor's Dais",
  text: "When you conquer here, you may pay [1] and return a unit you control here to its owner's hand to play a 2 [Might] Sand Soldier unit token here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_CONQUER_HERE,
      // 740.4.a: both parts of the cost ("pay [1] and return a unit you control here") must be
      // payable; they are paid on resolution, then the Sand Soldier is played.
      condition: {
        kind: "exists",
        selector: { cardType: "unit", controller: "self", zone: HERE_ZONE },
      },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "returned",
              selector: { cardType: "unit", controller: "self", zone: HERE_ZONE },
              min: 1,
              max: 1,
            },
            { op: "return_to_hand", target: { targetRef: "returned" } },
            { op: "if", condition: custom("did"), then: sandSoldier(HERE_ZONE) },
          ],
        },
      },
    },
  ],
});

/* ---------------------------------------------------------------- spells with delayed / continuous effects */

registerCardScript({
  name: "Rally the Troops",
  text: "[Action] (Play on your turn or in showdowns.)\nWhen a friendly unit is played this turn, buff it. (If it doesn't have a buff, it gets a +1 [Might] buff.)\nDraw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "delayed",
            trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
            effect: { op: "buff", target: EVENT_SUBJECT },
            duration: "this-turn",
          },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Bushwhack",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nFriendly units enter ready this turn. Play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "continuous",
            modifier: {
              kind: "custom",
              id: "enter-ready",
              params: { target: { cardType: "unit", controller: "self" } },
            },
            duration: "this-turn",
          },
          gold(),
        ],
      },
    },
  ],
});

/* ---------------------------------------------------------------- buff triggers */

registerCardScript({
  name: "Simian Ancestor",
  text: "When you buff me, ready me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "buff", subject: SELF, player: "self" } },
      effect: { op: "ready", target: SELF },
    },
  ],
});

registerCardScript({
  name: "Fae Dragon",
  text: "When you play me, buff up to four friendly units. (Give each a +1 [Might] buff if it doesn't have one.)\nWhen you spend a buff, play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "buff", target: target({ controller: "self", maxCount: 4 }) },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "spend_buff", player: "self" } },
      effect: gold(),
    },
  ],
});

/* ---------------------------------------------------------------- play effects */

registerCardScript({
  name: "Buhru Captain",
  text: "When you play me, you may draw 1 or buff me. (To buff a unit, give it  +1 [Might] buff if it doesn't already have one.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "choose_mode",
        modes: [
          { id: "draw", label: "Draw 1", effect: { op: "draw", amount: 1 } },
          { id: "buff", label: "Buff me", effect: { op: "buff", target: SELF } },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Dropboarder",
  text: "When you play me, if you control two or more gear, ready me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: {
        kind: "count",
        selector: { cardType: "gear", controller: "self" },
        comparison: { op: "gte", value: 2 },
      },
      effect: { op: "ready", target: SELF },
    },
  ],
});

registerCardScript({
  name: "Royal Entourage",
  text: "When you play me, ready or exhaust a legend.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "ready",
            label: "Ready a legend",
            effect: {
              op: "ready",
              target: { chosen: true, cardType: "legend", targetRef: "target:0" },
            },
          },
          {
            id: "exhaust",
            label: "Exhaust a legend",
            effect: {
              op: "exhaust",
              target: { chosen: true, cardType: "legend", targetRef: "target:1" },
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Gem Jammer",
  text: "When you play me, give a unit [GANKING] this turn. It can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Ganking"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "grant_keyword", keyword: "Ganking", target: target(), duration: "this-turn" },
    },
  ],
});

registerCardScript({
  name: "Pickpocket",
  text: "When you play me, you may kill a gear with Energy cost no more than [1]. If you do, play a Gold gear token exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "seq",
        effects: [
          {
            op: "kill",
            target: {
              chosen: true,
              cardType: "gear",
              energyCost: { op: "lte", value: 1 },
              targetRef: "target:0",
            },
          },
          { op: "if", condition: custom("did"), then: gold() },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Disarming Rake",
  text: "When you play me, you may kill a gear.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: { op: "kill", target: { chosen: true, cardType: "gear" } },
    },
  ],
});

registerCardScript({
  name: "Windsinger",
  text: "Hidden (Hide now for [Rune] to react with later for [0].)\nWhen you play me, you may return another unit at a battlefield with 3 [Might] or less to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "return_to_hand",
        target: target({ zone: "battlefield", might: { op: "lte", value: 3 }, excludeSelf: true }),
      },
    },
  ],
});

registerCardScript({
  name: "Sea Monkey",
  text: "You may pay [1] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, buff me. (Give me a +1 [Might] buff if I don't already have one.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "buff", target: SELF },
    },
  ],
});

registerCardScript({
  name: "Blast Corps Cadet",
  text: "You may pay [1][Fury] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, deal 2 to a unit at a battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "deal", amount: 2, target: target({ zone: "battlefield" }) },
    },
  ],
});

registerCardScript({
  name: "Frostcoat Cub",
  text: "You may pay [Mind] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, give a unit -2  this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "temporary_might", amount: -2, target: target() },
    },
  ],
});

registerCardScript({
  name: "Zaun Punk",
  text: "You may kill a friendly gear as an additional cost to play me.\nWhen you play me, if you paid the additional cost, kill a gear.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "kill", target: { chosen: true, cardType: "gear" } },
    },
  ],
});

registerCardScript({
  name: "Aspiring Engineer",
  text: "When you play me, return a gear from your trash to your hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "return_to_hand",
        target: { chosen: true, cardType: "gear", zone: "trash", owner: "self" },
      },
    },
  ],
});

registerCardScript({
  name: "Undertitan",
  text: "When you play me, give your other units +2 [Might] this turn.\nAs I'm revealed from your deck, [Add] [2].",
  status: "partial",
  notes:
    '"As I\'m revealed from your deck, [Add] [2]": abilities of cards in the Main Deck that act as they are revealed (385, 425) are not supported.',
  abilities: [
    ...notIntrinsic("Add"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "temporary_might",
        amount: 2,
        target: { cardType: "unit", controller: "self", excludeSource: true },
      },
    },
  ],
});

registerCardScript({
  name: "Ezreal, Prodigy",
  text: "When you play me, discard 1, then draw 2.\nOptional additional costs you pay cost [1] or [Rune] less.",
  status: "partial",
  notes:
    '"Optional additional costs you pay cost [1] or [Rune] less": component discounts on optional additional costs (356.4.c, EX on 356.4.c) are not expressible through `costAdjustments`.',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "discard", amount: 1 },
          { op: "draw", amount: 2 },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Yordle Explorer",
  text: "When you play a card with Power cost [Rune][Rune] or more, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      // 420.4.a: "when you play a card" triggers as playing completes (the card resolves).
      trigger: {
        kind: "event",
        event: {
          type: "played",
          player: "self",
          condition: custom("sfd:event-card-power-at-least", { n: 2 }),
        },
      },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
