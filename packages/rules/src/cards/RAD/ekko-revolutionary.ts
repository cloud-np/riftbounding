/**
 * Ekko, Revolutionary (RAD-021) — "I enter ready. [Assault] [Action] Discard 1, [1] [Fury]: Banish
 * me, then play me to your base, ignoring my cost." (428, 420.3)
 */
import { ENTER_READY, notIntrinsic, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Ekko, Revolutionary",
  text: "I enter ready.\n[Assault] (+1 [Might] while I'm an attacker.)\n[Action] Discard 1, [1] [Fury]: Banish me, then play me to your base, ignoring my cost.",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Action"),
    ENTER_READY,
    {
      kind: "activated",
      cost: { discard: 1, energy: 1, power: { Fury: 1 } },
      keywords: ["action"],
      effect: {
        op: "seq",
        effects: [
          { op: "banish", target: SELF },
          { op: "play", target: { targetRef: "self" }, cost: "ignored", location: "base" },
        ],
      },
    },
  ],
});
