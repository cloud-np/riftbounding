/** Sacred Shears. */
import { custom, registerCardScript, WHEN_I_DIE } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Sacred Shears",
  text: "[Equip][Order] ([Order]: Attach this to a unit you control.)\n\n[DEATHKNELL] — Draw 1. (When I die, get the effect.)\n+1 [Might]",
  status: "implemented",
  abilities: [
    // Deathknell is printed Rules Text: inactive while attached (718.2), so it triggers only
    // when the unattached Equipment itself dies (a host's death detaches it, 719.5).
    {
      kind: "triggered",
      trigger: WHEN_I_DIE,
      keywords: ["Deathknell"],
      condition: custom("sfd:self-unattached"),
      effect: { op: "draw", amount: 1 },
    },
    mightBonus(1),
  ],
});
