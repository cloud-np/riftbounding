/** Akali, Silent. */
import { whilePassive as conditional, custom, not, registerCardScript, SELF } from "../sdk";
import { WHEN_I_MOVE_TO_A_BATTLEFIELD } from "./custom";

registerCardScript({
  name: "Akali, Silent",
  text: "I can't be chosen by enemy spells and abilities unless I'm in combat.\nWhen I move to a battlefield, give me +2 [Might] this turn.",
  status: "implemented",
  abilities: [
    // 757.1 / 740.2.c: the restriction applies while I'm not in combat.
    conditional(not(custom("core:in-combat")), {
      kind: "restriction",
      restriction: "be-targeted:enemy",
      target: SELF,
    }),
    {
      kind: "triggered",
      trigger: WHEN_I_MOVE_TO_A_BATTLEFIELD,
      effect: { op: "temporary_might", amount: 2, target: SELF },
    },
  ],
});
