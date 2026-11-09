/**
 * Pit Crew (OGN-091) — "When you play a gear, ready me."
 *
 * 420.4.a: triggers when the gear has resolved (`gear_played`); a played gear token is a played
 * gear too (440.2.c, 185.2.a).
 */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Pit Crew",
  text: "When you play a gear, ready me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "gear_played", player: "self" } },
      effect: { op: "ready", target: SELF },
    },
  ],
});
