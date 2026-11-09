/**
 * Immortal Phoenix (OGN-037) — [Assault 2] (printed); "When you kill a unit with a spell, you may
 * pay [1] [Fury] to play me from your trash."
 * A triggered ability of a card in the trash (385) keyed to spell kill attribution (429.5) — the
 * trigger detector only reads board objects and the leaving object itself.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Immortal Phoenix",
  text: "[ASSAULT 2] (+2 [Might] while I'm an attacker.)\n\nWhen you kill a unit with a spell, you may pay [1] [Fury] to play me from your trash.",
  status: "partial",
  notes:
    'Not automated: the trash trigger "When you kill a unit with a spell, you may pay [1][Fury] to play me from your trash" — no triggers for cards in non-board zones (385) and no spell kill attribution for cleanup kills (429.5.c/d). Assault 2 is printed.',
  abilities: [],
});
