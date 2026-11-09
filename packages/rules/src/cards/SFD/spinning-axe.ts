/** Spinning Axe. */
import { custom, notIntrinsic, registerCardScript, SELF } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Spinning Axe",
  text: "[Quick-Draw] (This has [Reaction]. When you play it, attach it to a unit you control.)\n[Equip] [Rune] ([Rune]: Attach this to a unit you control.)\n[Temporary] (If this is unattached, kill it at the start of its controller's Beginning Phase, before scoring.)\n\n+3 [Might]",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Temporary"),
    {
      kind: "triggered",
      trigger: { kind: "phase", phase: "beginning" },
      // 718.2: Temporary is printed Rules Text: inactive while attached (it only kills an
      // unattached gear, 816.1.b).
      condition: custom("sfd:self-unattached"),
      effect: { op: "kill", target: SELF },
    },
    mightBonus(3),
  ],
});
