/**
 * Sneaky Deckhand (OGN-176) — "You may play me to an open battlefield."
 *
 * Manual: the extra play Location (an open battlefield, 355.2.b) has no hook in the play layer's
 * location rules; it is still played normally to its controller's base or a controlled battlefield.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Sneaky Deckhand",
  text: "You may play me to an open battlefield.",
  status: "manual",
  notes:
    "Playing it to an open battlefield (an extra play Location permission, 355.2.b) is not supported.",
  abilities: [],
});
