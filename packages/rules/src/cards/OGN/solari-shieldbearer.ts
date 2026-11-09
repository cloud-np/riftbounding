/** Solari Shieldbearer (OGN-051) — "When you play me, stun a unit." (424, 403.2) */
import { aUnit, registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Solari Shieldbearer",
  text: "When you play me, stun a unit. (It doesn't deal combat damage this turn.)",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "stun", target: aUnit() } }],
});
