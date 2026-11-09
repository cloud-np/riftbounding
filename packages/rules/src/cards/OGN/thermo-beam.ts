/** Thermo Beam (OGN-022) — "[ACTION] Kill all gear." (429; every gear on the board, 355.5.a) */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Thermo Beam",
  text: "[ACTION] (Play on your turn or in showdowns.)\nKill all gear.",
  status: "implemented",
  abilities: [{ kind: "spell", effect: { op: "kill", target: { cardType: "gear", all: true } } }],
});
