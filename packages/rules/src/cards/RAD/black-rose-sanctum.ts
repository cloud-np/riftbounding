/** Black Rose Sanctum. */
import { custom, HERE, registerCardScript, token } from "../sdk";
import { oncePerPlayerPerTurn } from "./custom";

/**
 * Black Rose Sanctum (RAD-159) — "For each player, the first time each turn a non-token unit they
 * control dies here, they play a 1 [Might] Recruit unit token to their base."
 */
const SANCTUM = oncePerPlayerPerTurn("rad:black-rose:{self}", {
  op: "create",
  token: token("Recruit", { might: 1, play: true }),
  zone: "base",
});

registerCardScript({
  name: "Black Rose Sanctum",
  text: "For each player, the first time each turn a non-token unit they control dies here, they play a 1 [Might] Recruit unit token to their base.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: {
        kind: "event",
        event: {
          type: "die",
          zone: HERE,
          subject: { cardType: "unit" },
          condition: {
            kind: "and",
            conditions: [custom("rad:event-not-token"), SANCTUM.condition],
          },
        },
      },
      effect: SANCTUM.effect,
    },
  ],
});
