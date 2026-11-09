/** Wrath of the Freljord (RAD-077) — "I enter ready. [Shield 3]" (369.3, 814). */
import { ENTER_READY, registerCardScript } from "../sdk";

registerCardScript({
  name: "Wrath of the Freljord",
  text: "I enter ready.\n[Shield 3] (+3 [Might] while I'm a defender.)",
  status: "implemented",
  abilities: [ENTER_READY],
});
