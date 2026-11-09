/** Ahri, Alluring (OGN-066) — "When I hold, you score 1 point." (383.4.d; 470.2) */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Ahri, Alluring",
  text: "When I hold, you score 1 point.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "hold", subject: SELF } },
      effect: { op: "score_points", amount: 1 },
    },
  ],
});
