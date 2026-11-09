/**
 * Radiance (RAD) spells (wave R3). [Action]/[Reaction]/[Hidden] timing, printed additional costs
 * ("As an additional cost to play this, exhaust a friendly unit", 204.2) and Deflect are the
 * play layer's; each script expresses the spell's effect (359.3.d: top to bottom).
 */
import type { Condition } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { aUnit, custom, token } from "../dsl";
import { aBattlefield, drawCard, letX, opponentsCantPlay, zoneRef } from "./dsl";

const FACE_UP = custom("rad:face-up");

function itIs(extra: Record<string, unknown>): Condition {
  return { kind: "exists", selector: { targetRef: "it", ...extra } };
}

/** An Offer You Can't Refuse (RAD-101) — "Kill a gear. Its controller plays a Gold gear token exhausted." */
registerCardScript({
  name: "An Offer You Can't Refuse",
  text: '[Action] (Play on your turn or in showdowns.)\nKill a gear. Its controller plays a Gold gear token exhausted. (Gold has "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "kill", target: { chosen: true, cardType: "gear", targetRef: "target:0" } },
          // 359.3.e.13: "its controller" is read from last-known information after the kill.
          {
            op: "create",
            token: token("Gold", { exhausted: true, play: true }),
            player: { kind: "controller", of: { targetRef: "target:0" } },
          },
        ],
      },
    },
  ],
});

/** Avalanche (RAD-079) — "Deal 3 to all units in bases." (418.1.d) */
registerCardScript({
  name: "Avalanche",
  text: "Deal 3 to all units in bases.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: { op: "deal", amount: 3, target: { cardType: "unit", zone: "base" } },
    },
  ],
});

/** Burn Away (RAD-124) — "Banish a unit with 3 [Might] or less or a gear. [Burn 2]." (428, 441) */
registerCardScript({
  name: "Burn Away",
  text: "Banish a unit with 3 [Might] or less or a gear. [Burn 2]. (Put the top 2 cards of your Main Deck into your trash.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "banish",
            target: {
              chosen: true,
              where: {
                kind: "and",
                conditions: [
                  FACE_UP,
                  {
                    kind: "or",
                    conditions: [
                      itIs({ cardType: "unit", might: { op: "lte", value: 3 } }),
                      itIs({ cardType: "gear" }),
                    ],
                  },
                ],
              },
            },
          },
          { op: "burn", amount: 2, target: { controller: "self" } },
        ],
      },
    },
  ],
});

/** Consult the Heavens (RAD-025) — "Give a unit [Shield 2] this turn. [Predict]." (814, 437) */
registerCardScript({
  name: "Consult the Heavens",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nGive a unit [Shield 2] this turn. (+2 [Might] while it's a defender.)\n[Predict]. (Look at the top card of your Main Deck. You may recycle it.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "grant_keyword", keyword: "Shield 2", target: aUnit(), duration: "this-turn" },
          { op: "predict", amount: 1 },
        ],
      },
    },
  ],
});

/** High Note (RAD-048) — "Give a unit -[Might] this turn equal to the number of exhausted units you control." */
registerCardScript({
  name: "High Note",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nGive a unit -[Might] this turn equal to the number of exhausted units you control.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "temporary_might",
        amount: {
          kind: "count",
          selector: { cardType: "unit", controller: "self", exhausted: true },
          per: -1,
        },
        target: aUnit(),
      },
    },
  ],
});

/** Hunker Down (RAD-034) — "Ready a friendly unit. It can't move this turn. Draw 1." (416, 054.1) */
registerCardScript({
  name: "Hunker Down",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nReady a friendly unit. It can't move this turn. Draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: aUnit({ controller: "self", targetRef: "target:0" }) },
          {
            op: "continuous",
            duration: "this-turn",
            modifier: {
              kind: "restriction",
              restriction: "move",
              target: { targetRef: "target:0" },
            },
          },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});

