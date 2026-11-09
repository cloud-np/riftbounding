/**
 * Unleashed spells (wave R3, batch 6):
 *
 * - Square Up (UNL-?): [Repeat] Discard 1 (820); give a unit [Assault 4] this turn (801.3.a).
 * - Existential Dread: [Action], [Repeat][2]; [Stun] an attacking unit, or return it to its
 *   owner's hand instead if it is already stunned (424, 056).
 * - Skyward Strike: move an enemy unit (destination chosen on play, 355.4); [Level 6] stun an
 *   enemy unit (824, checked on resolution 727.1.b).
 * - Deadly Flourish: deal 3 to an enemy unit; "when it dies this turn" is a delayed trigger bound
 *   to the chosen unit (390–393, 359.3.f.3.a) that plays an exhausted Gold gear token (187.5).
 * - Sacrifice: as an additional cost kill a friendly [Mighty] unit (356.2.a.1); draw 2 and channel
 *   1 rune exhausted.
 * - Thrill of the Hunt: banish a friendly unit, then its owner plays it to any battlefield
 *   ignoring its cost (420.3.b).
 * - Smoke and Mirrors: [Hidden]; choose two of your units at different locations; if one has
 *   [Temporary], they swap locations (434.1); draw 1.
 */
import { registerCardScript } from "../registry";
import { aUnit, custom, token } from "../dsl";
import { ifRepeat } from "./dsl-unl";
import type { Effect } from "@rift/protocol";
import { registerAdditionalCosts } from "../../play/additional-costs";

// The catalog text "[Repeat] - Discard 1" has a dash the Repeat cost parser (cost-text.ts) does not
// accept, which would make the Repeat cost unpayable; register the cost it spells out (820.1.c).
registerAdditionalCosts("Square Up", [
  { id: "repeat", optional: true, cost: { discard: 1 }, rule: "820.1.c", label: "Repeat" },
]);
// "kill a friendly [Mighty] unit" is not understood by the text parser (356.2.a.1).
registerAdditionalCosts("Sacrifice", [
  {
    id: "mandatory:0",
    optional: false,
    cost: { kill: { cardType: "unit", controller: "self", mighty: true } },
    rule: "356.2.a.1",
    label: "kill a friendly Mighty unit",
  },
]);

const REPEAT_NOTE =
  "The repeated execution's target (`target:1`) is offered as 'up to one': the choice walker cannot make a choice required only when the optional Repeat cost is paid (820.2, 355.7), so a player who paid Repeat may skip the second target.";

registerCardScript({
  name: "Square Up",
  text: "[Repeat] - Discard 1 (You may pay the additional cost to repeat this spell's effect.)\nGive a unit [Assault 4] this turn (+4[Might] while it's an attacker.)",
  status: "partial",
  notes: REPEAT_NOTE,
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "grant_keyword",
            keyword: "Assault 4",
            target: aUnit({ targetRef: "target:0" }),
            duration: "this-turn",
          },
          ifRepeat({
            op: "grant_keyword",
            keyword: "Assault 4",
            target: aUnit({ targetRef: "target:1", maxCount: 1 }),
            duration: "this-turn",
          }),
        ],
      },
    },
  ],
});

/** "[Stun] an attacking unit. If it's already stunned, return it to its owner's hand instead." */
function dread(key: string): Effect {
  const attacker = aUnit({
    targetRef: key,
    where: custom("unl:is-attacking"),
    ...(key === "target:0" ? {} : { maxCount: 1 }),
  });
  return {
    op: "if",
    condition: { kind: "exists", selector: { targetRef: key, stunned: true } },
    then: { op: "return_to_hand", target: { targetRef: key } },
    else: { op: "stun", target: attacker },
  };
}

