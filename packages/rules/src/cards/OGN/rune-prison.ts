/** Rune Prison (OGN-050) — "[Action] Stun a unit." (424) */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Rune Prison",
  text: "[Action] (Play on your turn or in showdowns.)\nStun a unit. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "stun", target: aUnit() } }],
});
