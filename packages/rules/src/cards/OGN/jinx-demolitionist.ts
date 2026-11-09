/** Jinx, Demolitionist (OGN-030) — [Accelerate] [Assault 2] (printed); "When you play me, discard 2." (423.1.a) */
import { registerCardScript, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Jinx, Demolitionist",
  text: "[ACCELERATE] (You may pay [1] [Fury] as an additional cost to have me enter ready.)\n[ASSAULT 2] (+2 [Might] while I'm an attacker.)\nWhen you play me, discard 2.",
  status: "implemented",
  abilities: [{ kind: "triggered", trigger: WHEN_PLAYED, effect: { op: "discard", amount: 2 } }],
});
