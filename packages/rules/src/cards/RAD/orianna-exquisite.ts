/**
 * Orianna, Exquisite (RAD-042) — "[Shield] I don't deal combat damage unless there's a friendly
 * gear here." A `no-combat-damage` passive (467.2.a) while no face-up friendly gear is here.
 */
import { custom, not, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Orianna, Exquisite",
  text: "[Shield] (+1 [Might] while I'm a defender.)\nI don't deal combat damage unless there's a friendly gear here.",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "while",
        condition: not(custom("rad:friendly-gear-here")),
        modifier: { kind: "no-combat-damage", target: SELF },
      },
    },
  ],
});
