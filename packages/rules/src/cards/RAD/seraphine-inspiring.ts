/** Seraphine, Inspiring (RAD-065) — exhaust three or more friendly units at the same time. */
import { registerCardScript } from "../sdk";

registerCardScript({
  name: "Seraphine, Inspiring",
  text: "[Disarm 2] (When I attack, give an enemy unit here -2 [Might] this turn.)\nOnce each turn, when you exhaust three or more friendly units at the same time, you may draw 1.",
  status: "manual",
  notes:
    "Individual exhaust actions emit one event each; there is no grouping of simultaneous exhausts or count of 'three or more at the same time' (383.1, 415), so the trigger cannot be detected faithfully.",
  abilities: [],
});
