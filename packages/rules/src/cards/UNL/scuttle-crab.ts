/** Scuttle Crab. */
import { registerCardScript, WHEN_I_DIE, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Scuttle Crab",
  text: "(Units with 0 [might] can conquer and hold)\nWhen you play me draw 1.\n[Deathknell] Choose an opponent. They reveal their hand. You can look at their facedown cards this turn. Gain 1 XP. (When i die, get the effect.)",
  status: "partial",
  notes:
    "'You can look at their facedown cards this turn' (an information permission, 107.3.c) is not modelled; in 3+ player games every opponent reveals instead of one chosen opponent (the reveal op has no player choice, 355.7).",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "draw", amount: 1 } },
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: {
        op: "seq",
        effects: [
          { op: "reveal", target: { zone: "hand", controller: "opponent", all: true } },
          { op: "gain_xp", amount: 1 },
        ],
      },
    },
  ],
});
