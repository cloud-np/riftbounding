/** Flame Chompers — when you discard me, you may pay Fury to play me (385, 423). */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Flame Chompers",
  text: "When you discard me, you may pay [Fury] to play me.",
  status: "manual",
  notes:
    "Not automated: a trigger of a card that has just left the hand for the trash and playing it from there (no triggers for cards in non-board zones, 385).",
  abilities: [],
});
