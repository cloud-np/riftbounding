/** Cithria of Cloudfield (OGN-139) — "When you play another unit, buff me." (420.4.a; 440.2.c tokens count) */
import { registerCardScript } from "../registry";
import { SELF } from "../dsl";

registerCardScript({
  name: "Cithria of Cloudfield",
  text: "When you play another unit, buff me. (If I don't have a buff, I get a +1 [Might] buff.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "unit_played",
          player: "self",
          subject: { cardType: "unit", excludeSource: true },
        },
      },
      effect: { op: "buff", target: SELF },
    },
  ],
});
