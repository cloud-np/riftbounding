/** Rally for War (RAD-007) — "Choose an occupied enemy battlefield. Play three 1 [Might] Recruit unit tokens there." */
import { custom, registerCardScript, token } from "../sdk";
import { aBattlefield, zoneRef } from "./custom";

registerCardScript({
  name: "Rally for War",
  text: "Choose an occupied enemy battlefield. Play three 1 [Might] Recruit unit tokens there.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "for_each",
        selector: aBattlefield("battlefield", { where: custom("rad:zone-enemy-occupied") }),
        effect: {
          op: "create",
          token: token("Recruit", { count: 3, might: 1, play: true }),
          zone: zoneRef("battlefield"),
        },
      },
    },
  ],
});
