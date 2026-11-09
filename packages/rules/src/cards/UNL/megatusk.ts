/**
 * Megatusk (UNL-126) — "Spend 3 XP: Give your units here [Ganking] this turn." (377; 801.3.a;
 * "here" = my location, 359.3.f). The catalog's [Ganking] comes from this granted text, not a
 * printed keyword of mine (135.2.d.3), so it is suppressed.
 */
import { registerCardScript } from "../registry";
import { HERE } from "../dsl";

registerCardScript({
  name: "Megatusk",
  text: "Spend 3 XP: Give your units here [ganking] this turn. (We can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Ganking" },
    {
      kind: "activated",
      cost: { spendXp: 3 },
      effect: {
        op: "grant_keyword",
        keyword: "Ganking",
        target: { cardType: "unit", controller: "self", zone: HERE, all: true },
        duration: "this-turn",
      },
    },
  ],
});
