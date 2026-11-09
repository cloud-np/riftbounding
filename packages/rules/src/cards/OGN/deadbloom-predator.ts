/**
 * Deadbloom Predator (OGN-161) — [Deflect] (printed); "You may play me to an occupied enemy
 * battlefield." A play-location permission (355.2.b) granted by the card's own text, which the
 * play layer only accepts from effects (`extraLocations` of a 420.3 play).
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Deadbloom Predator",
  text: "[DEFLECT] (Opponents must pay [Rune] to choose me with a spell or effect.)\n\nYou may play me to an occupied enemy battlefield.",
  status: "partial",
  notes:
    'Not automated: "You may play me to an occupied enemy battlefield" — no passive play-location permission (355.2.b). Deflect is a printed keyword.',
  abilities: [],
});
