/** Hidden Blade (OGN-213 — EX[110]/EX[111]/EX[112] (359.3.e.14). [Hidden] (811) is R2-play's.) */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Hidden Blade",
  text: "[HIDDEN] (Hide now for [Rune] to react with later for [0].)\n[ACTION] (Play on your turn or in showdowns.)\nKill a unit at a battlefield. Its controller draws 2.",
  status: "partial",
  notes: "Hidden (hide for [Rune], play from facedown for [0]) is R2-play's keyword.",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          { op: "kill", target: aUnit({ zone: "battlefield", targetRef: "target:0" }) },
          { op: "draw", amount: 2, player: { kind: "controller", of: { targetRef: "target:0" } } },
        ],
      },
    },
  ],
});
