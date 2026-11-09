/** Ol' Poro. */
import { whilePassive as conditional, custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Ol' Poro",
  text: "I can't be played on your first, second or third turns.",
  status: "implemented",
  notes:
    "The self restriction (054.1) is read from this script by `restrictionFor` even while the card is in hand.",
  abilities: [
    conditional(custom("ven:poro-early-turns"), {
      kind: "restriction",
      restriction: "play",
      target: SELF,
    }),
  ],
});
