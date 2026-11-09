/**
 * Bandle Tree (OGN-278, battlefield) — "You may hide an additional card here."
 *
 * Hiding (422 / Hidden 811) is R2-play's; the battlefield exposes a `hide-limit` modifier
 * (+1 card here) for it to read.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Bandle Tree",
  text: "You may hide an additional card here.",
  status: "partial",
  notes: "Hidden/hide limits are R2-play's; they read the `hide-limit` modifier.",
  abilities: [{ kind: "passive", modifier: { kind: "custom", id: "hide-limit", params: { amount: 1 } } }],
});
