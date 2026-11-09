/** Frozen Fortress. */
import { HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Frozen Fortress",
  text: "At the start of each player's Beginning Phase, deal 1 to each unit here. (This happens before scoring.)",
  status: "partial",
  notes:
    "Only triggers at the start of the Beginning Phase of the battlefield's controller: phase triggers of printed abilities are 'your phase' (383.3, 315.2.a.1) and there is no way to mark one as firing on every player's turn.",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      effect: { op: "deal", amount: 1, target: { cardType: "unit", zone: HERE, all: true } },
    },
  ],
});
