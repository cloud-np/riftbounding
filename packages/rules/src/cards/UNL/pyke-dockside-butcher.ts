/** Pyke, Dockside Butcher. */
import { PAID_ADDITIONAL, registerCardScript, SELF, WHEN_PLAYED } from "../sdk";

registerCardScript({
  name: "Pyke, Dockside Butcher",
  text: "[Hidden] (Hide it now for [rune] to react with later for [0] .)\n[Ganking] (I can move from battlefield to battlefield.)\nYou may pay [fury] as an additional cost to play me.\nWhen you play me, if you paid the additional cost, ready me and give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      condition: PAID_ADDITIONAL,
      effect: {
        op: "seq",
        effects: [
          { op: "ready", target: SELF },
          { op: "temporary_might", amount: 2, target: SELF },
        ],
      },
    },
  ],
});