/** Hush (RAD-041) — "Counter a spell with Power cost [Rune] [Rune] or more." (426) */
registerCardScript({
  name: "Hush",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nCounter a spell with Power cost [Rune] [Rune] or more.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "counter",
        target: { chosen: true, cardType: "spell", powerCost: { op: "gte", value: 2 } },
      },
    },
  ],
});

/** Ki Burst (RAD-028) — "As an additional cost to play this, exhaust a friendly unit. [Stun] a unit." */
registerCardScript({
  name: "Ki Burst",
  text: "[Action] (Play on your turn or in showdowns.)\n As an additional cost to play this, exhaust a friendly unit.\n[Stun] a unit. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "stun", target: aUnit() } }],
});

/** Life from Stone (RAD-029) — "As an additional cost …, exhaust a friendly unit. Draw 1 and channel 1 rune exhausted." */
registerCardScript({
  name: "Life from Stone",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nAs an additional cost to play this, exhaust a friendly unit.\nDraw 1 and channel 1 rune exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 1 },
          { op: "channel", amount: 1, exhausted: true },
        ],
      },
    },
  ],
});

/** Lost to the Sands (RAD-013) — "Choose one — Deal 4 to a unit at a battlefield. / Kill a gear." (355.3) */
registerCardScript({
  name: "Lost to the Sands",
  text: "[Action] (Play on your turn or in showdowns.)\nChoose one —\n• Deal 4 to a unit at a battlefield.\n• Kill a gear.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "deal",
            label: "Deal 4 to a unit at a battlefield",
            effect: { op: "deal", amount: 4, target: aUnit({ zone: "battlefield" }) },
          },
          {
            id: "kill",
            label: "Kill a gear",
            effect: { op: "kill", target: { chosen: true, cardType: "gear" } },
          },
        ],
      },
    },
  ],
});

/** One-Two Punch (RAD-121) — "[Buff] a friendly unit and [Stun] an enemy unit." (427, 424) */
registerCardScript({
  name: "One-Two Punch",
  text: "[Action] (Play on your turn or in showdowns.)\n[Buff] a friendly unit and [Stun] an enemy unit. (Give the friendly unit a +1 [Might] buff if it doesn't have one. The enemy unit doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "buff", target: aUnit({ controller: "self" }) },
          { op: "stun", target: aUnit({ controller: "opponent" }) },
        ],
      },
    },
  ],
});

/** Raucous Anthem (RAD-134) — "Ready your units and give them +3 [Might] this turn." */
registerCardScript({
  name: "Raucous Anthem",
  text: "Ready your units and give them +3 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: { cardType: "unit", controller: "self" } },
          { op: "temporary_might", amount: 3, target: { cardType: "unit", controller: "self" } },
        ],
      },
    },
  ],
});

/**
 * Realm of Death (RAD-144) — "Give an enemy unit -2 [Might] this turn and a friendly unit +2
 * [Might] this turn. They deal damage equal to their Mights to each other." (418.6.b.3/.4)
 */
registerCardScript({
  name: "Realm of Death",
  text: "Give an enemy unit -2 [Might] this turn and a friendly unit +2 [Might] this turn. They deal damage equal to their Mights to each other.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "temporary_might",
            amount: -2,
            target: aUnit({ controller: "opponent", targetRef: "target:0" }),
          },
          {
            op: "temporary_might",
            amount: 2,
            target: aUnit({ controller: "self", targetRef: "target:1" }),
          },
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:1" } },
            target: { targetRef: "target:0" },
            source: { targetRef: "target:1" },
          },
          {
            op: "deal",
            amount: { kind: "might", selector: { targetRef: "target:0" } },
            target: { targetRef: "target:1" },
            source: { targetRef: "target:0" },
          },
        ],
      },
    },
  ],
});

