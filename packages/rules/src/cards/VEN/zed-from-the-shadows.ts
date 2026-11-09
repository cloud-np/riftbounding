/** Zed, From the Shadows. */
import { notIntrinsic, PAID_ADDITIONAL, registerCardScript, token, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Zed, From the Shadows",
  text: 'You may discard 1 as an additional cost to play me.\nWhen you play me, if you paid the additional cost, play a 0 [Might] Shadow Clone unit token. (It has "When I attack, you may banish a unit from your trash. If you do, give me [Assault 4] this turn.")',
  status: "implemented",
  abilities: [
    // The catalog's Assault comes from the Shadow Clone's reminder text (135.2.d.3).
    ...notIntrinsic("Assault"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: { op: "create", token: token("Shadow Clone", { might: 0, play: true }) },
    },
  ],
});
