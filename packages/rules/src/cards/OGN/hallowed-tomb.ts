/**
 * Hallowed Tomb (OGN-281, battlefield) — "When you hold here, you may return your Chosen Champion
 * from your trash to your Champion Zone if it is empty." (383.4.d.2.b; 403.1 "you may")
 * The Chosen Champion is the card set aside as such (`source: "champion"`, 103.2); the "if it is
 * empty" check is made on resolution.
 */
import { registerCardScript, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "Hallowed Tomb",
  text: "When you hold here, you may return your Chosen Champion from your trash to your Champion Zone if it is empty.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      optional: true,
      effect: { op: "custom", id: "ogn:return-chosen-champion" },
    },
  ],
});
