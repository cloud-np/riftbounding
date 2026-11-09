/**
 * Tideturner (OGN-199, Origins errata) — "[Hidden] When you play me, you may choose a unit you
 * control at another location. Move me to its location and it to my original location."
 *
 * [Hidden] (811) is the play layer's. 403.1: the "you may" is decided when the trigger finalizes,
 * then the unit (at a location other than mine) is chosen (403.2). The two moves (421) exchange the
 * locations (`swap` with `zone`).
 */
import { aUnit, HERE, not, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Tideturner",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me, you may choose a unit you control at another location. Move me to its location and it to my original location.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "unit_played", subject: SELF } },
      optional: true,
      effect: {
        op: "swap",
        property: "zone",
        a: SELF,
        b: aUnit({
          controller: "self",
          excludeSource: true,
          where: not({ kind: "exists", selector: { targetRef: "it", zone: HERE } }),
        }),
      },
    },
  ],
});
