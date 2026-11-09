/**
 * Radiance (RAD) units with triggered, activated or conditional abilities (wave R3).
 */
import type { Effect, Room } from "@rift/protocol";
import type { RulesHost } from "../../host";
import { registerCardScript } from "../registry";
import {
  EVENT_SUBJECT,
  HERE,
  SELF,
  SELF_AT_BATTLEFIELD,
  WHEN_I_DIE,
  WHEN_I_MOVE,
  WHEN_PLAYED,
  aUnit,
  custom,
  not,
} from "../dsl";
import { registerCombatContributionFilter } from "../../combat/keywords";
import {
  CHOOSE_OPPONENT,
  ENTER_READY,
  UNIT_OR_GEAR,
  aBattlefield,
  conditional,
  costLessForEach,
  drawCard,
  letX,
  notIntrinsic,
  zoneRef,
} from "./dsl";

const WHEN_I_HOLD = { kind: "event" as const, event: { type: "hold", subject: SELF } };
const WHEN_I_CONQUER = { kind: "event" as const, event: { type: "conquer", subject: SELF } };
const WHEN_I_ATTACK = { kind: "event" as const, event: { type: "attack", subject: SELF } };
const WHEN_I_ATTACK_OR_DEFEND = {
  kind: "event" as const,
  event: { type: ["attack", "defend"], subject: SELF },
};
const PLAY_OP_NOTE =
  "units played by the play op go to their controller's base (no location choice, 355.2 / 420.3.b)";

/**
 * Ahri, Confident (RAD-SP1) — "[Disarm] When you reduce the Might of an enemy unit here by 1 or
 * more, give me +1 [Might] this turn." Reductions are `might` events whose responsible player is
 * you (412.4) with a negative amount (Disarm's own trigger included).
 */
registerCardScript({
  name: "Ahri, Confident",
  text: "[Disarm]\nWhen you reduce the Might of an enemy unit here by 1 or more, give me +1[Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "might",
          player: "self",
          subject: { cardType: "unit", controller: "opponent", zone: HERE },
          condition: custom("rad:event-amount", { op: "lte", value: -1 }),
        },
      },
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
  ],
});

/**
 * Angler Wyrm (RAD-113) — "[Deflect] [Tap]: Choose an opponent. They must move a unit they control
 * to my battlefield." The opponent picks the unit (355.18); nothing happens while I'm not at a
 * battlefield or when all their units are already there (355.4.a).
 */
registerCardScript({
  name: "Angler Wyrm",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\n[Tap]: Choose an opponent. They must move a unit they control to my battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          CHOOSE_OPPONENT,
          {
            op: "if",
            condition: SELF_AT_BATTLEFIELD,
            then: {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "moved",
                  chooser: { kind: "chosen", ref: "opponent" },
                  selector: {
                    cardType: "unit",
                    controller: { kind: "chosen", ref: "opponent" },
                    where: not({
                      kind: "exists",
                      selector: { targetRef: "it", sameLocationAs: "self" },
                    }),
                  },
                },
                { op: "move", target: { targetRef: "moved" }, to: HERE },
              ],
            },
          },
        ],
      },
    },
  ],
});

/**
 * Armored Tusker (RAD-078) — "[Shield 3] [Tank] When I move, you may deal damage equal to my
 * [Shield] to a unit at a battlefield." (814.2: the summed Shield value, read on resolution)
 */
registerCardScript({
  name: "Armored Tusker",
  text: "[Shield 3] (+3 [Might] while I'm a defender.)\n[Tank] (I must be assigned combat damage first.)\nWhen I move, you may deal damage equal to my [Shield] to a unit at a battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: {
        op: "may",
        effect: {
          op: "for_each",
          selector: aUnit({ zone: "battlefield" }),
          effect: letX(
            { keywordValue: "Shield", of: SELF },
            { op: "deal", amount: { kind: "x" }, target: { targetRef: "it" }, source: SELF },
          ),
        },
      },
    },
  ],
});

/**
 * Battlefield Armorer (RAD-130) — "When a friendly gear at a battlefield dies, you may pay [1] to
 * return it to its owner's hand." (the kill event notes where it died, 383.2.c.3.b)
 */
