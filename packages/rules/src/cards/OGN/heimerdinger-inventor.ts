/** Heimerdinger, Inventor — has all Tap abilities of all friendly legends, units and gear (482). */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Heimerdinger, Inventor",
  text: "I have all [Tap] abilities of all friendly legends, units and gear.",
  status: "manual",
  notes:
    "Not automated: granting other objects' activated abilities by reference (no ability-copy grant).",
  abilities: [],
});
