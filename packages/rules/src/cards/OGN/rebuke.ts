/** Rebuke (OGN-172) — "[ACTION] Return a unit at a battlefield to its owner's hand." */
import { registerCardScript } from "../registry";
import { aUnit } from "../dsl";

registerCardScript({
  name: "Rebuke",
  text: "[ACTION] Return a unit at a battlefield to its owner's hand.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "return_to_hand", target: aUnit({ zone: "battlefield" }) } }],
});