registerCardScript({
  name: "Battlefield Armorer",
  text: "When a friendly gear at a battlefield dies, you may pay [1] to return it to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "die",
          subject: { cardType: "gear", controller: "self" },
          condition: custom("event-zone-is", { battlefield: true }),
        },
      },
      effect: {
        op: "cost_then",
        cost: { energy: 1 },
        optional: true,
        effect: { op: "return_to_hand", target: EVENT_SUBJECT },
      },
    },
  ],
});

/**
 * Bedeviling Stranger (RAD-107) — "[Hidden] When you play me, choose a battlefield. If there are 4
 * or more units there, you may return an enemy unit there to its owner's hand."
 */
registerCardScript({
  name: "Bedeviling Stranger",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me, choose a battlefield. If there are 4 or more units there, you may return an enemy unit there to its owner's hand.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "for_each",
        selector: aBattlefield("battlefield"),
        effect: {
          op: "if",
          condition: {
            kind: "count",
            selector: {
              cardType: "unit",
              zone: zoneRef("battlefield"),
              where: custom("rad:face-up"),
            },
            comparison: { op: "gte", value: 4 },
          },
          then: {
            op: "may",
            effect: {
              op: "return_to_hand",
              target: aUnit({ controller: "opponent", zone: zoneRef("battlefield") }),
            },
          },
        },
      },
    },
  ],
});

/** Coalesced Energy (RAD-016) — "At the end of your turn, recycle all your runes, then channel 4 runes exhausted." (417, 431) */
registerCardScript({
  name: "Coalesced Energy",
  text: "At the end of your turn, recycle all your runes, then channel 4 runes exhausted.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "turn-end" },
      effect: {
        op: "seq",
        effects: [
          { op: "recycle", target: { cardType: "rune", controller: "self" } },
          { op: "channel", amount: 4, exhausted: true },
        ],
      },
    },
  ],
});

/**
 * Ekko, Revolutionary (RAD-021) — "I enter ready. [Assault] [Action] Discard 1, [1] [Fury]: Banish
 * me, then play me to your base, ignoring my cost." (428, 420.3)
 */
registerCardScript({
  name: "Ekko, Revolutionary",
  text: "I enter ready.\n[Assault] (+1 [Might] while I'm an attacker.)\n[Action] Discard 1, [1] [Fury]: Banish me, then play me to your base, ignoring my cost.",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Action"),
    ENTER_READY,
    {
      kind: "activated",
      cost: { discard: 1, energy: 1, power: { Fury: 1 } },
      keywords: ["action"],
      effect: {
        op: "seq",
        effects: [
          { op: "banish", target: SELF },
          { op: "play", target: { targetRef: "self" }, cost: "ignored", location: "base" },
        ],
      },
    },
  ],
});

const EVELYNN_HOLD = {
  kind: "triggered" as const,
  trigger: WHEN_I_HOLD,
  condition: custom("rad:facedown-here"),
  effect: {
    op: "if" as const,
    condition: custom("rad:facedown-here"),
    then: { op: "score_points" as const, amount: 1 },
  },
};

/** Evelynn in Control (RAD-SP3) — "[Disarm] When I hold, if you control a facedown card here, score 1 point." (470.2) */
registerCardScript({
  name: "Evelynn in Control",
  text: "[Disarm] (When I attack, give an enemy unit here -1 [Might] this turn.)\nWhen I hold, if you control a facedown card here, score 1 point.",
  status: "implemented",
  abilities: [EVELYNN_HOLD],
});

/** Evelynn, in Control (RAD-109) — same text as RAD-SP3. */
registerCardScript({
  name: "Evelynn, in Control",
  text: "[Disarm] (When I attack, give an enemy unit here -1 [might] this turn.)\nWhen I hold, if you control a facedown card here, score 1 point.",
  status: "implemented",
  abilities: [EVELYNN_HOLD],
});

/**
 * Graves, Blasting Through (RAD-085) — "When I attack or defend, deal damage equal to my Might to
 * all enemy units here. I don't deal combat damage." (the second line is read by combat, 424.1.b)
 */
registerCardScript({
  name: "Graves, Blasting Through",
  text: "When I attack or defend, deal damage equal to my Might to all enemy units here.\nI don't deal combat damage.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "deal",
        amount: { kind: "might", selector: SELF },
        target: { cardType: "unit", controller: "opponent", zone: HERE },
        source: SELF,
      },
    },
  ],
});

