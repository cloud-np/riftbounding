/**
 * Unleashed units (wave R3, batch 6). Engine keywords come from the printed text; keywords that
 * only appear in reminder text are suppressed with `{ kind: "keyword", keyword, value: 0 }`.
 *
 * - Vex, Mocking: when you stun an enemy unit at a battlefield, you may move me there.
 * - Red Brambleback: when I conquer, buff a friendly unit.
 * - Blue Sentinel: when I hold, add a Rune at the start of your next Main Phase (delayed).
 * - Iascylla: when I hold, at the start of your next Main Phase you may move an enemy unit here.
 * - Rift Herald: when I move to a battlefield, look at the top 3, may reveal a unit and draw it.
 * - Atakhan: when I attack, the defender kills one of their units here (chosen by the defender).
 * - Safety Inspector: when you play me, each player kills one of their units (you don't if you
 *   paid the additional cost).
 * - Crescent Guardian: optional additional cost [Chaos]; if paid I enter ready.
 * - Baron Nashor: can't be chosen by enemy spells and abilities; other friendly units +2 Might.
 * - Daisy!: enters ready; costs [1] less per Bird/Cat/Dog/Poro tag among your units; when I attack
 *   while your units have all four tags, stun an enemy unit here.
 * - Maduli the Gatekeeper: can't be readied; [Chaos]: move me to a weaker occupied battlefield.
 * - Hwei, Brooding Painter: when I move, draw 1 then discard 1, then act on the discarded type.
 * - Diana, Lunari: when a showdown begins here, may pay [1] to Predict, reveal the top card, draw
 *   it if it is a spell.
 * - Ivern, Friend to all: choose a pet tag, gain it; conquer/hold score with all four tags.
 * - Insightful Investigator: reveal an opponent's hand; may pay 2 XP to make them discard a
 *   card and draw 1.
 * - Ashe, Focused: reveal an opponent's hand, banish a card; return it when they hold.
 * - LeBlanc, Everywhere at Once: [Backline]; (Temporary effects not suppressed).
 */
import type { Condition, Modifier } from "@rift/protocol";
import { registerCardScript } from "../registry";
import { HERE, PAID_ADDITIONAL, SELF, WHEN_PLAYED, aUnit, custom, not } from "../dsl";
import { lookRevealDraw } from "./dsl-unl";

function whenever(condition: Condition, modifier: Modifier) {
  return {
    kind: "passive" as const,
    modifier: { kind: "custom" as const, id: "conditional", params: { condition, modifier } },
  };
}

const WHEN_I_HOLD = { kind: "event", event: { type: "hold", subject: SELF } } as const;
const WHEN_I_ATTACK = { kind: "event", event: { type: "attack", subject: SELF } } as const;
const ENEMY_HERE = aUnit({ controller: "opponent", zone: HERE });
const ENTER_READY: Modifier = { kind: "custom", id: "enter-ready", params: { target: SELF } };
const PETS = ["Bird", "Cat", "Dog", "Poro"];

registerCardScript({
  name: "Vex, Mocking",
  text: "[Shield] (+1 [Might] while I'm a defender.)\n[Tank] (I must be assigned combat damage first.)\nWhen you [Stun] an enemy unit at a battlefield, you may move me to that battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "stun",
          player: "self",
          condition: {
            kind: "exists",
            selector: { targetRef: "event", controller: "opponent", zone: "battlefield" },
          },
        },
      },
      optional: true,
      effect: { op: "custom", id: "unl:move-to-event-subject" },
    },
  ],
});

registerCardScript({
  name: "Red Brambleback",
  text: "[Accelerate] (You may pay [1][Fury] as an additional cost to have me enter ready.)\nYour conquer effects for conquering here trigger an additional time.\nWhen I conquer, [Buff] a friendly unit. (Give it a +1[Might] buff if it doesn't have one.)",
  status: "partial",
  notes:
    "'Your conquer effects for conquering here trigger an additional time' is not automated: the trigger detector has no way to make triggers fire an additional time (383.1.b, 383.4.c); only my own conquer Buff is.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      effect: { op: "buff", target: aUnit({ controller: "self" }) },
    },
  ],
});

registerCardScript({
  name: "Blue Sentinel",
  text: "[Shield 2] (+2 [Might] while I'm a defender.)\nYour hold effects for holding here trigger an additional time.\nWhen I hold, [Add] [Rune] at the start of your next Main Phase. (Abilities that add resources can't be reacted to.)",
  status: "partial",
  notes:
    "'Your hold effects for holding here trigger an additional time' is not automated: the trigger detector has no way to make triggers fire an additional time (383.1.b, 383.4.d); only my own delayed Add is.",
  abilities: [
    { kind: "keyword", keyword: "Add", value: 0 },
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      effect: {
        op: "delayed",
        trigger: { kind: "phase", phase: "main" },
        effect: { op: "add", resources: { power: { any: 1 } } },
        duration: "this-turn",
      },
    },
  ],
});

