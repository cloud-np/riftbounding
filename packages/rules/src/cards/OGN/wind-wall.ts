/** Wind Wall (OGN-064) — "[REACTION] Counter a spell." (426; a finalized spell on the chain, 355.9.a.2) */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Wind Wall",
  text: "[REACTION] (Play any time, even before spells and abilities resolve.)\nCounter a spell.",
  status: "implemented",
  abilities: [
    { kind: "spell", effect: { op: "counter", target: { chosen: true, cardType: "spell" } } },
  ],
});