/** Heartening Soul (RAD-040) — "When you play me, ready a friendly legend. Friendly legends have '[Tap]: Give a unit +3 [Might] this turn.'" */
registerCardScript({
  name: "Heartening Soul",
  text: 'When you play me, ready a friendly legend.\nFriendly legends have "[tap] : Give a unit +3 [might] this turn."',
  status: "partial",
  notes:
    "Granting an activated ability to friendly legends needs granted abilities (365, 801.3 for abilities).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "ready", target: { chosen: true, cardType: "legend", controller: "self" } },
    },
  ],
});

/** Iridescent Avian (RAD-027) — "[Tap]: [Buff] a unit. If it's already buffed, give it +2 [Might] this turn instead." */
registerCardScript({
  name: "Iridescent Avian",
  text: "[Tap]: [Buff] a unit. If it's already buffed, give it +2[Might] this turn instead. (To buff a unit, give it a +1[Might] buff if it doesn't have one.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Buff"),
    {
      kind: "activated",
      cost: { exhaust: SELF },
      effect: {
        op: "if",
        condition: { kind: "exists", selector: { targetRef: "target:0", buffed: true } },
        then: { op: "temporary_might", amount: 2, target: aUnit({ targetRef: "target:0" }) },
        else: { op: "buff", target: aUnit({ targetRef: "target:0" }) },
      },
    },
  ],
});

/**
 * Jarvan IV, Exemplar of Demacia (RAD-155, legend) — "When you play a gear with [Deploy], you may
 * exhaust me and pay [Rune] to move a friendly unit to that battlefield." (383.3.b leading cost)
 */
registerCardScript({
  name: "Jarvan IV, Exemplar of Demacia",
  text: "When you play a gear with [Deploy], you may exhaust me and pay [Rune] to move a friendly unit to that battlefield.",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deploy"),
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "gear_played",
          player: "self",
          subject: { cardType: "gear", keyword: "Deploy" },
        },
      },
      effect: {
        op: "cost_then",
        cost: { exhaust: SELF, power: { any: 1 } },
        optional: true,
        effect: {
          op: "move",
          target: aUnit({ controller: "self" }),
          to: { kind: "chosen", ref: "event-zone" },
        },
      },
    },
  ],
});

/**
 * Jarvan IV, Martial Paragon (RAD-091) — "Your gear with [Deploy] have [Action]. When I conquer, if
 * there is a friendly gear with [Deploy] here, channel 1 rune exhausted."
 */
const DEPLOY_GEAR_HERE = {
  kind: "exists" as const,
  selector: { cardType: "gear", controller: "self" as const, keyword: "Deploy", zone: HERE },
};
registerCardScript({
  name: "Jarvan IV, Martial Paragon",
  text: "Your gear with [Deploy] have [Action]. (They can be played on your turn or in showdowns.)\nWhen I conquer, if there is a friendly gear with [Deploy] here, channel 1 rune exhausted.",
  status: "partial",
  notes:
    '"Your gear with [Deploy] have [Action]" grants a keyword to cards in hand; the play layer\'s keyword array form does not see passives (801.3, 806).',
  abilities: [
    ...notIntrinsic("Action", "Deploy"),
    {
      kind: "triggered",
      trigger: WHEN_I_CONQUER,
      condition: DEPLOY_GEAR_HERE,
      effect: {
        op: "if",
        condition: DEPLOY_GEAR_HERE,
        then: { op: "channel", amount: 1, exhausted: true },
      },
    },
  ],
});

/** Jarvan IV, Royal Heir (RAD-133) — "[Assault] [Tank] When I attack, you may move a unit you control to my battlefield." */
registerCardScript({
  name: "Jarvan IV, Royal Heir",
  text: "[Assault] (+1 [Might] while I'm attacking.)\n[Tank] (I must be assigned combat damage first.)\nWhen I attack, you may move a unit you control to my battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "may",
        effect: {
          op: "move",
          target: aUnit({ controller: "self", excludeSource: true }),
          to: HERE,
        },
      },
    },
  ],
});

/**
 * K'Sante, Dauntless (RAD-045) — "[Shield] When I attack or defend, double the [Shield] of a unit
 * you control here this turn." Doubling adds an instance equal to its current Shield value (433,
 * 814.2).
 */
