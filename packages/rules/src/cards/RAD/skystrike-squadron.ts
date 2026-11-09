/** Skystrike Squadron (RAD-075) — optional "return a gear" additional cost and its [2] discount. */
import { registerCardScript } from "../sdk";
import { DEFLECT_GAP } from "./custom";

registerCardScript({
  name: "Skystrike Squadron",
  text: "You may return a friendly gear to its owner's hand as an additional cost to play me. If you do, I cost [2] less.\n[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)",
  status: "partial",
  notes: DEFLECT_GAP,
  abilities: [],
});
