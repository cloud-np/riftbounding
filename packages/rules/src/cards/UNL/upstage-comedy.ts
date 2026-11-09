/**
 * Upstage Comedy (UNL-009) — [Repeat 2] (820): "Ready a unit." A paid Repeat readies a second
 * chosen unit (820.2: the repeated execution's target is chosen on play, `target:1`).
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";
import { ifRepeat } from "./dsl-unl";

registerCardScript({
  name: "Upstage Comedy",
  text: "[Repeat 2] (You may pay the additional cost to repeat this spell's effect.)\nReady a unit.",
  status: "partial",
  notes:
    "The repeated execution's target (`target:1`) is offered as 'up to one': the choice walker cannot make a choice required only when the optional Repeat cost is paid (820.2, 355.7), so a player who paid Repeat may skip the second target.",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: aUnit({ targetRef: "target:0" }) },
          ifRepeat({ op: "ready", target: aUnit({ targetRef: "target:1", maxCount: 1 }) }),
        ],
      },
    },
  ],
});
