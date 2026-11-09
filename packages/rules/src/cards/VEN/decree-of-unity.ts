/** Decree of Unity (VEN-131) — "Kill an enemy Chaos unit or gear." (429; 131 Domain; "permanent" = unit or gear) */
import { custom, registerCardScript } from "../sdk";

registerCardScript({
  name: "Decree of Unity",
  text: "Kill an enemy Chaos ([Chaos]) unit or gear.",
  status: "implemented",
  abilities: [
    {
      kind: "spell",
      effect: {
        op: "kill",
        target: {
          chosen: true,
          cardType: "permanent",
          controller: "opponent",
          where: custom("ven:has-domain", { domain: "Chaos" }),
        },
      },
    },
  ],
});
