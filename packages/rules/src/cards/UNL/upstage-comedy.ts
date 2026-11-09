/**
 * Upstage Comedy (UNL-009) — [Repeat 2] (820): "Ready a unit." A paid Repeat readies a second
 * unit; 820.2 binds the repeated execution's target as `repeat:1:target:0` on play.
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Upstage Comedy",
  text: "[Repeat 2] (You may pay the additional cost to repeat this spell's effect.)\nReady a unit.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "ready", target: aUnit() } }],
});
