/** Shadow Watcher. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Shadow Watcher",
  text: "If a friendly unit died during your Beginning Phase this turn, I enter ready.",
  status: "manual",
  notes:
    "Per-turn history 'a friendly unit died during your Beginning Phase this turn' is not tracked (383.1.b, 429).",
  abilities: [],
});