/** Siren's Song (RAD-098) — "Move an enemy unit that moved this turn." (421) */
registerCardScript({
  name: "Siren's Song",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nMove an enemy unit that moved this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "move",
        target: aUnit({ controller: "opponent", where: custom("rad:moved-this-turn") }),
        to: zoneRef("destination"),
      },
    },
  ],
});

/** Supernova (RAD-059) — "Deal 10 to a unit. Draw 2." */
registerCardScript({
  name: "Supernova",
  text: "Deal 10 to a unit. Draw 2.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "deal", amount: 10, target: aUnit() },
          { op: "draw", amount: 2 },
        ],
      },
    },
  ],
});

/** For Demacia! (RAD-117) — "Choose a battlefield. Give friendly units there [Shield 2] this turn." */
registerCardScript({
  name: "For Demacia!",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a battlefield. Give friendly units there [shield 2] this turn. (+2 [might] while they're defenders.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aBattlefield("battlefield"),
        effect: {
          op: "grant_keyword",
          keyword: "Shield 2",
          target: { cardType: "unit", controller: "self", zone: zoneRef("battlefield") },
          duration: "this-turn",
        },
      },
    },
  ],
});

/** Brawl (RAD-004) — "Give a unit [Assault] this turn equal to its Might." (807.1.c, 807.2) */
registerCardScript({
  name: "Brawl",
  text: "[Action] (Play on your turn or in showdowns.)\nGive a unit [Assault] this turn equal to its Might. (+1 [Might] for each instance of Assault while it's an attacker.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aUnit(),
        effect: letX(
          { amount: { kind: "might", selector: { targetRef: "it" } } },
          {
            op: "grant_keyword",
            keyword: "Assault {X}",
            target: { targetRef: "it" },
            duration: "this-turn",
          },
        ),
      },
    },
  ],
});

/**
 * Improvised Projectile (RAD-056) — "Choose a friendly gear. Deal damage equal to its Energy
 * cost to a unit at a battlefield."
 */
registerCardScript({
  name: "Improvised Projectile",
  text: "[Action] (Play on your turn or in showdowns.)\nChoose a friendly gear. Deal damage equal to its Energy cost to a unit at a battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: { chosen: true, cardType: "gear", controller: "self", targetRef: "target:0" },
        effect: {
          op: "for_each",
          selector: aUnit({ zone: "battlefield", targetRef: "target:1" }),
          effect: letX(
            { energyCostOf: { targetRef: "target:0" } },
            { op: "deal", amount: { kind: "x" }, target: { targetRef: "it" } },
          ),
        },
      },
    },
  ],
});

/**
 * Ntofo Strikes (RAD-148) — "Give a friendly unit [Shield 2] this turn, then deal damage equal to
 * its [Shield] to an enemy unit." (814.2: the summed Shield value)
 */
registerCardScript({
  name: "Ntofo Strikes",
  text: "[Action] (Play on your turn or in showdowns.)\nGive a friendly unit [Shield 2] this turn, then deal damage equal to its [Shield] to an enemy unit. (A unit with Shield has +1 [Might] for each instance of Shield while it's a defender.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "grant_keyword",
            keyword: "Shield 2",
            target: aUnit({ controller: "self", targetRef: "target:0" }),
            duration: "this-turn",
          },
          {
            op: "for_each",
            selector: aUnit({ controller: "opponent", targetRef: "target:1" }),
            effect: letX(
              { keywordValue: "Shield", of: { targetRef: "target:0" } },
              { op: "deal", amount: { kind: "x" }, target: { targetRef: "it" } },
            ),
          },
        ],
      },
    },
  ],
});

/**
 * Forbidden Technique (RAD-010, errata) — "Ready a unit. When you play a card with Energy cost
 * [7] or more, you may play this from your trash for [1][Fury][Fury]. Then banish this."
 */
