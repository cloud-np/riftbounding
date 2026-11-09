/**
 * Kai'Sa, Evolutionary (OGN-112) — [Ganking] (printed); "When I conquer, you may play a spell from
 * your trash with Energy cost less than your points without paying its Energy cost. Then recycle
 * it." The `play` op cannot pay only the Power cost (`ignored`/`free` skip all payment) and has
 * no "recycle instead of trash" destination for the played spell.
 */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Kai'Sa, Evolutionary",
  text: "[GANKING] (I can move from battlefield to battlefield.)\n\nWhen I conquer, you may play a spell from your trash with Energy cost less than your points without paying its Energy cost. Then recycle it. (You must still pay its Power cost.)",
  status: "partial",
  notes:
    "Not automated: the conquer trigger — playing a spell from the trash paying only its Power cost (420.3.b; the play op ignores the whole cost or pays Energy) and recycling it after it resolves. Ganking is printed.",
  abilities: [],
});
