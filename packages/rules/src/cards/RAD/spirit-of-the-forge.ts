/** Spirit of the Forge (RAD-066) — optional "return a gear" additional cost and its payoff. */
import { registerCardScript } from "../sdk";
import { DEFLECT_GAP } from "./custom";

registerCardScript({
  name: "Spirit of the Forge",
  text: "You may return a friendly gear to its owner's hand as an additional cost to play me.\nWhen you play me, if you paid the additional cost, ready me and give me +[Might] this turn equal to the Energy cost of the gear you returned.",
  status: "partial",
  notes: DEFLECT_GAP,
  abilities: [],
});
