/** Portable Portal (RAD-087) — "[Deploy] When you play this, you may pay [Body] to ready a unit here. Friendly units here have [Ganking]." */
import { aUnit, HERE, notIntrinsic, registerCardScript, WHEN_PLAYED } from "../sdk";
import { FRIENDLY_UNITS_HERE } from "./custom";

registerCardScript({
  name: "Portable Portal",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you play this, you may pay [Body] to ready a unit here.\nFriendly units here have [Ganking]. (They can move from battlefield to battlefield.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Ganking"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: {
        op: "cost_then",
        cost: { power: { Body: 1 } },
        optional: true,
        effect: { op: "ready", target: aUnit({ zone: HERE }) },
      },
    },
    {
      kind: "passive",
      modifier: { kind: "keyword", keyword: "Ganking", target: FRIENDLY_UNITS_HERE },
    },
  ],
});
