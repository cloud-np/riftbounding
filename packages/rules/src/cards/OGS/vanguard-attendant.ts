/** Vanguard Attendant (OGS-016) — "I enter ready." (369.3: replaces entering exhausted; EX[134]) */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Vanguard Attendant",
  text: "I enter ready.",
  status: "implemented",
  abilities: [
    { kind: "passive", modifier: { kind: "custom", id: "enter-ready", params: { target: SELF } } },
  ],
});
