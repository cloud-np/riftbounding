/** Stargazer. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Stargazer",
  text: "Spells with [Flow] you play from your trash cost [2] less, to a minimum of [1].",
  status: "partial",
  notes:
    "The cost layer has no origin-zone query (to tell 'from your trash'), no per-discount minimum of [1] (356.4.c) and no Flow-keyword filter for cards off the board; no cost modifier is registered to avoid applying a wrong discount.",
  abilities: [],
});
