/**
 * Noxian Drummer (OGN-222) — "When I move to a battlefield, play a 1 [Might] Recruit unit token
 * here." "to a battlefield" is part of the trigger condition (383.2.a.1); 440.2.c.
 */
import { custom, HERE, registerCardScript, token, WHEN_I_MOVE } from "../sdk";

registerCardScript({
  name: "Noxian Drummer",
  text: "When I move to a battlefield, play a 1 [Might] Recruit unit token here. (It is also at the battlefield.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE,
      condition: { kind: "event-zone-is", battlefield: true },
      effect: { op: "create", token: token("Recruit", { might: 1, play: true }), zone: HERE },
    },
  ],
});
