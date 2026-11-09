/** Black Market Broker. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Black Market Broker",
  text: "When you play a card from face down, play a Gold gear token exhausted.",
  status: "manual",
  notes:
    '"When you play a card from face down": playing from face down (811) is not recorded on the play events, so the trigger cannot be detected (811.1.b, 420.4).',
  abilities: [],
});
