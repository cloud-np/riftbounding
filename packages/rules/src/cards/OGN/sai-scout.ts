/**
 * Sai Scout (OGN-174) — "[VISION] You may play me to an open battlefield."
 *
 * [Vision] (817) is a keyword trigger handled by the effects layer. Partial: the extra play
 * Location (an open battlefield, 355.2.b) has no hook in the play layer's location rules.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "Sai Scout",
  text: "[VISION] (When you play me, look at the top card of your Main Deck. You may recycle it.)\nYou may play me to an open battlefield.",
  status: "partial",
  notes:
    "Playing it to an open battlefield (an extra play Location permission, 355.2.b) is not supported.",
  abilities: [],
});
