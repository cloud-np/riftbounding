/** The Academy. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "The Academy",
  text: "When you hold here, give your next spell this turn [repeat] equal to its base cost. (You may pay the additional cost to repeat the spell's effect.)",
  status: "manual",
  notes:
    "Granting [Repeat] to the next spell (and deriving its cost from the spell's base cost) is not implemented (820, 420.5).",
  abilities: [],
});
