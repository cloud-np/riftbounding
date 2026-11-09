/** Baccai Reaper. */
import { notIntrinsic, registerCardScript, SELF, WHEN_I_ATTACK } from "../sdk";

registerCardScript({
  name: "Baccai Reaper",
  text: "When I attack, you may pay [Fury] to give me [Assault 2] this turn. (+2 [Might] while I'm an attacker.)",
  status: "implemented",
  abilities: [
    // The catalog's Assault is only granted by the trigger (727.1.b).
    ...notIntrinsic("Assault"),
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      // 740.4.a.2 / 383.3.b: a leading cost within instructions, paid when the trigger finalizes.
      effect: {
        op: "cost_then",
        optional: true,
        cost: { power: { Fury: 1 } },
        effect: {
          op: "grant_keyword",
          keyword: "Assault",
          value: 2,
          target: SELF,
          duration: "this-turn",
        },
      },
    },
  ],
});
