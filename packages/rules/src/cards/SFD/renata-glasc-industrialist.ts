/** Renata Glasc, Industrialist. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Renata Glasc, Industrialist",
  text: "Your tokens enter ready.",
  status: "partial",
  notes:
    'Unit tokens you play enter ready (369.3); gear tokens played "exhausted" (e.g. Gold) still enter exhausted — the `create` op only applies enter-ready replacements to units.',
  abilities: [
    {
      kind: "passive",
      modifier: { kind: "enter-ready", target: { token: true, controller: "self" } },
    },
  ],
});
