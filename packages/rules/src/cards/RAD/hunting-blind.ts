/**
 * Hunting Blind (RAD-044) — "[Deploy] When you play this, you may move an enemy unit to this
 * battlefield. Friendly units here have [Shield 2]."
 */
import { aUnit, HERE, notIntrinsic, registerCardScript, WHEN_PLAYED } from "../sdk";
import { FRIENDLY_UNITS_HERE } from "./custom";

registerCardScript({
  name: "Hunting Blind",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this, you may move an enemy unit to this battlefield.\nFriendly units here have [Shield 2]. (+2[Might] while they're defenders.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Shield"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "may",
        effect: { op: "move", target: aUnit({ controller: "opponent" }), to: HERE },
      },
    },
    {
      kind: "passive",
      modifier: { kind: "keyword", keyword: "Shield", value: 2, target: FRIENDLY_UNITS_HERE },
    },
  ],
});
