/** Lucian, Purifier. */
import type { Ability } from "@rift/protocol";
import { custom, notIntrinsic, registerCardScript } from "../sdk";

registerCardScript({
  name: "Lucian, Purifier",
  text: "Your Equipment each give [ASSAULT]. +1 [Might] while equipped unit is an attacker.)",
  status: "partial",
  notes:
    "Each Equipment's Assault is expressed as stacked conditional Assault instances on units with 1…8 of your Equipment attached; the layers cannot grant one keyword instance per attached card (479.3, 718.3).",
  abilities: [
    ...notIntrinsic("Assault"),
    ...Array.from({ length: 8 }, (_, index): Ability => ({
      kind: "passive",
      modifier: {
        kind: "keyword",
        keyword: "Assault",
        target: { cardType: "unit", where: custom("sfd:it-equipment-at-least", { n: index + 1 }) },
      },
    })),
  ],
});
