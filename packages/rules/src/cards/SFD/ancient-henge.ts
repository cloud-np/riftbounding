/** Ancient Henge. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Ancient Henge",
  text: "[Tap]: [Reaction] — Pay any amount of Energy to [Add] that much [Rune]. (Abilities that add resources can't be reacted to.)",
  status: "manual",
  notes:
    '"Pay any amount of Energy to [Add] that much Rune": a variable-amount cost converted into resources has no cost/amount form (357, 165); the Reaction Add ability resolves in the manual window.',
  abilities: [],
});
