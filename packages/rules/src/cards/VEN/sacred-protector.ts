/** Sacred Protector. */
import { custom, not, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Sacred Protector",
  text: "I don't deal combat damage unless I'm at a battlefield with exactly one other unit you control.",
  status: "implemented",
  // 467.2.a/b: no combat damage contribution unless paired.
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "while",
        condition: not(custom("ven:at-battlefield-with-exactly-one-other-friendly")),
        modifier: { kind: "no-combat-damage", target: SELF },
      },
    },
  ],
});
