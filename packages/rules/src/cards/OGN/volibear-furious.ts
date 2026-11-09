/**
 * Volibear, Furious (OGN-041) — "[DEFLECT 2] When I attack, deal 5 damage split among any number
 * of enemy units here."
 *
 * 355.14 / 418.1.d: each chosen enemy unit is a Target; the 5 damage is divided on resolution
 * (R3-engine `deal_split`). [Deflect 2] (809) is printed (the play layer charges it).
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Volibear, Furious",
  text: "[DEFLECT 2] (Opponents must pay [Rune][Rune] to choose me with a spell or effect.)\nWhen I attack, deal 5 damage split among any number of enemy units here.",
  status: "implemented",
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "attack", subject: { targetRef: "self" } } },
      effect: {
        op: "deal_split",
        amount: 5,
        target: {
          chosen: true,
          cardType: "unit",
          controller: "opponent",
          zone: { kind: "chosen", ref: "here" },
          anyNumber: true,
        },
      },
    },
  ],
});
