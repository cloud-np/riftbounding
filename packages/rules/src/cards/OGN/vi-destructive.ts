/**
 * Vi, Destructive (OGN-036) — "[GANKING] Recycle 1 from your trash: Give me +1 [Might] this turn."
 *
 * [Ganking] (810) is printed. Partial: "Recycle 1 from your trash" (417.6) is not a payable
 * activation cost; it is kept as an unsupported phrase, so the ability is unpayable (203.3) rather
 * than free.
 */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Vi, Destructive",
  text: "[GANKING] (I can move from battlefield to battlefield.)\nRecycle 1 from your trash: Give me +1 [Might] this turn.",
  status: "partial",
  notes:
    "The activated ability's cost 'Recycle 1 from your trash' (417.6) is not payable, so it cannot be activated.",
  abilities: [
    {
      kind: "activated",
      cost: { additional: { "unsupported:Recycle 1 from your trash": true } },
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
  ],
});
