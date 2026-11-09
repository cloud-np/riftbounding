/** Sona, Harmonious (OGN-073 (Origins errata) — EX[158] (383.2.a.1)) */
import { registerCardScript, SELF_AT_BATTLEFIELD } from "../sdk";

registerCardScript({
  name: "Sona, Harmonious",
  text: "At the end of your turn, if I'm at a battlefield, ready up to 4\nfriendly runes.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "turn-end" },
      condition: SELF_AT_BATTLEFIELD,
      effect: { op: "ready", target: { chosen: true, cardType: "rune", controller: "self", maxCount: 4 } },
    },
  ],
});