registerCardScript({
  name: "K'Sante, Dauntless",
  text: "[Shield] (+1 [Might] while I'm a defender.)\nWhen I attack or defend, double the [Shield] of a unit you control here this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK_OR_DEFEND,
      effect: {
        op: "for_each",
        selector: aUnit({ controller: "self", zone: HERE }),
        effect: {
          op: "if",
          condition: { kind: "has-keyword", selector: { targetRef: "it" }, keyword: "Shield" },
          then: letX(
            { keywordValue: "Shield", of: { targetRef: "it" } },
            {
              op: "grant_keyword",
              keyword: "Shield {X}",
              target: { targetRef: "it" },
              duration: "this-turn",
            },
          ),
        },
      },
    },
  ],
});

/** Momentary Companion (RAD-095) — "[Hidden] When you play me, if it's not your turn, give me [Temporary]." (816) */
const NOT_MY_TURN = { kind: "not" as const, condition: { kind: "is-turn-player" as const } };
registerCardScript({
  name: "Momentary Companion",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me, if it's not your turn, give me [Temporary]. (Kill me at the start of my controller's Beginning Phase, before scoring.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Temporary"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: NOT_MY_TURN,
      effect: {
        op: "if",
        condition: NOT_MY_TURN,
        then: { op: "grant_keyword", keyword: "Temporary", target: SELF },
      },
    },
  ],
});

/** Mordekaiser, Dominating (RAD-137) — "When you play me or when I attack, you may discard 1 to kill a unit or gear." */
const MORDE_KILL: Effect = {
  op: "cost_then",
  cost: { discard: 1 },
  optional: true,
  effect: { op: "kill", target: { chosen: true, where: UNIT_OR_GEAR } },
};
registerCardScript({
  name: "Mordekaiser, Dominating",
  text: "When you play me or when I attack, you may discard 1 to kill a unit or gear.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: MORDE_KILL },
    { kind: "triggered", trigger: WHEN_I_ATTACK, effect: MORDE_KILL },
  ],
});

/** Overloaded Traveler (RAD-072) — "While there's a friendly gear with [Deploy] at my battlefield, I have +1 [Might]." */
registerCardScript({
  name: "Overloaded Traveler",
  text: "While there's a friendly gear with [Deploy] at my battlefield, I have +1 [Might].",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Deploy"),
    {
      kind: "passive",
      modifier: conditional(
        { kind: "and", conditions: [SELF_AT_BATTLEFIELD, DEPLOY_GEAR_HERE] },
        { kind: "might", amount: 1, target: SELF },
      ),
    },
  ],
});

/** Party Crasher (RAD-122) — "I cost [1] less for each exhausted unit you control. [Tank]" (356.4, 366.2.a) */
registerCardScript({
  name: "Party Crasher",
  text: "I cost [1] less for each exhausted unit you control.\n[Tank] (I must be assigned combat damage first.)",
  status: "implemented",
  abilities: costLessForEach({ cardType: "unit", controller: "self", exhausted: true }, 1, 9),
});

/**
 * Raving Witness (RAD-074) — "When I move, reveal the top card of your Main Deck. If it's
 * [Mighty], draw it. Otherwise, recycle it." (A card off the board uses its printed Might, 710/711.)
 */
registerCardScript({
  name: "Raving Witness",
  text: "When I move, reveal the top card of your Main Deck. If it's [Mighty], draw it. Otherwise, recycle it. (A unit is Mighty while it has 5+ [Might].)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Mighty"),
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      effect: {
        op: "look",
        amount: 1,
        then: {
          op: "seq",
          effects: [
            { op: "reveal", target: { targetRef: "looked" } },
            {
              op: "if",
              condition: { kind: "exists", selector: { targetRef: "looked", mighty: true } },
              then: drawCard("looked"),
              else: { op: "recycle", target: { targetRef: "looked" } },
            },
          ],
        },
      },
    },
  ],
});

/**
 * Riven, Deserter (RAD-114) — "When another friendly unit becomes exhausted, give me +1 [Might]
 * this turn. Exhaust a friendly unit: Ready a unit. Use this ability only once each turn."
 */
