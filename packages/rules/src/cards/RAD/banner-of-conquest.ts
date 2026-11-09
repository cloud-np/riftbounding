/** Banner of Conquest (RAD-002) — "[Deploy] Friendly units here have [Assault]." (807, 801.3) */
import { notIntrinsic, registerCardScript } from "../sdk";
import { FRIENDLY_UNITS_HERE } from "./custom";

registerCardScript({
  name: "Banner of Conquest",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nFriendly units here have [Assault]. (+1 [Might] while they're attackers.)",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Assault"),
    {
      kind: "passive",
      modifier: { kind: "keyword", keyword: "Assault", target: FRIENDLY_UNITS_HERE },
    },
  ],
});
