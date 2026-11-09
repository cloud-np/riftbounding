/** Tianna Crownguard. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Tianna Crownguard",
  text: "[Deflect] (Opponents must pay [Rune] to choose me with a spell or ability.)\nWhile I'm at a battlefield, opponents can't gain points.",
  status: "partial",
  notes:
    "\"While I'm at a battlefield, opponents can't gain points\": score restrictions are evaluated without a subject, so no passive restriction can match (470, restrictions.ts requires an object); only Deflect is automated.",
  abilities: [],
});
