/** Vanguard Attendant (OGS-016) — "I enter ready." (369.3: replaces entering exhausted; EX[134]) */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Vanguard Attendant",
  text: "I enter ready.",
  status: "implemented",
  abilities: [{ kind: "passive", modifier: { kind: "enter-ready", target: SELF } }],
});
