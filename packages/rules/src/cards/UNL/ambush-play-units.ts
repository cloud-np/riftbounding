/**
 * Unleashed [Ambush] units with play effects (822, engine keyword; the catalog's [Reaction] is
 * Ambush reminder text and is suppressed; keywords granted to others are not the unit's own):
 *
 * - Lord Broadmane (UNL-012): give your other units here [Assault] this turn.
 * - Chakram Dancer (UNL-071): give your other units here [Shield] this turn.
 * - Grim Apothecary (UNL-021): you may return a friendly unit at a battlefield to its owner's hand.
 */
import { registerCardScript } from "../registry";
import { HERE, WHEN_PLAYED, aUnit } from "../dsl";

const OTHER_FRIENDLY_HERE = {
  cardType: "unit",
  controller: "self",
  zone: HERE,
  excludeSource: true,
  all: true,
} as const;

registerCardScript({
  name: "Lord Broadmane",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen you play me, give your other units here [Assault] this turn. (+1 [Might] while they're attackers.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Assault" },
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "grant_keyword",
        keyword: "Assault",
        target: { ...OTHER_FRIENDLY_HERE },
        duration: "this-turn",
      },
    },
  ],
});

registerCardScript({
  name: "Chakram Dancer",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen you play me, give your other units here [Shield] this turn. (+1 [Might] while they're defenders.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    { kind: "suppress-printed-keyword", keyword: "Shield" },
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "grant_keyword",
        keyword: "Shield",
        target: { ...OTHER_FRIENDLY_HERE },
        duration: "this-turn",
      },
    },
  ],
});

registerCardScript({
  name: "Grim Apothecary",
  text: "[Ambush] (You may play me as a [Reaction] to a battlefield where you have units.)\nWhen you play me, you may return a friendly unit at a battlefield to its owner's hand.",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Reaction" },
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      optional: true,
      effect: { op: "return_to_hand", target: aUnit({ controller: "self", zone: "battlefield" }) },
    },
  ],
});
