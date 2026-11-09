/** Black Rose Dignitary (UNL-152) — [Assault] (807, engine keyword); [Deathknell] (808) channel 1 rune exhausted (431.2.a). */
import { registerCardScript, WHEN_I_DIE } from "../sdk";

registerCardScript({
  name: "Black Rose Dignitary",
  text: "[Assault] (+1 [Might] while I'm an attacker.)\n[Deathknell] Channel 1 rune exhausted. (When I die, get the effect.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      effect: { op: "channel", amount: 1, exhausted: true },
    },
  ],
});
