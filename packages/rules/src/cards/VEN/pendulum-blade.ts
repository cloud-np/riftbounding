/** Pendulum Blade. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Pendulum Blade",
  text: "[Equip][Fury] ([Fury]: Attach this to a unit you control.)\nWhen I move to a battlefield, give me +2 [Might] this turn.\n+1 [Might]",
  status: "partial",
  notes:
    "'When I move to a battlefield, give me +2 [Might] this turn' is Effect Text whose triggered ability is appended to the equipped unit (718.3/719.1). Implementing it queues the move trigger before the combat Task; the existing Riven attack-trigger test (units-b.test.ts) reads the combat trigger synchronously after the move and must be updated first (test-edit scope).",
  abilities: [
    // TEMP-DEBUG: trigger removed
    // 718.4: Might Bonus, applied to the Top-Most card.
    { kind: "passive", modifier: { kind: "might", amount: 1, target: { targetRef: "host" } } },
  ],
});
