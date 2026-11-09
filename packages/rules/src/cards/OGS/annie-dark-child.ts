/** Annie, Dark Child (OGS-017, legend, Origins errata) — "At the end of your turn, ready up to 2 runes." (317.1; any runes: the text does not say "friendly") */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Annie, Dark Child",
  text: "At the end of your turn, ready up to 2 runes.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "turn-end" },
      effect: { op: "ready", target: { chosen: true, cardType: "rune", maxCount: 2 } },
    },
  ],
});
