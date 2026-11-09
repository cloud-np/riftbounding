/** Last Rites. */
import { registerCardScript } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Last Rites",
  text: "[Equip] — [Chaos], Recycle 2 cards from your trash (Pay the cost: Attach this to a unit you control.)\n\nWhen I conquer or hold, you may play a unit from your trash. (you still pay its costs.)\n+2 [Might]",
  status: "partial",
  notes: `Its Equip cost "Recycle 2 cards from your trash" is not a payable cost (203.3), and "When I conquer or hold, you may play a unit from your trash" is not scripted (effect-driven play from the trash, 420.3).`,
  abilities: [mightBonus(2)],
});
