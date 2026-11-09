/**
 * Volibear, Furious (OGN-041) — "[DEFLECT 2] When I attack, deal 5 damage split among any number of
 * enemy units here."
 *
 * [Deflect 2] (809) is printed (the play layer charges it). Partial: dividing damage among any
 * number of targets (355.14 / 418.1.d) is not supported, so the attack trigger is not scripted.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Volibear, Furious",
  text: "[DEFLECT 2] (Opponents must pay [Rune][Rune] to choose me with a spell or effect.)\nWhen I attack, deal 5 damage split among any number of enemy units here.",
  status: "partial",
  notes:
    "The attack trigger is manual: damage split among any number of targets (355.14, 418.1.d) is not supported.",
  abilities: [],
});
