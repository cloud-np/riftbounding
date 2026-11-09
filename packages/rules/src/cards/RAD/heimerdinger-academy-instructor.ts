/** Heimerdinger, Academy Instructor (RAD-132) — replaces a played unit token with a Mech token. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Heimerdinger, Academy Instructor",
  text: "If you would play a unit token to a location while I'm at a battlefield, you may play a 3 [Might] Mech unit token to that same location instead.",
  status: "manual",
  notes:
    "Needs an optional replacement of a token play that keeps the proposed location and token-ness (370–375: optional replacements are only decided for kill/damage/recall, and the token proposal carries only its name/zone).",
  abilities: [],
});
