/** Dragon Roost. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Dragon Roost",
  text: "Any player may pay [Rune][Rune] as an additional cost to play a Dragon. If they do, they play it to this battlefield.",
  status: "partial",
  notes:
    "A battlefield-granted optional additional cost plus a per-card play-location permission for every player has no engine representation (355.2, 356.4.f); nothing is automated.",
  abilities: [],
});
