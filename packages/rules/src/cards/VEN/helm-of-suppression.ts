/** Helm of Suppression. */
import { empower, registerCardScript } from "../sdk";

registerCardScript({
  name: "Helm of Suppression",
  text: "[Empower][4][Calm] ([4][Calm]: Empower this. Use only if not Empowered.)\nOpponents' spells cost [1] more. If this is [Empowered], they cost [1][Rune] more instead.",
  status: "partial",
  notes:
    "Cost modifiers only apply to the modifier controller's plays (`layers/costs.ts` skips modifiers whose controller is not the payer), so an opponent-cost increase cannot be expressed (356.3).",
  abilities: [empower({ energy: 4, power: { Calm: 1 } })],
});
