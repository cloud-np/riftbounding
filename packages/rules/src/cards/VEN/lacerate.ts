/**
 * Lacerate (VEN-127) — "Choose a unit. If it's [Empowered], disempower it. Then kill it if it has
 * 3 [Might] or less. [Flow][4][Order][Order]"
 *
 * 443 disempower; both conditions are checked on resolution, in order (359.3.f.2).
 */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";


registerCardScript({
  name: "Lacerate",
  text: "Choose a unit. If it's [Empowered], disempower it. Then kill it if it has 3 [Might] or less.\n[Flow][4][Order][Order] (You may play this from your trash for its Flow cost. Then banish it.)",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "seq",
        effects: [
          {
            op: "if",
            condition: { kind: "exists", selector: { targetRef: "target:0", empowered: true } },
            then: { op: "disempower", target: aUnit({ targetRef: "target:0" }) },
          },
          {
            op: "if",
            condition: {
              kind: "exists",
              selector: { targetRef: "target:0", might: { op: "lte", value: 3 } },
            },
            then: { op: "kill", target: { targetRef: "target:0" } },
          },
        ],
      },
    },
  ],
});
