/** Hextech Anomaly. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Hextech Anomaly",
  text: "[Tap]: [Reaction] — Pay any amount of [Rune] to [Add] that much Energy. (Abilities that add resources can't be reacted to.)",
  status: "manual",
  notes:
    '"Pay any amount of [Rune] to [Add] that much Energy": a variable-amount cost converted into resources has no cost/amount form (357, 165); the Reaction Add ability resolves in the manual window.',
  abilities: [],
});