registerCardScript({
  name: "Iascylla",
  text: "When I hold, at the start of your next Main Phase, you may move an enemy unit to this battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_HOLD,
      effect: {
        op: "delayed",
        trigger: { kind: "phase", phase: "main" },
        effect: {
          op: "move",
          target: aUnit({ controller: "opponent" }),
          to: HERE,
        },
        optional: true,
        duration: "this-turn",
      },
    },
  ],
});

registerCardScript({
  name: "Rift Herald",
  text: "When I move to a battlefield, look at the top 3 cards of your Main Deck, You may reveal a unit from among them and draw it. Recycle the rest.\n[Deathknell] Play a unit from your hand to your base, ignoring its Energy cost (When I die, get the effect, You must still pay its Power cost.)",
  status: "partial",
  notes:
    "The [Deathknell] play is not automated: a limited play can ignore the whole cost or pay only Energy, but not 'ignore the Energy cost and still pay the Power cost' (420.3.b, 357).",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "move",
          subject: SELF,
          condition: custom("event-zone-is", { battlefield: true }),
        },
      },
      effect: lookRevealDraw(3, { cardType: "unit" }),
    },
  ],
});

registerCardScript({
  name: "Atakhan",
  text: "You may kill a friendly unit as an additional cost to play me. If you do, I cost [1] less for each Energy it costs and [order] less for each Power it costs.\n[ganking] (I can move from battlefield to battlefield.)\nWhen i attack, the defender must kill one of their units here.",
  status: "partial",
  notes:
    "The cost reduction for the killed unit's Energy and Power is not automated: the amount of a cost modifier cannot read the cost of an object paid as a cost (356.2.b.1, 357.2); only the optional kill cost and the attack trigger are.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "seq",
        effects: [
          {
            op: "choose",
            key: "victim",
            selector: { cardType: "unit", controller: "opponent", zone: HERE },
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

registerCardScript({
  name: "Safety Inspector",
  text: "You may spend 3 XP as an additional cost to play me.\nWhen you play me, each player must kill one of their units. If you paid my additional cost, you don't kill a unit this way.",
  status: "partial",
  notes:
    "'If you paid my additional cost' reads the engine's paid-additional-cost flag, which is also set by paying the ordinary cost with runes (356.4.f.1, [BUG] in bugs list): with rune payment you would never kill a unit.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          {
            op: "if",
            condition: not(PAID_ADDITIONAL),
            then: {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "mine",
                  selector: { cardType: "unit", controller: "self" },
                  min: 1,
                  max: 1,
                  chooser: "self",
                },
                { op: "kill", target: { targetRef: "mine" } },
              ],
            },
          },
          {
            op: "choose",
            key: "theirs",
            selector: { cardType: "unit", controller: "opponent" },
            min: 1,
            max: 1,
            chooser: "opponent",
          },
          { op: "kill", target: { targetRef: "theirs" } },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Crescent Guardian",
  text: "If you've played a spell this turn, you may pay [Chaos] as an additional cost to play me. If you do, I enter ready.",
  status: "partial",
  notes:
    "The additional cost [Chaos] is offered whether or not you have played a spell this turn (the 'if you've played a spell' gate on an optional cost is not expressible, 356.2.b.1), and 'if you do' reads the engine's paid-additional-cost flag, which is also set by rune payment (356.4.f.1, [BUG] in bugs list).",
  abilities: [whenever(PAID_ADDITIONAL, ENTER_READY)],
});

registerCardScript({
  name: "Baron Nashor",
  text: "As you play me, add the Baron Pit battlefield token to the board if it's not there already. If you do, I enter there. (It has \"Units can move here from anywhere\".)\nI can't be chosen by enemy spells and abilities.\nOther friendly units have +2 [Might].",
  status: "partial",
  notes:
    "'As you play me, add the Baron Pit battlefield token' is not automated: battlefield tokens (and entering there) have no engine support (103, 186).",
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "restriction", restriction: "be-targeted:enemy", target: SELF },
    },
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: 2,
        target: { cardType: "unit", controller: "self", excludeSource: true },
      },
    },
  ],
});

