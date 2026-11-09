/**
 * Unleashed gear, battlefields and legends (wave R3, batch 6):
 *
 * - Honeyfruit: [Reaction] [Tap]: [Add] [Rune]; [Level 6] [Reaction] [Tap]: [Add] [1][Rune].
 * - Scryer's Bloom: Kill this, [1], [Tap]: [Predict 2], then draw 1. Gain 1 XP.
 * - Blast Cone: when you play this, you may move an enemy unit; when you move an enemy unit, you
 *   may exhaust this to stun it.
 * - Gutter Palace: Discard 1, [Tap]: play a 1 [Might] Bird token.
 * - Blighted Battleaxe, Hextech Gauntlets: [Equip] gear with a Might bonus.
 * - Frozen Fortress, Dusk Rose Lab: Beginning Phase battlefields.
 * - Lillia, Bashful Bloom and Diana, Scorn of the Moon (legends).
 */
import { registerCardScript } from "../registry";
import { HERE, SELF, WHEN_PLAYED, aUnit, custom, token } from "../dsl";
import { equip } from "./gear-misc";

const HOST = { targetRef: "host" } as const;
const ENTERS_EXHAUSTED_NOTE =
  "'This enters exhausted' is a play trigger that exhausts it, not a replacement while it enters (369, 149.1): in the window before it resolves it could still be used.";

registerCardScript({
  name: "Honeyfruit",
  text: "This enters exhausted.\n[Reaction] [Tap]: [Add] [Rune]. (Abilities that add resources can't be reacted to.)\n[Level 6] [Reaction] [Tap]: [Add] [1][Rune]. (Use this ability only while you have 6+ XP.)",
  status: "partial",
  notes: ENTERS_EXHAUSTED_NOTE,
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Add" },
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "exhaust", target: SELF } },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: { op: "add", resources: { power: { any: 1 } } },
    },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: {
        op: "requires",
        condition: custom("xp-at-least", { n: 6 }),
        rule: "824.1.b.1",
        effect: { op: "add", resources: { energy: 1, power: { any: 1 } } },
      },
    },
  ],
});

registerCardScript({
  name: "Scryer's Bloom",
  text: "This enters exhausted.\nKill this,[1] , [tap] : [Predict 2], then draw 1. Gain 1 XP. (To Predict 2, look at the top two cards of your Main Deck. Recycle any of them and put the rest back in any order.)",
  status: "partial",
  notes: ENTERS_EXHAUSTED_NOTE,
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "exhaust", target: SELF } },
    {
      kind: "activated",
      cost: { energy: 1, kill: SELF, exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          { op: "predict", amount: 2 },
          { op: "draw", amount: 1 },
          { op: "gain_xp", amount: 1 },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Blast Cone",
  text: "When you play this, you may move an enemy unit. When you move an enemy unit, you may exhaust this to [Stun] it. (It doesn't deal combat damage this turn.)",
  status: "partial",
  notes:
    "'When you move an enemy unit, you may exhaust this to [Stun] it' is not automated: a move event records only the moved unit's controller, not who moved it, so 'you move an enemy unit' cannot be told from the enemy's own moves (412.4, 421). The play trigger's optional move is.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: {
        op: "move",
        target: aUnit({ controller: "opponent" }),
        to: { kind: "chosen", ref: "destination" },
      },
    },
  ],
});

registerCardScript({
  name: "Gutter Palace",
  text: "At the start of your Beginning Phase, if you have exactly 4 cards in hand and exactly 4 units at battlefields, you win the game.\nDiscard 1, [tap] : Play a 1 [might] Bird unit Token with [deflect] . (Opponents must pay [rune] to choose it with a spell or ability.)",
  status: "partial",
  notes:
    "The win condition is not automated: there is no effect that wins the game (a Victory outside scoring, 470.1 / 105); only the Bird-making ability is. The catalog's [Deflect] is the token's (suppressed).",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Deflect" },
    {
      kind: "activated",
      cost: { discard: 1, exhaust: SELF },
      effect: { op: "create", token: token("Bird", { might: 1, play: true }), zone: "base" },
    },
  ],
});

