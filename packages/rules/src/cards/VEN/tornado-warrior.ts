/** Tornado Warrior. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Tornado Warrior",
  text: "[Hidden] (Hide now for [Rune] to react with later for [0].)\nWhen you play me from face down, you may empower something here. Disempower it at end of turn.",
  status: "partial",
  notes:
    "A unit played from face down cannot be told apart at its play trigger: the `unit_played` event carries no origin zone (811.6) and the chain item is removed before triggers are detected.",
  abilities: [],
});
