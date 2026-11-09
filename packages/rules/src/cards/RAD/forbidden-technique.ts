/**
 * Forbidden Technique (RAD-010, errata) — "Ready a unit. When you play a card with Energy cost
 * [7] or more, you may play this from your trash for [1][Fury][Fury]. Then banish this."
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Forbidden Technique",
  text: "Ready a unit.\nWhen you play a card with Energy cost [7] or more, you may play this from your trash for [1] [Fury] [Fury]. Then banish this.",
  status: "partial",
  notes:
    "The trash trigger (play this from your trash for [1][Fury][Fury], then banish it) needs triggered abilities of cards outside the board (385).",
  abilities: [{ kind: "spell", effect: { op: "ready", target: aUnit() } }],
});
