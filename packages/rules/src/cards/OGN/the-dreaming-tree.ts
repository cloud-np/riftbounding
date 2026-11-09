/**
 * The Dreaming Tree (OGN-292, battlefield, Origins errata) — "When a player chooses a friendly unit
 * here with a spell for the first time each turn, they draw 1."
 *
 * Manual: choosing a target (355.7) emits no game event, so "when a player chooses a unit … with a
 * spell" cannot be detected.
 */
import { registerCardScript } from "../registry";

registerCardScript({
  name: "The Dreaming Tree",
  text: "When a player chooses a friendly unit here with a spell for the first time each turn, they draw 1.",
  status: "manual",
  notes:
    "No event is emitted when a spell chooses its targets (355.7), so the trigger cannot be detected.",
  abilities: [],
});
