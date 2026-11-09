/** Meticulous Restorationist (RAD-120) — triggered ability of a card in the trash (385). */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Meticulous Restorationist",
  text: "When you play a card with Energy cost [7] or more, you may play me from your trash for [Order].",
  status: "manual",
  notes:
    "Triggered abilities of cards in the trash are not detected (385) and the [Order] play-from-trash permission is part of that trigger.",
  abilities: [],
});
