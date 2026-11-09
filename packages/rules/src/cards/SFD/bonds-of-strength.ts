/** Bonds of Strength. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Bonds of Strength",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\n[REPEAT][2] (You may pay the additional cost to repeat this spell's effect.)\nGive two friendly units each +1 [Might]",
  status: "manual",
  notes:
    'The catalog text omits the duration of "+1 [Might]" (no "this turn", no closing period), so the effect cannot be scripted faithfully; it resolves in the §6.4 manual window until the text is confirmed. Repeat (820.1.d) is also not executed by the engine.',
  abilities: [],
});
