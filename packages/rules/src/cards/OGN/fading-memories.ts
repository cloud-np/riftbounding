/**
 * Fading Memories (OGN-180) — "Give a unit at a battlefield or a gear [temporary]." (801.3.a;
 * Temporary 816.1.b.) The catalog's Temporary is the granted keyword, not the spell's own.
 */
import type { Condition } from "@rift/protocol";
import { registerCardScript } from "../sdk";

const UNIT_AT_BATTLEFIELD_OR_GEAR: Condition = {
  kind: "custom",
  id: "ogn:unit-at-battlefield-or-gear",
};

registerCardScript({
  name: "Fading Memories",
  text: "Give a unit at a battlefield or a gear [temporary]. (Kill it at the start of its controller's Beginning Phase, before.)",
  status: "implemented",
  abilities: [
    { kind: "suppress-printed-keyword", keyword: "Temporary" },
    {
      kind: "spell",
      effect: {
        op: "grant_keyword",
        keyword: "Temporary",
        target: { chosen: true, cardType: "permanent", where: UNIT_AT_BATTLEFIELD_OR_GEAR },
      },
    },
  ],
});
