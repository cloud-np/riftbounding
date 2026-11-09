/** Vex, Cheerless. */
import { custom, registerCardScript, whilePassive } from "../sdk";

registerCardScript({
  name: "Vex, Cheerless",
  text: "While I'm in combat, friendly spells cost [1][Rune] less to a minimum of [1], and enemy spells cost [1][Rune] more.",
  status: "partial",
  notes:
    "Friendly spells cost [1][Rune] less while I'm in combat; \"to a minimum of [1]\" is not enforced (356.6 floors at 0), and the increase for enemy spells is not applied: cost passives only affect their controller's plays (366.2, 475-479).",
  abilities: [
    whilePassive(custom("core:in-combat"), {
      kind: "cost-adjust",
      energy: -1,
      power: { any: -1 },
      target: { cardType: "spell", controller: "self" },
    }),
  ],
});
