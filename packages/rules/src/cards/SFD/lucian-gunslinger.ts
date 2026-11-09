/** Lucian, Gunslinger. */
import { registerCardScript, WHEN_I_ATTACK } from "../sdk";
import { HERE_ZONE, target } from "./custom";

registerCardScript({
  name: "Lucian, Gunslinger",
  text: "[Assault] (+1 [Might] while I'm an attacker.)\nWhen I attack, deal damage equal to my [Assault] to an enemy unit here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "for_each",
        selector: target({ controller: "opponent", zone: HERE_ZONE }),
        effect: { op: "custom", id: "sfd:deal-keyword-value", params: { keyword: "Assault" } },
      },
    },
  ],
});
