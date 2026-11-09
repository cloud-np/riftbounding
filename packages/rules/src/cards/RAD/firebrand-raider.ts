/** Firebrand Raider (RAD-019) — entry/ready hooks; the global lines need entry-for-all and an Awaken skip. */
import { registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Firebrand Raider",
  text: "I enter ready.\nWhen you play me, ready all enemy units.\nOther units enter ready.\nUnits don't ready during the Awaken Phase.",
  status: "partial",
  notes:
    "I enter ready and 'When you play me, ready all enemy units' are automated. 'Other units enter ready' cannot apply across controllers (the entry layer filters by the modifier's controller, 369.3) and 'Units don't ready during the Awaken Phase' needs a global ready skip (315.1, 444).",
  abilities: [
    { kind: "passive", modifier: { kind: "enter-ready", target: SELF } },
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "ready", target: { cardType: "unit", controller: "opponent" } },
    },
  ],
});
