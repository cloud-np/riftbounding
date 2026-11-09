/** Skyfall of Areion. */
import { registerCardScript } from "../sdk";
import { mightBonus } from "./custom";

registerCardScript({
  name: "Skyfall of Areion",
  text: "[Equip][1][Fury] ([1][Fury]: Attach this to a unit you control.)\n\nMy hold effects are also conquer effects, and vice versa.\n+2 [Might]",
  status: "partial",
  notes: `"My hold effects are also conquer effects, and vice versa": no engine support for re-classifying conquer/hold triggered abilities (383.4.c/383.4.d).`,
  abilities: [mightBonus(2)],
});
