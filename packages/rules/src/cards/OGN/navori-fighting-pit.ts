/** Navori Fighting Pit (OGN-283, battlefield) — "When you hold here, buff a unit here." (383.4.d.2.b; 427) */
import { aUnit, HERE, registerCardScript, WHEN_YOU_HOLD_HERE } from "../sdk";

registerCardScript({
  name: "Navori Fighting Pit",
  text: "When you hold here, buff a unit here. (If it doesn't have a buff, it gets a +1 [Might] buff.)",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_YOU_HOLD_HERE,
      effect: { op: "buff", target: aUnit({ zone: HERE }) },
    },
  ],
});