registerCardScript({
  name: "Blighted Battleaxe",
  text: "[Equip][1][Fury] ([1][Fury]: Attach this to a unit you control.)\nAt the end of your turn, If I didn't conquer this turn, unattach this and deal 4 to me.\n+4 [Might]",
  status: "partial",
  notes:
    "'At the end of your turn, if I didn't conquer this turn, unattach this and deal 4 to me' is not automated: whether the equipped unit conquered this turn is not tracked (383.4.c, 717); Equip and +4 Might are.",
  abilities: [
    equip({ energy: 1, power: { Fury: 1 } }),
    { kind: "passive", modifier: { kind: "might", amount: 4, target: HOST } },
  ],
});

registerCardScript({
  name: "Hextech Gauntlets",
  text: "[Equip][3][Rune]. This ability's Energy cost is reduced by the Might of the unit you choose. (Pay the cost: Attach this to a unit you control.)\nWhen I conquer, if you assigned 3 or more excess damage, draw 1.\n+3 [Might]",
  status: "partial",
  notes:
    "Not automated: the Equip Energy reduction by the chosen unit's Might (a cost that reads a choice, 818.1.c.2) — Equip is offered at its full [3][Rune] cost — and the conquer draw (excess damage assigned in combat is not recorded, 467.2.c.4).",
  abilities: [
    equip({ energy: 3, power: { any: 1 } }),
    { kind: "passive", modifier: { kind: "might", amount: 3, target: HOST } },
  ],
});

registerCardScript({
  name: "Frozen Fortress",
  text: "At the start of each player's Beginning Phase, deal 1 to each unit here. (This happens before scoring.)",
  status: "partial",
  notes:
    "Only triggers at the start of the Beginning Phase of the battlefield's controller: phase triggers of printed abilities are 'your phase' (383.3, 315.2.a.1) and there is no way to mark one as firing on every player's turn.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      effect: { op: "deal", amount: 1, target: { cardType: "unit", zone: HERE, all: true } },
    },
  ],
});

registerCardScript({
  name: "Dusk Rose Lab",
  text: "At the start of you Beginning Phase, you may kill a unit you control here to draw 1. (This happens before scoring.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      optional: true,
      effect: {
        op: "seq",
        effects: [
          { op: "kill", target: aUnit({ controller: "self", zone: HERE }) },
          { op: "if", condition: custom("did"), then: { op: "draw", amount: 1 } },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Lillia, Bashful Bloom",
  text: "[4], [tap]: Play a ready 3[might] Sprite unit Token with [temporary] . This ability costs [1] less for each friendly unit with [temporary].",
  status: "partial",
  notes:
    "The '[1] less for each friendly unit with [Temporary]' reduction is not automated: cost modifiers apply to cards, not to activated abilities (366, 377); the ability is offered at its full [4]. The catalog's [Temporary] is the Sprite token's (suppressed).",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Temporary" },
    {
      kind: "activated",
      cost: { energy: 4, exhaust: SELF },
      effect: {
        op: "create",
        token: token("Sprite", { might: 3, exhausted: false, play: true }),
        zone: "base",
      },
    },
  ],
});

registerCardScript({
  name: "Diana, Scorn of the Moon",
  text: "[reaction] [tap]: [add] [1] . Spend this Energy only during showdowns. (Abilities that add recources can't be reacted to.)",
  status: "partial",
  notes:
    "'Spend this Energy only during showdowns' is approximated by only allowing the ability to be used during a showdown: the Energy then sits in the pool until it empties (054.1, 166).",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Add" },
    {
      kind: "activated",
      cost: { exhaust: SELF },
      keywords: ["reaction"],
      addsResources: true,
      effect: {
        op: "requires",
        condition: custom("unl:in-showdown"),
        rule: "340",
        effect: { op: "add", resources: { energy: 1 } },
      },
    },
  ],
});

registerCardScript({
  name: "Shard of Undoing",
  text: "The first time a friendly unit dies during your Beginning Phase each turn, each opponent must kill one of their units.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "die",
          subject: { cardType: "unit", controller: "self" },
          condition: {
            kind: "and",
            conditions: [
              { kind: "is-phase", phase: "beginning" },
              { kind: "is-turn-player", player: "self" },
            ],
          },
        },
      },
      limit: { kind: "once-per-turn" },
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "victim",
            selector: { cardType: "unit", controller: "opponent" },
            min: 1,
            max: 1,
            chooser: "opponent",
          },
          { op: "kill", target: { targetRef: "victim" } },
        ],
      },
    },
  ],
});
