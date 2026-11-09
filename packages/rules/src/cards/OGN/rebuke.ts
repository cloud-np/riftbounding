/** Rebuke (OGN-172) — "[ACTION] Return a unit at a battlefield to its owner's hand." */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Rebuke",
  text: "[ACTION] Return a unit at a battlefield to its owner's hand.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "return_to_hand", target: aUnit({ zone: "battlefield" }) } }],
});
