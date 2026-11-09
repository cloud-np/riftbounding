/**
 * Unleashed legends with plain abilities:
 *
 * - Poppy, Keeper of the Hammer (UNL-203): "When you hold, gain 1 XP." (383.4.d) and "Spend 3 XP,
 *   [Tap]: Draw 1." (377, 730.2).
 * - Rengar, Pridestalker (UNL-183): "When you play a unit, give a unit +1 [Might] this turn."
 *   (a played token unit counts, 440.2.c).
 * - Pyke, Bloodharbor Ripper (UNL-185): "[1], [Tap]: Return a friendly unit at a battlefield to its
 *   owner's hand. Play a Gold gear token exhausted." The catalog's [Reaction]/[Add] come from the
 *   Gold token's reminder text, not the legend (suppressed, 135.2.d.3).
 */
import { registerCardScript } from "../registry";
import { SELF, aUnit, token } from "../dsl";

registerCardScript({
  name: "Poppy, Keeper of the Hammer",
  text: "When you hold, gain 1 XP.\nSpend 3 XP, [Tap]: Draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hold", player: "self" } },
      effect: { op: "gain_xp", amount: 1 },
    },
    { kind: "activated", cost: { spendXp: 3, exhaust: SELF }, effect: { op: "draw", amount: 1 } },
  ],
});

registerCardScript({
  name: "Rengar, Pridestalker",
  text: "When you play a unit, give a unit +1 [might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "unit_played", player: "self" } },
      effect: { op: "temporary_might", amount: 1, target: aUnit() },
    },
  ],
});

registerCardScript({
  name: "Pyke, Bloodharbor Ripper",
  text: '[1], [Tap]: Return a friendly unit at a battlefield to its owner\'s hand. Play a Gold gear token exhausted. (It has "[Reaction] Kill this, [Tap]: [Add] [Rune].")',
  status: "implemented",
  abilities: [
    { kind: "keyword", keyword: "Reaction", value: 0 },
    { kind: "keyword", keyword: "Add", value: 0 },
    {
      kind: "activated",
      cost: { energy: 1, exhaust: SELF },
      effect: {
        op: "seq",
        effects: [
          { op: "return_to_hand", target: aUnit({ controller: "self", zone: "battlefield" }) },
          { op: "create", token: token("Gold", { exhausted: true, play: true }) },
        ],
      },
    },
  ],
});