registerCardScript({
  name: "Existential Dread",
  text: "[Action] (Play on your turn or in showdowns.)\n[Repeat][2] (You may pay the additional cost to repeat this spell's effect.)\n[Stun] an attacking unit. If it's already stunned, return it to its owner's hand instead. (A stunned unit doesn't deal combat damage this turn.)",
  status: "partial",
  notes: REPEAT_NOTE,
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "if",
            condition: { kind: "exists", selector: { targetRef: "target:0", stunned: true } },
            then: { op: "return_to_hand", target: { targetRef: "target:0" } },
            else: {
              op: "stun",
              target: aUnit({ targetRef: "target:0", where: custom("unl:is-attacking") }),
            },
          },
          ifRepeat(dread("target:1")),
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Skyward Strike",
  text: "Move an enemy unit.\n[Level 6] [Stun] an enemy unit. (While you have 6+ XP, get the effect. A stunned unit doesn't deal combat damage this turn.)",
  status: "partial",
  notes:
    "The [Level 6] stun target is chosen on play as 'up to one' enemy unit: the choice walker collects both branches of a Level-gated instruction, so it cannot require the choice only while you have 6+ XP (824, 355.7).",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "move",
            target: aUnit({ controller: "opponent", targetRef: "target:0" }),
            to: { kind: "chosen", ref: "destination" },
          },
          {
            op: "if",
            condition: custom("xp-at-least", { n: 6 }),
            then: {
              op: "stun",
              target: aUnit({ controller: "opponent", targetRef: "target:1", maxCount: 1 }),
            },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Deadly Flourish",
  text: 'Deal 3 to an enemy unit. When it dies this turn, play a Gold gear token exhausted.\n(It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    // The catalog's [Reaction]/[Add] are the Gold token's reminder text (135.2.d.3), not the spell's.
    { kind: "keyword", keyword: "Reaction", value: 0 },
    { kind: "keyword", keyword: "Add", value: 0 },
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "deal",
            amount: 3,
            target: aUnit({ controller: "opponent", targetRef: "target:0" }),
          },
          {
            op: "delayed",
            trigger: {
              kind: "event",
              event: { type: "die", subject: { targetRef: "target:0" } },
            },
            effect: { op: "create", token: token("Gold", { exhausted: true, play: true }) },
            duration: "this-turn",
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Sacrifice",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\nAs an additional cost to play this, kill a friendly [Mighty] unit. (A unit is Mighty while it has 5+[Might].)\nDraw 2 and channel 1 rune exhausted.",
  status: "partial",
  notes:
    "The kill cost is offered for any friendly unit: cost-object selectors (play/cost-objects.ts) do not filter by [Mighty] (Might 5+), so a non-Mighty unit can be killed to pay it (356.2.a.1, 357.2, 706).",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "draw", amount: 2 },
          { op: "channel", amount: 1, exhausted: true },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Thrill of the Hunt",
  text: "[Reaction] (Play any time, even before spells and abilities resolve.)\n\nBanish a friendly unit, then its owner plays it to any battlefield, ignoring the cost.",
  status: "partial",
  notes:
    "The limited play (420.3) can only enter a battlefield where its controller still has units: the play op does not mark the location as validated, so otherwise the unit is put at its owner's base instead of 'any battlefield' (355.2.b, 359.2.c; see the [BUG] reproduction).",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "banish", target: aUnit({ controller: "self", targetRef: "target:0" }) },
          {
            op: "play",
            target: { targetRef: "target:0" },
            cost: "ignored",
            location: { kind: "chosen", ref: "destination" },
          },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Smoke and Mirrors",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Action] (Play on your turn or in showdowns.)\nChoose a unit you control and another unit you control at a different location. If at least one of them has [Temporary], move each to the other's location. Draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "if",
            condition: {
              kind: "or",
              conditions: [
                { kind: "has-keyword", selector: { targetRef: "target:0" }, keyword: "Temporary" },
                { kind: "has-keyword", selector: { targetRef: "target:1" }, keyword: "Temporary" },
              ],
            },
            then: {
              op: "swap",
              a: aUnit({ controller: "self", targetRef: "target:0" }),
              b: aUnit({
                controller: "self",
                targetRef: "target:1",
                excludeRefs: ["target:0"],
                where: custom("unl:at-different-location", { ref: "target:0" }),
              }),
              property: "zone",
            },
          },
          { op: "draw", amount: 1 },
        ],
      },
    },
  ],
});

registerCardScript({
  name: "Call to Battle",
  text: "Move a unit you control to a battlefield you control. Then, choose an opponent. They move a unit they control to the same battlefield.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: {
          chosen: true,
          cardType: "battlefield",
          targetRef: "battlefield",
          where: custom("unl:battlefield-controlled-by-team"),
        },
        effect: {
          op: "seq",
          effects: [
            {
              op: "move",
              target: aUnit({ controller: "self", targetRef: "target:0" }),
              to: { kind: "chosen", ref: "battlefield" },
            },
            {
              op: "choose",
              key: "theirs",
              selector: { cardType: "unit", controller: "opponent" },
              min: 1,
              max: 1,
              chooser: "opponent",
            },
            {
              op: "move",
              target: { targetRef: "theirs" },
              to: { kind: "chosen", ref: "battlefield" },
            },
          ],
        },
      },
    },
  ],
});

registerCardScript({
  name: "Death from Below",
  text: "Card Errata Text - From Unleashed Card Errata:\nKill a unit at a battlefield. Then, if it had 3 [Might] or less, do this: You may play this from your trash for [Rune].",
  status: "partial",
  notes:
    "'You may play this from your trash for [Rune]' is not automated: there is no permission to play a spell from the Trash for a stated cost (420.3, 354); only the kill is.",
  abilities: [{ kind: "spell", effect: { op: "kill", target: aUnit({ zone: "battlefield" }) } }],
});

registerCardScript({
  name: "Dancing Grenade",
  text: "Deal 2 to a unit. Its controller may play this spell again for [Rune]. If they do, this deals 1 additional Bonus Damage for each time this spell has dealt damage this turn.",
  status: "partial",
  notes:
    "'Its controller may play this spell again for [Rune]' (an opponent playing this card from its Trash, with escalating Bonus Damage) is not automated (420.3, 354, 712); only the first 2 damage is.",
  abilities: [{ kind: "spell", effect: { op: "deal", amount: 2, target: aUnit() } }],
});
