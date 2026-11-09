/**
 * Wielder of Water (OGN-055) — "While I'm attacking or defending alone, I have +2 [Might]."
 *
 * Registers `ogn:self-in-combat`: the source holds an attacker or defender designation
 * (323.2 / 740.2.c). "Alone" (740.2.a): no other friendly unit at my location (built-in `alone`).
 */
import { custom, registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Wielder of Water",
  text: "While I'm attacking or defending alone, I have +2 [Might].",
  status: "implemented",
  abilities: [
    {
      kind: "passive",
      modifier: {
        kind: "while",
        condition: {
          kind: "and",
          conditions: [custom("core:in-combat"), { kind: "alone", ref: "self" }],
        },
        modifier: { kind: "might", amount: 2, target: SELF },
      },
    },
  ],
});
