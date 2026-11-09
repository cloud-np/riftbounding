/** Blossoming Dreamroot (RAD-024) — "[Deploy] When you win a combat here, draw 1." (468.3 combat result) */
import { HERE, registerCardScript } from "../sdk";

registerCardScript({
  name: "Blossoming Dreamroot",
  text: "[Deploy] (Play this only to a battlefield. When an opponent holds here, kill this.)\nWhen you win a combat here, draw 1.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "combat_result", zone: HERE, player: "self" } },
      effect: { op: "draw", amount: 1 },
    },
  ],
});
