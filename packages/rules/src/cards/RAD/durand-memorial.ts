/** Durand Memorial (RAD-161) — "When you defend here, choose a unit you control here. Give it [Tank] this combat." (383.4.f, 815) */
import { aUnit, HERE, notIntrinsic, registerCardScript, WHEN_YOU_DEFEND_HERE } from "../sdk";

registerCardScript({
  name: "Durand Memorial",
  text: "When you defend here, choose a unit you control here. Give it [Tank] this combat. (It must be assigned combat damage first.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Tank"),
    {
      kind: "triggered",
      trigger: WHEN_YOU_DEFEND_HERE,
      effect: {
        op: "grant_keyword",
        keyword: "Tank",
        target: aUnit({ controller: "self", zone: HERE }),
        duration: "this-combat",
      },
    },
  ],
});
