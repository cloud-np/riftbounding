/** Ember Monk — when you play a card from Hidden, +2 Might this turn (811.1.b). */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Ember Monk",
  text: "When you play a card from [hidden], give me +2 [might] this turn.",
  status: "manual",
  notes:
    "Not automated: card-play events do not record that the card was played from facedown (the chain item that does is gone before the trigger is detected for units, gear and spells).",
  abilities: [],
});
