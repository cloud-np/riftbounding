/** Lotus Trap. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Lotus Trap",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\n[Reaction] (Play any time, even before spells and abilities resolve.)\nChoose a unit. Double all damage that would be dealt to it this turn.",
  status: "manual",
  notes:
    "Damage doubling is a replacement effect that is not expressible (433.1.b, `double` returns manual for damage); [Hidden] and [Reaction] are printed keywords.",
  abilities: [],
});
