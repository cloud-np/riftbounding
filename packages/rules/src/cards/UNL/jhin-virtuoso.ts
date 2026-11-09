/** Jhin, Virtuoso. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Jhin, Virtuoso",
  text: "When you play a spell, if you spent [4] or more, you may banish it. Then, if there are four spells banished with me, put each in its trash, channel 4 runes, and draw 1.",
  status: "manual",
  notes:
    "Resources spent this turn are not tracked (357, 166.2) and spells banished 'with me' are not remembered (428).",
  abilities: [],
});
