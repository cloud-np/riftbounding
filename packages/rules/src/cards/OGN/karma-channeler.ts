/**
 * Karma, Channeler (OGN-235, Origins errata) — [Vision] (printed); "When you recycle one or more
 * cards to your Main Deck, buff a friendly unit." (417 recycle events to the Main Deck, not the
 * Rune Deck: runes aren't cards.)
 *
 * Recycle events are emitted per card with the card's owner as the player, so recycling several
 * cards in one action triggers once per card, and the owner (not the recycling player) is "you".
 */
import { aUnit, registerCardScript } from "../sdk";

registerCardScript({
  name: "Karma, Channeler",
  text: "[Vision] (When you play me, look at the top card of your\nMain Deck. You may recycle it.)\nWhen you recycle one or more cards to your Main Deck, buff a friendly unit. (If it doesn't have a buff, it gets a +1 [Might] buff. Runes aren't cards.)",
  status: "partial",
  notes:
    '"One or more": several cards recycled in one action trigger once per card (recycle events are per card); the recycled card\'s owner is read as "you".',
  abilities: [
    {
      kind: "triggered",
      trigger: { kind: "event", event: { type: "recycle", player: "self", zone: "deck" } },
      effect: { op: "buff", target: aUnit({ controller: "self" }) },
    },
  ],
});