registerCardScript({
  name: "Riven, Deserter",
  text: "When another friendly unit becomes exhausted, give me +1 [might] this turn.\nExhaust a friendly unit: Ready a unit. Use this ability only once each turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "exhaust",
          subject: { cardType: "unit", controller: "self", excludeSource: true },
        },
      },
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
    {
      kind: "activated",
      cost: { exhaust: { cardType: "unit", controller: "self" } },
      limit: { kind: "once-per-turn" },
      effect: { op: "ready", target: aUnit() },
    },
  ],
});

/** Sanctum Conservator (RAD-030) — "When you play a card with Energy cost [7] or more, ready me." (420.4.a) */
registerCardScript({
  name: "Sanctum Conservator",
  text: "When you play a card with Energy cost [7] or more, ready me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: { type: "played", player: "self", subject: { energyCost: { op: "gte", value: 7 } } },
      },
      effect: { op: "ready", target: SELF },
    },
  ],
});

/**
 * Steadfast Outrider (RAD-128) — "[Tank] While there are 2 or more other friendly units and/or
 * gear at my battlefield, I have +2 [Might]."
 */
registerCardScript({
  name: "Steadfast Outrider",
  text: "[Tank] (I must be assigned combat damage first.)\nWhile there are 2 or more other friendly units and/or gear at my battlefield, I have +2 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: conditional(
        {
          kind: "and",
          conditions: [
            SELF_AT_BATTLEFIELD,
            {
              kind: "count",
              selector: {
                controller: "self",
                excludeSource: true,
                zone: HERE,
                where: UNIT_OR_GEAR,
              },
              comparison: { op: "gte", value: 2 },
            },
          ],
        },
        { kind: "might", amount: 2, target: SELF },
      ),
    },
  ],
});

/** Stoic Ferryman (RAD-031) — "[Shield 3] When you play me to a battlefield, you may move another unit you control here to your base." */
const PLAYED_TO_BATTLEFIELD = custom("event-zone-is", { battlefield: true });
registerCardScript({
  name: "Stoic Ferryman",
  text: "[Shield 3] (+3 [Might] while I'm a defender.)\nWhen you play me to a battlefield, you may move another unit you control here to your base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PLAYED_TO_BATTLEFIELD,
      effect: {
        op: "may",
        effect: {
          op: "move",
          target: aUnit({ controller: "self", excludeSource: true, zone: HERE }),
          to: "base",
        },
      },
    },
  ],
});

/**
 * Orianna, Exquisite (RAD-042) — "[Shield] I don't deal combat damage unless there's a friendly
 * gear here." A combat contribution filter (424.1.b / 467.2.a; registered with R2-combat).
 */
registerCardScript({
  name: "Orianna, Exquisite",
  text: "[Shield] (+1 [Might] while I'm a defender.)\nI don't deal combat damage unless there's a friendly gear here.",
  status: "implemented",
  abilities: [],
});

function friendlyGearAt(room: Room, host: RulesHost, unitId: string): boolean {
  const located = host.findCard(room, unitId);
  if (!located) return false;
  return host
    .zoneCards(room, located.playerId, located.zone)
    .some(
      (card) =>
        card.hidden !== true &&
        (host.cardInfo(room, card.id)?.type ?? "").toLowerCase().includes("gear"),
    );
}

registerCombatContributionFilter((room, unitId, host) => {
  if (host.findCard(room, unitId)?.card.name !== "Orianna, Exquisite") return true;
  return friendlyGearAt(room, host, unitId);
});

/** Elnuk Herd (RAD-081, errata) — "[Hidden] When you play me, give a friendly unit +3 [Might] this turn, then recycle me if I was played from face down." */
registerCardScript({
  name: "Elnuk Herd",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me, give a friendly unit +3 [Might] this turn, then recycle me if I was played from face down.",
  status: "partial",
  notes:
    '"Recycle me if I was played from face down": a unit\'s play effect cannot tell a facedown play (811.6; not recorded on unit_played).',
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "temporary_might", amount: 3, target: aUnit({ controller: "self" }) },
    },
  ],
});

/**
 * Clocktower Guardian (RAD-067) — "When you play me or when I hold, [Predict 3]. [Deathknell]
 * Banish the top card of your Main Deck. You may play it, ignoring its Energy cost."
 */
