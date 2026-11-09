/** Edge of Night. */
import { registerCardScript } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Edge of Night",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play this from face down, attach it to a unit you control (here).\n[Equip] [Chaos] ([Chaos]: Attach this to a unit you control.)\n\n+2 [Might].",
  status: "partial",
  notes: `"When you play this from face down, attach it": card-play events do not record the facedown origin (811.1.b, 420.4), so the trigger cannot be detected. Equip and +2 Might are implemented.`,
  abilities: [mightBonus(2)],
});
