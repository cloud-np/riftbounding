/** Riven, Shattered. */
import { aUnit, custom, HERE, registerCardScript, WHEN_I_ATTACK } from "../sdk";

registerCardScript({
  name: "Riven, Shattered",
  text: "[Weaponmaster] (When you play me, you may [Equip] one of your Equipment to me for [Rune] less, even if it's already attached.)\nWhen I attack, choose an enemy unit here. Deal 2 to it for each Equipment attached to me.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: WHEN_I_ATTACK,
      effect: {
        op: "deal",
        amount: {
          kind: "count",
          selector: { tag: "Equipment", where: custom("ven:attached-to-self") },
          per: 2,
        },
        target: aUnit({ controller: "opponent", zone: HERE }),
      },
    },
  ],
});
