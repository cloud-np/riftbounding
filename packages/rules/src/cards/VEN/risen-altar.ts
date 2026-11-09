/** Risen Altar. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Risen Altar",
  text: "[Empower] costs of your units here cost [1] or [Rune] less.",
  status: "partial",
  notes:
    "An either/or discount (Energy or Power) cannot be expressed: cost adjustments are fixed amounts, with no player choice between components (356.4).",
  abilities: [],
});
