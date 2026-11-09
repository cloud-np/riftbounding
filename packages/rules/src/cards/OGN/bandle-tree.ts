/**
 * Bandle Tree (OGN-278, battlefield) — "You may hide an additional card here."
 *
 * 107.3.b.1: the battlefield's `hide-limit` modifier raises its Facedown Zone's maximum occupancy
 * by one; the hide legality (`play/hidden.ts` `facedownCapacity`) reads it.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Bandle Tree",
  text: "You may hide an additional card here.",
  status: "implemented",
  abilities: [{ kind: "passive", modifier: { kind: "hide-limit", amount: 1 } }],
});
