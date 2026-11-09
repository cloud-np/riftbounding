/** Ruined Rex (UNL-067) — [Deathknell] (808): deal 4 to an enemy unit (418; chosen when the trigger is finalized, 403.2). */
import { aUnit, registerCardScript, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Ruined Rex",
  text: "[Deathknell] Deal 4 to an enemy unit. (When I die, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: { op: "deal", amount: 4, target: aUnit({ controller: "opponent" }) },
    },
  ],
});
