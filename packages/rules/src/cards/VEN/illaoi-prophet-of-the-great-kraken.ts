/** Illaoi, Prophet of the Great Kraken. */
import { registerCardScript, SELF, token, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Illaoi, Prophet of the Great Kraken",
  text: "When you play me or when I score, play a 1 [Might] Tentacle unit token from Bilgewater.\nI have +1 [Might] for each token unit you control.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "create", token: token("Tentacle", { might: 1, play: true }) },
    },
    {
      kind: "triggered",
      // 383.4.c / 383.4.d: I score when my controller conquers or holds with me there.
      trigger: { kind: "event", event: { type: ["conquer", "hold"], subject: SELF } },
      effect: { op: "create", token: token("Tentacle", { might: 1, play: true }) },
    },
    {
      kind: "passive",
      modifier: {
        kind: "might",
        amount: { kind: "count", selector: { cardType: "unit", controller: "self", token: true } },
        target: SELF,
      },
    },
  ],
});
