/** Downstage Dramatics (UNL-061) — [Reaction] (813), [Repeat 2] (820.1.d: draw again when paid). Draw 1. */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Downstage Dramatics",
  text: "[reaction] (Play any time, even before spells and abilities resolve.)\n[repeat 2] (You may pay the additional cost to repeat this spell's effect.)\nDraw 1.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "draw", amount: 1 } }],
});
