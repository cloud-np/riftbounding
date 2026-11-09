/** Square Up. */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Square Up",
  text: "[Repeat] - Discard 1 (You may pay the additional cost to repeat this spell's effect.)\nGive a unit [Assault 4] this turn (+4[Might] while it's an attacker.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "grant_keyword",
        keyword: "Assault",
        value: 4,
        target: aUnit(),
        duration: "this-turn",
      },
    },
  ],
});