registerCardScript({
  name: "Forbidden Technique",
  text: "Ready a unit.\nWhen you play a card with Energy cost [7] or more, you may play this from your trash for [1] [Fury] [Fury]. Then banish this.",
  status: "partial",
  notes:
    "The trash trigger (play this from your trash for [1][Fury][Fury], then banish it) needs triggered abilities of cards outside the board (385).",
  abilities: [{ kind: "spell", effect: { op: "ready", target: aUnit() } }],
});

/** Hold 'Em (RAD-070) — "This costs [2] less if you've played a unit or gear to a battlefield this turn. Give a unit +3 [Might] this turn." */
registerCardScript({
  name: "Hold 'Em",
  text: "[Action] (Play on your turn or in showdowns.)\nThis costs [2] less if you've played a unit or gear to a battlefield this turn.\nGive a unit +3 [Might] this turn.",
  status: "partial",
  notes:
    "The [2] discount needs a per-turn record of where units/gear were played (356.4; no play-location history).",
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 3, target: aUnit() } }],
});

/** Battle Preparations (RAD-032) — "[Show Off] a gear. Give a unit +2 [Might] this turn. If you showed off, ready up to 2 runes." */
registerCardScript({
  name: "Battle Preparations",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n[Show Off] a gear. (As you play this, you may reveal a gear from your hand or pick a friendly gear.)\nGive a unit +2 [Might] this turn. If you showed off, ready up to 2 runes.",
  status: "partial",
  notes:
    '[Show Off] (832) is not implemented, so "if you showed off, ready up to 2 runes" never applies.',
  abilities: [{ kind: "spell", effect: { op: "temporary_might", amount: 2, target: aUnit() } }],
});

/** Rousing Display (RAD-127) — "[Show Off] … Play two 1 [Might] Recruit unit tokens to your base. If you showed off, play four instead." */
registerCardScript({
  name: "Rousing Display",
  text: "[Show Off] a card with Energy cost [7] or more. (As you play this, you may reveal such a card from your hand or pick a friendly one.)\nPlay two 1 [Might] Recruit unit tokens to your base. If you showed off, play four to your base instead.",
  status: "partial",
  notes: "[Show Off] (832) is not implemented, so the four-Recruit branch never applies.",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "create",
        token: token("Recruit", { count: 2, might: 1, play: true }),
        zone: "base",
      },
    },
  ],
});

const ENEMY_OCCUPIED_DESTINATION = custom("rad:zone-enemy-occupied", { ref: "destination" });

/**
 * Cataclysm (RAD-084) — "Opponents can't play spells this turn. Move a friendly unit to an
 * occupied enemy battlefield." The destination (355.4) must be an occupied enemy battlefield when
 * chosen (377.2.b-style `requires`) and still be one on resolution (359.3.e.2).
 */
registerCardScript({
  name: "Cataclysm",
  text: "Opponents can't play spells this turn.\nMove a friendly unit to an occupied enemy battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          opponentsCantPlay("spell"),
          {
            op: "requires",
            condition: ENEMY_OCCUPIED_DESTINATION,
            rule: "355.4",
            effect: {
              op: "if",
              condition: ENEMY_OCCUPIED_DESTINATION,
              then: {
                op: "move",
                target: aUnit({ controller: "self" }),
                to: zoneRef("destination"),
              },
            },
          },
        ],
      },
    },
  ],
});

/**
 * Command: Attack (RAD-033) — "Choose one — • Move a friendly gear with [Deploy] to a battlefield.
 * • Look at the top 5 cards of your Main Deck. You may reveal a gear from among them and draw it.
 * Recycle the rest."
 */
