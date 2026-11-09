/**
 * Ravenbloom Student (OGN-103) — "When you play a spell, give me +1 [Might] this turn."
 *
 * 420.4.a: abilities that trigger on playing a card trigger when the card has resolved
 * (`spell_resolved`); a countered spell never triggers it (420.4.a.1).
 */
import { registerCardScript, SELF } from "../sdk";

registerCardScript({
  name: "Ravenbloom Student",
  text: "When you play a spell, give me +1 [Might] this turn.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "spell_resolved", player: "self" } },
      effect: { op: "temporary_might", amount: 1, target: SELF },
    },
  ],
});