const DAISY_TAG = (tag: string): Condition => ({
  kind: "exists",
  selector: { cardType: "unit", controller: "self", tag },
});

registerCardScript({
  name: "Daisy!",
  text: "I enter ready.\nReduce my cost by for each of the following tags among your units — Bird, Cat, Dog, and Poro.\nWhen I attack while your units have all 4 tags, [Stun] an enemy unit here. (It doesn't deal combat damage this turn.)",
  status: "partial",
  notes:
    "The printed cost reduction has no amount or symbol ('Reduce my cost by for each …'); it is read as [1] Energy per tag (366.2.a). Otherwise automated.",
  abilities: [
    { kind: "passive", modifier: ENTER_READY },
    ...PETS.map((tag) => whenever(DAISY_TAG(tag), { kind: "cost", amount: -1, target: SELF })),
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "attack",
          subject: SELF,
          condition: custom("unl:units-have-all-tags", { tags: PETS }),
        },
      },
      effect: { op: "stun", target: ENEMY_HERE },
    },
  ],
});

registerCardScript({
  name: "Maduli the Gatekeeper",
  text: "I can't be readied.\n[chaos] : Move me to an occupied enemy battlefield if my Might is greater than the total Might of enemy units there.",
  status: "implemented",
  abilities: [
    { kind: "passive", modifier: { kind: "restriction", restriction: "ready", target: SELF } },
    {
      kind: "activated",
      cost: { power: { Chaos: 1 } },
      effect: {
        op: "for_each",
        selector: {
          chosen: true,
          cardType: "battlefield",
          targetRef: "battlefield",
          where: custom("unl:enemy-battlefield-weaker"),
        },
        effect: { op: "move", target: SELF, to: { kind: "chosen", ref: "battlefield" } },
      },
    },
  ],
});

registerCardScript({
  name: "Hwei, Brooding Painter",
  text: "When I move, draw 1, then discard 1. Then, do the following based on the discarded card's type:\n* Spell - Draw 1\n* Gear - Ready up to 2 runes\n* Unit - Give me +3 [Might] this turn",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "move", subject: SELF } },
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 1 },
          {
            op: "choose",
            key: "discarded",
            selector: { zone: "hand", controller: "self" },
            min: 1,
            max: 1,
            chooser: "self",
          },
          { op: "custom", id: "unl:discard-ref", params: { ref: "discarded" } },
          {
            op: "if",
            condition: { kind: "exists", selector: { targetRef: "discarded", cardType: "spell" } },
            then: { op: "draw", amount: 1 },
          },
          {
            op: "if",
            condition: { kind: "exists", selector: { targetRef: "discarded", cardType: "gear" } },
            then: {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "runes",
                  selector: { cardType: "rune", controller: "self", exhausted: true },
                  min: 0,
                  max: 2,
                  chooser: "self",
                },
                { op: "ready", target: { targetRef: "runes" } },
              ],
            },
          },
          {
            op: "if",
            condition: { kind: "exists", selector: { targetRef: "discarded", cardType: "unit" } },
            then: { op: "temporary_might", amount: 3, target: SELF },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Diana, Lunari",
  text: "Card Errata Text - From Vendetta Card Errata:\nWhen a showdown begins here, you may pay [1] to [Predict], then reveal the top card of your Main Deck. If it's a spell, draw it. (To Predict, look at the top card of your Main Deck. You may recycle it.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "showdown_begin", zone: HERE } },
      effect: {
        op: "cost_then",
        optional: true,
        cost: { energy: 1 },
        effect: {
          op: "seq",
          effects: [
            { op: "predict", amount: 1 },
            { op: "custom", id: "unl:reveal-top-draw-spell" },
          ],
        },
      },
    },
  ],
});

registerCardScript({
  name: "Ivern, Friend to all",
  text: "As you play me, choose Bird, Cat, Dog, or Poro.\nI gain that tag.\nWhen i conquer or hold, score 1 point if your units have all of the following tags among them - Bird, Cat, Dog, and Poro.",
  status: "partial",
  notes:
    "'As you play me, choose … I gain that tag' is a play-time replacement-like choice; it is made and applied as a 'when you play me' trigger instead, so I only have the tag once that trigger resolves (355.7, 143.1).",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "choose_mode",
        modes: PETS.map((tag) => ({
          id: tag.toLowerCase(),
          label: tag,
          effect: { op: "custom" as const, id: "unl:gain-tag", params: { tag } },
        })),
      },
    },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: ["conquer", "hold"], subject: SELF } },
      effect: {
        op: "if",
        condition: custom("unl:units-have-all-tags", { tags: PETS }),
        then: { op: "score_points", amount: 1 },
      },
    },
  ],
});

