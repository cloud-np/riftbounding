/** Concert Poster. */
import type { Effect } from "@rift/protocol";
import { registerCardScript, token, WHEN_PLAYED, WHEN_YOU_CONQUER_HERE } from "../sdk";

/**
 * Concert Poster (RAD-116) — "[Deploy] When you play this or when you conquer here, you may pay
 * [1] to play a 1 [Might] Recruit unit token to your base." (740.4.a cost within instructions)
 */
const POSTER_EFFECT: Effect = {
  op: "cost_then",
  cost: { energy: 1 },
  optional: true,
  effect: { op: "create", token: token("Recruit", { might: 1, play: true }), zone: "base" },
};

registerCardScript({
  name: "Concert Poster",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this or when you conquer here, you may pay [1] to play a 1 [Might] Recruit unit token to your base.",
  status: "implemented",
  abilities: [
    { kind: "triggered", trigger: WHEN_PLAYED, effect: POSTER_EFFECT },
    { kind: "triggered", trigger: WHEN_YOU_CONQUER_HERE, effect: POSTER_EFFECT },
  ],
});
