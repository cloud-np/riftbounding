/** Plaza Guardian. */
import { registerCardScript, SELF } from "../sdk";
import { perCount } from "./custom";

registerCardScript({
  name: "Plaza Guardian",
  text: "I cost [1] less for each gear you control.\n[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)",
  status: "implemented",
  abilities: perCount({ cardType: "gear", controller: "self" }, 10, () => ({
    kind: "cost",
    amount: -1,
    target: SELF,
  })),
});