registerCardScript({
  name: "Insightful Investigator",
  text: "When you play me, choose an opponent. They reveal their hand. You may pay 2 XP to choose a card from their hand. If you do, they discard that card and draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "reveal", target: { zone: "hand", controller: "opponent", all: true } },
          {
            op: "cost_then",
            optional: true,
            cost: { spendXp: 2 },
            effect: {
              op: "seq",
              effects: [
                {
                  op: "choose",
                  key: "chosen-card",
                  selector: { zone: "hand", controller: "opponent" },
                  min: 1,
                  max: 1,
                  chooser: "self",
                },
                { op: "custom", id: "unl:discard-ref", params: { ref: "chosen-card" } },
                { op: "draw", amount: 1, player: "opponent" },
              ],
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Ashe, Focused",
  text: "When you play me, choose an opponent. They reveal their hand. Choose a card revealed this way and banish it. When they hold, return it to their hand (even if I'm no longer on the board).",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: [
          { op: "reveal", target: { zone: "hand", controller: "opponent", all: true } },
          {
            op: "choose",
            key: "banished",
            selector: { zone: "hand", controller: "opponent" },
            min: 1,
            max: 1,
            chooser: "self",
          },
          { op: "banish", target: { targetRef: "banished" } },
          {
            op: "delayed",
            trigger: { kind: "event", event: { type: "hold", player: "opponent" } },
            effect: { op: "return_to_hand", target: { targetRef: "banished" } },
            duration: "permanent",
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "LeBlanc, Everywhere at Once",
  text: "[Backline] (I must be assigned combat damage last.)\nYour [Temporary] effects at battlefields don't trigger.",
  status: "partial",
  notes:
    "'Your [Temporary] effects at battlefields don't trigger' is not automated: the engine has no way to stop a keyword trigger (Temporary, 816) from triggering (383.2, 054.1). The catalog's [Temporary] on this card is reminder text (suppressed).",
  abilities: [{ kind: "keyword", keyword: "Temporary", value: 0 }],
});

registerCardScript({
  name: "Katarina, Reckless",
  text: "When you hide a card, ready me.\nWhen you play a card from face down, deal 2 to an enemy unit.",
  status: "partial",
  notes:
    "'When you play a card from face down, deal 2 to an enemy unit' is not automated: a unit played from facedown resolves on finalization, so by the time triggers are detected its play (and whether it came from facedown, 811.1.b) is gone; only the hide trigger is.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hide", player: "self" } },
      effect: { op: "ready", target: SELF },
    },
  ],
});

const LOCATIONS = ["base", "battlefieldA", "battlefieldB", "battlefieldC"] as const;

registerCardScript({
  name: "Elder Dragon",
  text: "Any amount of your damage is enough to kill enemy units.\nWhen you play me, choose up to one enemy unit at each location. Deal 1 to them.",
  status: "partial",
  notes:
    "'Any amount of your damage is enough to kill enemy units' is not automated: lethal damage is always Might (142.4.b, 418.1) and there is no modifier lowering it; only the play trigger is.",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "seq",
        effects: LOCATIONS.map((zone) => ({
          op: "deal" as const,
          amount: 1,
          target: aUnit({ controller: "opponent", zone, maxCount: 1 }),
        })),
      },
    },
  ],
});

registerCardScript({
  name: "Yeti Brawler",
  text: 'When I conquer, if you assigned 3 or more excess damage, play two Gold gear tokens exhausted.\n(They have "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "manual",
  notes:
    "Not automated: excess damage assigned in combat is not recorded (467.2.c.4), so the conquer trigger's condition cannot be checked; it opens the manual window on every conquer. The catalog's [Reaction]/[Add] are the Gold token's reminder text (suppressed).",
  abilities: [
    { kind: "keyword", keyword: "Reaction", value: 0 },
    { kind: "keyword", keyword: "Add", value: 0 },
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "conquer", subject: SELF } },
      effect: { op: "custom", id: "manual" },
    },
  ],
});

registerCardScript({
  name: "Wily Newtfish",
  text: "If you've gained XP this turn, I have +1[Might] and [Ganking]. (I can move from battlefield to battlefield.)",
  status: "manual",
  notes:
    "Not automated: whether you gained XP this turn is not tracked (728–733); the +1 Might and [Ganking] are never applied. The catalog's [Ganking] is conditional text (suppressed), so the card is a vanilla 4 Might unit.",
  abilities: [{ kind: "keyword", keyword: "Ganking", value: 0 }],
});
