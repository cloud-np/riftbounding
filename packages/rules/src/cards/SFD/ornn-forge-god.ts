/** Ornn, Forge God. */
import { registerCardScript, SELF } from "../sdk";
import { countOf } from "./custom";

registerCardScript({
  name: "Ornn, Forge God",
  text: "[Deflect 2] (Opponents must pay [Rune][Rune] to choose me with a spell or ability.)\n[Weaponmaster] (When you play me, you may [Equip] one of your Equipment to me for [Rune] less, even if it's already attached.)\nI have +1 [Might] for each friendly gear.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: countOf({ cardType: "gear", controller: "self" }),
        target: SELF,
      },
    },
  ],
});
