/** Shurelya's Requiem. */
import { custom, notIntrinsic, registerCardScript, WHEN_PLAYED, whilePassive } from "../sdk";
import { HERE_ZONE, mightBonus } from "./custom";

registerCardScript({
  name: "Shurelya's Requiem",
  text: "[Unique] (Your deck can have only 1 card with this name.)\n\n[Equip][Rune] ([Rune]: Attach this to a unit you control.) \nWhen you play this, ready your units.\n\n\nYour units here have [Ganking] (We can move from battlefield to battlefield.)\n+2 [Might]",
  status: "implemented",
  abilities: [
    ...notIntrinsic("Ganking"),
    {
      kind: "triggered",
      trigger: WHEN_PLAYED,
      effect: { op: "ready", target: { cardType: "unit", controller: "self" } },
    },
    // 724: Effect Text passive for other units, active only while attached (718.3).
    whilePassive(custom("sfd:self-attached"), {
      kind: "keyword",
      keyword: "Ganking",
      target: { cardType: "unit", controller: "self", zone: HERE_ZONE },
    }),
    mightBonus(2),
  ],
});