registerCardScript({
  name: "Clocktower Guardian",
  text: "When you play me or when I hold, [Predict 3].\n[Deathknell] Banish the top card of your Main Deck. You may play it, ignoring its Energy cost.",
  status: "partial",
  notes:
    "Deathknell: the top card is banished, but playing it ignoring only its Energy cost (356.1.b) opens the manual window (the play op ignores all or no costs).",
  abilities: [
    ...notIntrinsic("Predict"),
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "predict", amount: 3 } },
    { kind: "triggered", trigger: WHEN_I_HOLD, effect: { op: "predict", amount: 3 } },
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "look",
        amount: 1,
        then: {
          op: "seq",
          effects: [
            { op: "banish", target: { targetRef: "looked" } },
            { op: "custom", id: "manual" },
          ],
        },
      },
    },
  ],
});

/**
 * Transpositionist (RAD-115) — "[Chaos], [Tap]: Return a friendly unit to its owner's hand. You may
 * play a unit with less Might than that unit had, ignoring its cost." (359.3.e.13 "had")
 */
registerCardScript({
  name: "Transpositionist",
  text: "[Chaos], [Tap]: Return a friendly unit to its owner's hand. You may play a unit with less Might than that unit had, ignoring its cost.",
  status: "partial",
  notes: `The optional play is automated, but ${PLAY_OP_NOTE}.`,
  abilities: [
    {
      kind: "activated",
      cost: { power: { Chaos: 1 }, exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          { op: "return_to_hand", target: aUnit({ controller: "self", targetRef: "target:0" }) },
          letX(
            { lkiMightOf: "target:0" },
            {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "picked",
                  selector: {
                    zone: "hand",
                    controller: "self",
                    cardType: "unit",
                    might: { op: "lt", value: { kind: "x" } },
                  },
                  min: 0,
                  max: 1,
                },
                { op: "play", target: { targetRef: "picked" }, cost: "ignored" },
              ],
            },
          ),
        ],
      },
    },
  ],
});

/**
 * Trifarian Captain (RAD-129) — "When you play me, look at the top 4 cards of your Main Deck. You
 * may reveal from among them a unit or gear with Energy cost no more than [3] and with Power cost
 * no more than [Rune] and draw it. Recycle the rest."
 */
const LOOKED = custom("in-ref", { ref: "looked" });
registerCardScript({
  name: "Trifarian Captain",
  text: "When you play me, look at the top 4 cards of your Main Deck. You may reveal from among them a unit or gear with Energy cost no more than [3] and with Power cost no more than [Rune] and draw it. Recycle the rest.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "look",
        amount: 4,
        then: {
          op: "seq",
          effects: [
            {
              op: "choose",
              key: "picked",
              selector: {
                zone: "deck",
                controller: "self",
                energyCost: { op: "lte", value: 3 },
                powerCost: { op: "lte", value: 1 },
                where: { kind: "and", conditions: [LOOKED, custom("rad:unit-or-gear")] },
              },
              min: 0,
              max: 1,
            },
            { op: "reveal", target: { targetRef: "picked" } },
            drawCard("picked"),
            {
              op: "recycle",
              target: { zone: "deck", controller: "self", where: LOOKED, excludeRefs: ["picked"] },
            },
          ],
        },
      },
    },
  ],
});

/**
 * Drakehound Packmaster (RAD-018) — "When you play me, reveal the top card of each opponent's Main
 * Deck. Choose one and banish it, then play it, ignoring its cost. Recycle the rest."
 */
const REVEALED = custom("in-ref", { ref: "revealed" });
registerCardScript({
  name: "Drakehound Packmaster",
  text: "When you play me, reveal the top card of each opponent's Main Deck. Choose one and banish it, then play it, ignoring its cost. Recycle the rest.",
  status: "partial",
  notes: `The banished card is played, but ${PLAY_OP_NOTE}.`,
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          {
            op: "custom",
            id: "rad:reveal-top-each",
            params: { player: "opponent", key: "revealed" },
          },
          {
            op: "choose",
            key: "picked",
            selector: { zone: "deck", controller: "opponent", where: REVEALED },
          },
          { op: "banish", target: { targetRef: "picked" } },
          { op: "play", target: { targetRef: "picked" }, cost: "ignored" },
          {
            op: "recycle",
            target: {
              zone: "deck",
              controller: "opponent",
              where: REVEALED,
              excludeRefs: ["picked"],
            },
          },
        ],
      },
    },
  ],
});
