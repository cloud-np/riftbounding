/** Evelynn, Agony's Embrace (RAD-153/175, legend) — play-from-facedown trigger + conditional discard. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Evelynn, Agony's Embrace",
  text: "Once each turn, when you play a card from face down, draw 1. Then, if it's not your turn, discard 1.",
  status: "manual",
  notes:
    "Whether the played card came from face down is recorded only on its chain item, not on `card_played`/`unit_played` (811.6, 383.1); the once-per-turn trigger cannot be detected. The 'not your turn' discard branch is simple once the trigger exists.",
  abilities: [],
});
