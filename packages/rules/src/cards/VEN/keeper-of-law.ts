/** Keeper of Law. */
import { whilePassive as conditional, custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Keeper of Law",
  text: "I cost [2][Order] less if you control a battlefield with exactly two units there.",
  status: "implemented",
  abilities: [
    conditional(custom("ven:control-battlefield-with-units", { count: 2 }), {
      kind: "cost-adjust",
      energy: -2,
      power: { Order: -1 },
      target: SELF,
    }),
  ],
});