const LOOKED: Condition = custom("in-ref", { ref: "looked" });
registerCardScript({
  name: "Command: Attack",
  text: "Choose one —\n• Move a friendly gear with [Deploy] to a battlefield.\n• Look at the top 5 cards of your Main Deck. You may reveal a gear from among them and draw it. Recycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "move",
            label: "Move a friendly gear with [Deploy] to a battlefield",
            effect: {
              op: "seq",
              effects: [
                {
                  op: "requires",
                  condition: custom("rad:zone-is-battlefield", { ref: "destination" }),
                  rule: "355.4",
                  effect: {
                    op: "move",
                    target: {
                      chosen: true,
                      cardType: "gear",
                      controller: "self",
                      keyword: "Deploy",
                    },
                    to: zoneRef("destination"),
                  },
                },
              ],
            },
          },
          {
            id: "look",
            label: "Look at the top 5 cards; draw a gear",
            effect: {
              op: "look",
              amount: 5,
              then: {
                op: "seq",
                effects: [
                  {
                    op: "choose",
                    key: "picked",
                    selector: { zone: "deck", controller: "self", cardType: "gear", where: LOOKED },
                    min: 0,
                    max: 1,
                  },
                  { op: "reveal", target: { targetRef: "picked" } },
                  drawCard("picked"),
                  {
                    op: "recycle",
                    target: {
                      zone: "deck",
                      controller: "self",
                      where: LOOKED,
                      excludeRefs: ["picked"],
                    },
                  },
                ],
              },
            },
          },
        ],
      },
    },
  ],
});

/**
 * The Waters' Wage (RAD-100) — "[Hidden] Play a Gold gear token exhausted. If it's your turn and
 * you played this from face down, play three ready Gold gear tokens instead." (811.6, 184.1)
 */
registerCardScript({
  name: "The Waters' Wage",
  text: '[Hidden] (Hide now for [Rune] to react with later for [0].)\nPlay a Gold gear token exhausted. If it\'s your turn and you played this from face down, play three ready Gold gear tokens instead. (Gold tokens have "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "if",
        condition: {
          kind: "and",
          conditions: [{ kind: "is-turn-player" }, custom("rad:played-from-facedown")],
        },
        then: { op: "create", token: token("Gold", { count: 3, exhausted: false, play: true }) },
        else: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
      },
    },
  ],
});

const OPEN_DESTINATION = custom("rad:zone-open", { ref: "destination" });

/**
 * Demon Shade (RAD-102) — "[Hidden] Choose a friendly unit, then choose one – • Move it to an open
 * battlefield. • Give it [Ganking] this turn if there are no open battlefields." (170.11.c, 810)
 */
registerCardScript({
  name: "Demon Shade",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nChoose a friendly unit, then choose one –\n• Move it to an open battlefield.\n• Give it [Ganking] this turn if there are no open battlefields. (It can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "choose_mode",
        modes: [
          {
            id: "move",
            label: "Move it to an open battlefield",
            effect: {
              op: "seq",
              effects: [
                {
                  op: "requires",
                  condition: OPEN_DESTINATION,
                  rule: "355.4",
                  effect: {
                    op: "if",
                    condition: OPEN_DESTINATION,
                    then: {
                      op: "move",
                      target: aUnit({ controller: "self", targetRef: "target:0" }),
                      to: zoneRef("destination"),
                    },
                  },
                },
              ],
            },
          },
          {
            id: "ganking",
            label: "Give it [Ganking] this turn if there are no open battlefields",
            effect: {
              op: "if",
              condition: custom("rad:no-open-battlefield"),
              then: {
                op: "grant_keyword",
                keyword: "Ganking",
                target: aUnit({ controller: "self", targetRef: "target:0" }),
                duration: "this-turn",
              },
            },
          },
        ],
      },
    },
  ],
});

/** Rally for War (RAD-007) — "Choose an occupied enemy battlefield. Play three 1 [Might] Recruit unit tokens there." */
registerCardScript({
  name: "Rally for War",
  text: "Choose an occupied enemy battlefield. Play three 1 [Might] Recruit unit tokens there.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aBattlefield("battlefield", { where: custom("rad:zone-enemy-occupied") }),
        effect: {
          op: "create",
          token: token("Recruit", { count: 3, might: 1, play: true }),
          zone: zoneRef("battlefield"),
        },
      },
    },
  ],
});
