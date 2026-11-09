/** Production Surge. */
import { registerCardScript, SELF, whilePassive } from "../sdk";
import { mech } from "./custom";

registerCardScript({
  name: "Production Surge",
  text: "This costs [2] less if you control a Mech.\nPlay a 3 [Might] Mech unit token to your base.\nDraw 1.",
  status: "implemented",
  abilities: [
    whilePassive(
      { kind: "exists", selector: { cardType: "unit", controller: "self", tag: "Mech" } },
      { kind: "cost", amount: -2, target: SELF },
    ),
    { kind: "spell", effect: { op: "seq", effects: [mech(), { op: "draw", amount: 1 }] } },
  ],
});
